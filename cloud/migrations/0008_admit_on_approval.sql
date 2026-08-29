-- Approving an invite request is the whole of getting in (#350).
--
-- 0003 answered a request with a twelve-character code: we approved, the hourly run mailed
-- the code, and the person pasted it back before Cloud would talk to them. The approval was
-- already the decision — the code only carried it, at the cost of a typed secret and two
-- extra steps. So the approval now writes the admission itself, and the mail it sends says
-- the person is in rather than what to paste.
--
-- Three moving parts:
--
--   • `cloud.admitted_accounts` gains a `subject`. An approval-written admission is decided
--     on the sign-in subject the request carries, so a GitHub rename can never un-admit
--     somebody we let in; a hand-written row still has none and is still matched on the
--     handle, which is the door we admit ourselves through.
--   • `cloud.invite_requests` gains an outbox of its own for the approval. The one already
--     there is spent on the notice that somebody asked, so `api.pending_mail` carries a
--     request twice — the notice while it is open and unnotified, the approval once it is
--     approved and unsent — and the two marks tell them apart by kind.
--   • The code path goes: `cloud.invitations` and every function that issued, mailed,
--     redeemed or withdrew one.
--
-- Nothing is stranded by the drop. The released app is 0.7.1 and carries no Cloud pane, so
-- every row in `cloud.invitations` came out of our own testing; anybody handed a code before
-- 0.8.0 ships is admitted with a `cloud.admitted_accounts` row instead.
--
-- NOT backward compatible with the Worker before it: `POST /v1/invitations/redeem` calls
-- `api.redeem_invitation`, which this drops. Deploy the Worker in the same window.

-- ---------------------------------------------------------------------------
-- The admission an approval writes
-- ---------------------------------------------------------------------------

-- Who the admission was written for. Null on a hand-written row, which is matched on the
-- handle the way it always was; set by an approval, which is then decided on this alone.
--
-- Deliberately not unique: two rows for one subject admit exactly as one does, and
-- `remove_account` takes both. A unique index here would turn approving somebody who asked
-- again under a new handle into an error for no gain.
alter table cloud.admitted_accounts add column subject uuid;
create index admitted_accounts_subject
  on cloud.admitted_accounts (subject) where subject is not null;

-- ---------------------------------------------------------------------------
-- The approval's own outbox
-- ---------------------------------------------------------------------------

-- The same three columns the notice carries, beside them rather than instead of them: a
-- request that has been notified and then approved owes two messages, one already sent.
alter table cloud.invite_requests
  add column approved_at timestamptz,
  add column approval_sent_at timestamptz,
  add column approval_attempts integer not null default 0,
  add column approval_error text;
create index invite_requests_approval_unsent
  on cloud.invite_requests (approved_at) where approved_at is not null and approval_sent_at is null;

-- ---------------------------------------------------------------------------
-- Admission
-- ---------------------------------------------------------------------------

-- Who is signed in, whether we admit them, and the account record if we do.
--
-- 0003 had two doors: the hand-written handle list, and a code the subject had redeemed.
-- The code door goes, and the list carries both in its place — a row with no subject is
-- matched on the handle, and a row an approval wrote is matched on the subject and nothing
-- else. So a rename un-admits the first (unchanged, and the point of a hand-written row is
-- that it names a handle) and never the second.
create or replace function api.account_for_session(
  p_subject uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
  v_name text;
  v_avatar text;
  v_admitted boolean;
  v_requested_at timestamptz;
  v_id uuid;
  v_known_handle text;
  v_known_name text;
  v_known_avatar text;
begin
  select a.handle, a.name, a.avatar_url
    into v_handle, v_name, v_avatar
  from cloud.attested(p_subject) a;

  select r.requested_at into v_requested_at
  from cloud.invite_requests r
  where r.subject = p_subject and r.closed_at is null;

  -- Signed in through something other than the GitHub provider, so there is no attested
  -- handle to match the list on. Refused the same way an unlisted handle is.
  if v_handle is null then
    return json_build_object('admitted', false, 'handle', null, 'name', null,
                             'avatar_url', null, 'account_id', null,
                             'invite_requested_at', v_requested_at);
  end if;

  select true into v_admitted
  from cloud.admitted_accounts a
  where a.subject = p_subject
     or (a.subject is null and lower(a.handle) = lower(v_handle));

  if not coalesce(v_admitted, false) then
    return json_build_object('admitted', false, 'handle', v_handle, 'name', v_name,
                             'avatar_url', v_avatar, 'account_id', null,
                             'invite_requested_at', v_requested_at);
  end if;

  select a.id, a.handle, a.name, a.avatar_url
    into v_id, v_known_handle, v_known_name, v_known_avatar
  from cloud.accounts a
  where a.id = p_subject;

  -- Only a first sign-in, or a profile GitHub has since rewritten, is a write. Without this
  -- every request a signed-in client makes would spend one.
  if v_id is null
     or v_known_handle is distinct from v_handle
     or v_known_name is distinct from v_name
     or v_known_avatar is distinct from v_avatar then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.accounts as a (id, handle, name, avatar_url)
    values (p_subject, v_handle, v_name, v_avatar)
    on conflict (id) do update
      set handle = excluded.handle,
          name = excluded.name,
          avatar_url = excluded.avatar_url,
          updated_at = now();
  end if;

  return json_build_object('admitted', true, 'handle', v_handle, 'name', v_name,
                           'avatar_url', v_avatar, 'account_id', p_subject,
                           'invite_requested_at', null);
end;
$$;
revoke all on function api.account_for_session(uuid, integer) from public;
grant execute on function api.account_for_session(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The hourly run's outbox
-- ---------------------------------------------------------------------------

-- Everything still to send, oldest first. One record can be here twice: the notice that
-- somebody asked, while their request is open and unnotified, and the message saying they
-- are in, once it is approved and unsent. `kind` is what tells the two apart, all the way
-- through to the mark.
--
-- A request closed before its notice went out is dropped rather than sent — an answered
-- request needs no answer — but an approval is queued on `approved_at`, which closing is
-- exactly what sets, so the news of an admission is never dropped for the same reason.
create or replace function api.pending_mail(
  p_limit integer,
  p_max_attempts integer
) returns json
language sql
security definer
set search_path = ''
as $$
  with queued as (
    select 'request'::text as kind, r.id::text as ref, r.email, r.handle,
           r.requested_at as queued_at
    from cloud.invite_requests r
    where r.notified_at is null and r.closed_at is null
      and r.notify_attempts < p_max_attempts
    union all
    select 'approval', r.id::text, r.email, r.handle, r.approved_at
    from cloud.invite_requests r
    where r.approved_at is not null and r.approval_sent_at is null
      and r.approval_attempts < p_max_attempts
  ), picked as (
    select * from queued order by queued_at limit p_limit
  )
  select coalesce(json_agg(row_to_json(p) order by p.queued_at), '[]'::json) from picked p;
$$;
revoke all on function api.pending_mail(integer, integer) from public;
grant execute on function api.pending_mail(integer, integer) to service_role;

-- Marked the moment the mail provider accepts it, and never picked up again. A crash between
-- the send and this mark can repeat one message, which tells the reader what they were
-- already told.
create or replace function api.mark_mail_sent(p_kind text, p_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind = 'request' then
    update cloud.invite_requests
       set notified_at = now(), notify_error = null
     where id = p_ref::uuid and notified_at is null;
  elsif p_kind = 'approval' then
    update cloud.invite_requests
       set approval_sent_at = now(), approval_error = null
     where id = p_ref::uuid and approval_sent_at is null;
  end if;
end;
$$;
revoke all on function api.mark_mail_sent(text, text) from public;
grant execute on function api.mark_mail_sent(text, text) to service_role;

-- A failed send: count the attempt and keep the last error, so a dead address is something
-- we can see rather than something the log forgets. Admission does not wait on it — the
-- account is already in — so what a run of failures costs is the news, not the way in.
create or replace function api.mark_mail_failed(p_kind text, p_ref text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind = 'request' then
    update cloud.invite_requests
       set notify_attempts = notify_attempts + 1, notify_error = left(p_error, 500)
     where id = p_ref::uuid and notified_at is null;
  elsif p_kind = 'approval' then
    update cloud.invite_requests
       set approval_attempts = approval_attempts + 1, approval_error = left(p_error, 500)
     where id = p_ref::uuid and approval_sent_at is null;
  end if;
end;
$$;
revoke all on function api.mark_mail_failed(text, text, text) from public;
grant execute on function api.mark_mail_failed(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- What a person does by hand
-- ---------------------------------------------------------------------------

-- Approve an open request: admit the account, close the request, and leave the news for the
-- hourly run to send. Approving is the whole of it — nothing further is asked of the person
-- who asked, and a message that never lands costs them nothing but the news.
--
-- Dropped rather than replaced: 0003's returned the code it issued, and there is none.
drop function if exists cloud.approve_invite_request(text, text);
create function cloud.approve_invite_request(p_handle text, p_note text default null)
returns json
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_request cloud.invite_requests%rowtype;
  v_held_by uuid;
begin
  select * into v_request
  from cloud.invite_requests r
  where lower(r.handle) = lower(p_handle) and r.closed_at is null
  order by r.requested_at
  limit 1
  for update;

  if not found then
    raise exception 'no open invite request from %', p_handle;
  end if;

  -- One row per handle, so a handle two people have held in turn cannot carry two
  -- admissions. Refuse rather than write nothing and still tell the requester they are in:
  -- the row is a stale name for somebody else, and only a person can say what it should be
  -- called now.
  select a.subject into v_held_by
  from cloud.admitted_accounts a
  where lower(a.handle) = lower(v_request.handle);

  if v_held_by is not null and v_held_by <> v_request.subject then
    raise exception 'handle % is already admitted for account % — give that admission the '
                    'handle it goes by now, then approve again', v_request.handle, v_held_by;
  end if;

  -- Decided on the subject; the handle rides along only so we can still find and remove the
  -- admission by name. A handle we already admit by hand keeps its one row and gains the
  -- subject, which is what carries it through a later rename.
  insert into cloud.admitted_accounts as a (handle, subject, note)
  values (v_request.handle, v_request.subject, coalesce(p_note, v_request.handle))
  on conflict (lower(handle)) do update
    set subject = coalesce(a.subject, excluded.subject);

  update cloud.invite_requests
     set closed_at = now(), approved_at = now()
   where id = v_request.id;

  return json_build_object('handle', v_request.handle, 'subject', v_request.subject,
                           'email', v_request.email, 'approved_at', now());
end;
$$;
revoke all on function cloud.approve_invite_request(text, text) from public;

-- Remove an admitted account, by either name the admission can be found under: the handle it
-- was asked under, for somebody who never signed in again and so has no `cloud.accounts`
-- row, and the subject of any account row the named handle matches, for somebody who renamed
-- after we let them in. Its request goes with it, which is what the privacy page's retention
-- section promises.
create or replace function cloud.remove_account(p_handle text)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_subjects uuid[];
  v_removed integer;
begin
  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_subjects
  from (
    select a.subject as s from cloud.admitted_accounts a
     where a.subject is not null and lower(a.handle) = lower(p_handle)
    union
    select a.id from cloud.accounts a where lower(a.handle) = lower(p_handle)
  ) found;

  delete from cloud.admitted_accounts
   where lower(handle) = lower(p_handle) or subject = any (v_subjects);
  delete from cloud.invite_requests where subject = any (v_subjects);
  delete from cloud.accounts where id = any (v_subjects);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function cloud.remove_account(text) from public;

-- ---------------------------------------------------------------------------
-- The code path goes
-- ---------------------------------------------------------------------------
-- Nothing replaces `cloud.issue_invitation`: inviting somebody who never asked is a row in
-- `cloud.admitted_accounts`, by hand and with no mail sent, exactly as it was.

drop function if exists api.redeem_invitation(uuid, text, integer);
drop function if exists cloud.issue_invitation(text, text);
drop function if exists cloud.withdraw_invitation(text);
drop function if exists cloud.new_invitation_code();
drop table if exists cloud.invitations;
drop function if exists cloud.normalize_code(text);
