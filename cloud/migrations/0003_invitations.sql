-- The invitation loop: the request a refused person makes, and the code that answers it.
--
-- #326 admits by hand — a row in `cloud.admitted_accounts` naming a GitHub handle. This adds
-- the second door: a code we issue, redeemed by whichever account pastes it first. Both doors
-- stay open, because the list is how we admit ourselves without issuing a code.
--
-- The hourly run's outbox is three columns on each record rather than a table of its own: a
-- request is notified once and an invitation is sent once, so what would be queued is exactly
-- the row itself.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- What a refused person asked for. Keyed on the verified sign-in subject and not on
-- `cloud.accounts`, because an account we have not admitted has no row there at all.
--
-- The handle and the address are what `auth.identities` attested at the moment of asking,
-- copied in rather than read back later: an answer written next week is written from what
-- the identity provider verified then.
create table cloud.invite_requests (
  id uuid primary key default gen_random_uuid(),
  subject uuid not null,
  handle text not null,
  email text not null,
  requested_at timestamptz not null default now(),
  -- Set when the request is answered — the account redeemed a code, or a person closed it by
  -- hand. An open request is the one the pane reports in place of the button.
  closed_at timestamptz,
  -- The hourly run's outbox. `notified_at` is set the moment the mail provider accepts it.
  notified_at timestamptz,
  notify_attempts integer not null default 0,
  notify_error text
);
-- One OPEN request per account, so pressing the button twice neither writes a second row nor
-- sends a second notice. Closing one leaves the way clear to ask again.
create unique index invite_requests_one_open
  on cloud.invite_requests (subject) where closed_at is null;
create index invite_requests_unsent
  on cloud.invite_requests (requested_at) where notified_at is null;
alter table cloud.invite_requests enable row level security;

-- A code, and where it came from and went. One code admits one account, and a withdrawn code
-- admits nobody at all — which is also how an admission is revoked without deleting the row
-- that records it.
create table cloud.invitations (
  code text primary key,
  -- Where the code is mailed: the address the sign-in attested for a request, or one named by
  -- hand when we invite somebody who never asked.
  email text not null,
  -- The request this answers, when it answers one.
  request_id uuid references cloud.invite_requests (id) on delete set null,
  -- Who this is for, in a word, for whoever reads the list later.
  note text,
  issued_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  -- Who spent it, by sign-in subject rather than by handle: GitHub lets a handle be given up
  -- and taken by somebody else, and a rename must never un-admit whoever a code let in.
  redeemed_by uuid,
  redeemed_at timestamptz,
  -- The outbox again, the same three columns the request carries.
  sent_at timestamptz,
  send_attempts integer not null default 0,
  send_error text
);
create index invitations_redeemed_by
  on cloud.invitations (redeemed_by) where redeemed_by is not null;
create index invitations_unsent
  on cloud.invitations (issued_at) where sent_at is null;
alter table cloud.invitations enable row level security;

-- ---------------------------------------------------------------------------
-- Codes
-- ---------------------------------------------------------------------------

-- What a typed code is matched on: case and dashes are the reader's, not the code's.
create or replace function cloud.normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
$$;
revoke all on function cloud.normalize_code(text) from public;

create unique index invitations_normalized_code
  on cloud.invitations (cloud.normalize_code(code));

-- A new code: three groups of four from an alphabet with no 0, O, 1 or I in it, because a
-- code is read off an email and typed back by hand. Twelve characters of thirty-two is 60
-- bits, so guessing one is not a way in.
--
-- The bytes come from `gen_random_uuid()`, which Postgres draws from its strong random
-- source. Thirty-two divides 256 exactly, so the remainder below is unbiased.
create or replace function cloud.new_invitation_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for i in 0..11 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
      if i % 4 = 3 and i < 11 then
        v_code := v_code || '-';
      end if;
    end loop;
    exit when not exists (select 1 from cloud.invitations x where x.code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function cloud.new_invitation_code() from public;

-- ---------------------------------------------------------------------------
-- What the identity provider attests
-- ---------------------------------------------------------------------------

-- The handle, name, avatar and address GitHub itself recorded for this sign-in, read from
-- `auth.identities` and never from a token, whose claims the account holder can rewrite
-- through Auth. Both the request and the redemption need it, so it is written once.
create or replace function cloud.attested(p_subject uuid)
returns table (handle text, name text, avatar_url text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.identity_data ->> 'user_name',
         nullif(i.identity_data ->> 'name', ''),
         nullif(i.identity_data ->> 'avatar_url', ''),
         nullif(i.identity_data ->> 'email', '')
  from auth.identities i
  where i.user_id = p_subject and i.provider = 'github'
  order by i.last_sign_in_at desc nulls last
  limit 1;
$$;
revoke all on function cloud.attested(uuid) from public;

-- ---------------------------------------------------------------------------
-- Admission, by either door
-- ---------------------------------------------------------------------------

-- Who is signed in, whether we admit them, and the account record if we do.
--
-- 0002 admitted on the hand-written handle list alone. An account is now admitted by either
-- door — that list, or a code it redeemed — and the two are deliberately not merged: the list
-- is keyed on a handle that can change hands, and a redemption is keyed on the subject.
--
-- An account that is not admitted still writes nothing at all, so anybody with a GitHub
-- account cannot spend the day's write budget by signing in. It carries back when it last
-- asked for an invite, which is what the pane shows in place of the button.
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
  where lower(a.handle) = lower(v_handle);

  -- The second door. A withdrawn code admits nobody, whenever it was withdrawn.
  if not coalesce(v_admitted, false) then
    select true into v_admitted
    from cloud.invitations i
    where i.redeemed_by = p_subject and i.withdrawn_at is null;
  end if;

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
-- Asking for an invite
-- ---------------------------------------------------------------------------

-- Record the request, and nothing else. Recording it is the whole of what the route does:
-- the hourly run is what notifies us, so nothing about asking waits on mail and a notice
-- that fails is retried rather than lost.
--
-- Pressing again returns the request already open, so it writes no second row and queues no
-- second notice.
create or replace function api.request_invite(
  p_subject uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
  v_email text;
  v_requested_at timestamptz;
begin
  select a.handle, a.email into v_handle, v_email
  from cloud.attested(p_subject) a;

  if v_handle is null then
    return json_build_object('ok', false, 'reason', 'no_provider');
  end if;
  -- Nothing about a request is typed, so an account the provider returns no address for has
  -- nowhere for a code to be sent.
  if v_email is null then
    return json_build_object('ok', false, 'reason', 'no_address');
  end if;

  select r.requested_at into v_requested_at
  from cloud.invite_requests r
  where r.subject = p_subject and r.closed_at is null;

  if v_requested_at is null then
    begin
      perform cloud.count_write(p_daily_write_budget);
      insert into cloud.invite_requests (subject, handle, email)
      values (p_subject, v_handle, v_email)
      returning requested_at into v_requested_at;
    exception when unique_violation then
      -- Two presses at once. The loser takes what the winner wrote, and its own write is
      -- rolled back with this block, so the day's budget is charged once.
      select r.requested_at into v_requested_at
      from cloud.invite_requests r
      where r.subject = p_subject and r.closed_at is null;
    end;
  end if;

  return json_build_object('ok', true, 'requested_at', v_requested_at);
end;
$$;
revoke all on function api.request_invite(uuid, integer) from public;
grant execute on function api.request_invite(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Redeeming a code
-- ---------------------------------------------------------------------------

-- One code, one account. A code that is unknown, already spent or withdrawn comes back with
-- its own reason and writes nothing at all, so guessing at codes cannot spend the day's write
-- budget on everybody else's behalf.
create or replace function api.redeem_invitation(
  p_subject uuid,
  p_code text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_row cloud.invitations%rowtype;
  v_handle text;
  v_name text;
  v_avatar text;
begin
  v_code := cloud.normalize_code(p_code);
  if length(v_code) = 0 then
    return json_build_object('ok', false, 'reason', 'unknown');
  end if;

  select * into v_row
  from cloud.invitations i
  where cloud.normalize_code(i.code) = v_code
  for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'unknown');
  end if;
  if v_row.withdrawn_at is not null then
    return json_build_object('ok', false, 'reason', 'withdrawn');
  end if;
  if v_row.redeemed_by is not null then
    -- The same account pasting its own code again is already admitted by it, not refused.
    if v_row.redeemed_by = p_subject then
      return json_build_object('ok', true, 'code', v_row.code);
    end if;
    return json_build_object('ok', false, 'reason', 'redeemed');
  end if;

  select a.handle, a.name, a.avatar_url into v_handle, v_name, v_avatar
  from cloud.attested(p_subject) a;

  if v_handle is null then
    return json_build_object('ok', false, 'reason', 'no_provider');
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);

  update cloud.invitations
     set redeemed_by = p_subject, redeemed_at = now()
   where code = v_row.code;

  -- The account row a redemption hangs off. The handle list creates one the same way, in
  -- `account_for_session`; whichever door admits first is the one that writes it.
  insert into cloud.accounts as a (id, handle, name, avatar_url)
  values (p_subject, v_handle, v_name, v_avatar)
  on conflict (id) do update
    set handle = excluded.handle,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  -- The admission answers the asking, whether or not this is the code we issued for it.
  update cloud.invite_requests
     set closed_at = now()
   where closed_at is null
     and (id = v_row.request_id or subject = p_subject);

  return json_build_object('ok', true, 'code', v_row.code);
end;
$$;
revoke all on function api.redeem_invitation(uuid, text, integer) from public;
grant execute on function api.redeem_invitation(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The hourly run's outbox
-- ---------------------------------------------------------------------------

-- Everything still to send, oldest first: request notices and issued invitations in one
-- list, because one sender and one retry is the whole of the mechanism. A record already
-- marked sent is never picked up, and one that has failed too often is left where it is
-- rather than mailed every hour forever.
--
-- A record answered before its mail went out is dropped rather than sent: a code already
-- spent has nothing left to tell anybody, and a request already closed needs no answer.
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
           null::text as code, r.requested_at as queued_at
    from cloud.invite_requests r
    where r.notified_at is null and r.closed_at is null
      and r.notify_attempts < p_max_attempts
    union all
    select 'invitation', i.code, i.email, null::text, i.code, i.issued_at
    from cloud.invitations i
    where i.sent_at is null and i.withdrawn_at is null and i.redeemed_by is null
      and i.send_attempts < p_max_attempts
  ), picked as (
    select * from queued order by queued_at limit p_limit
  )
  select coalesce(json_agg(row_to_json(p) order by p.queued_at), '[]'::json) from picked p;
$$;
revoke all on function api.pending_mail(integer, integer) from public;
grant execute on function api.pending_mail(integer, integer) to service_role;

-- Marked the moment the mail provider accepts it, and never picked up again. A crash between
-- the send and this mark can repeat one message, which carries the same code and admits
-- nothing extra.
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
  elsif p_kind = 'invitation' then
    update cloud.invitations
       set sent_at = now(), send_error = null
     where code = p_ref and sent_at is null;
  end if;
end;
$$;
revoke all on function api.mark_mail_sent(text, text) from public;
grant execute on function api.mark_mail_sent(text, text) to service_role;

-- A failed send: count the attempt and keep the last error, so a dead address is something
-- we can see rather than something the log forgets.
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
  elsif p_kind = 'invitation' then
    update cloud.invitations
       set send_attempts = send_attempts + 1, send_error = left(p_error, 500)
     where code = p_ref and sent_at is null;
  end if;
end;
$$;
revoke all on function api.mark_mail_failed(text, text, text) from public;
grant execute on function api.mark_mail_failed(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- What a person does by hand
-- ---------------------------------------------------------------------------
-- None of these is reachable over REST: they live in `cloud`, which PostgREST serves to
-- nobody. They are run in the project's SQL editor, the way an account is admitted today —
-- see "Answer an invite request" in cloud/README.md.

-- Approve an open request: issue the code, point it at the address the sign-in attested, and
-- leave it for the hourly run to send. Approving is the whole of it.
create or replace function cloud.approve_invite_request(p_handle text, p_note text default null)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_request cloud.invite_requests%rowtype;
  v_code text;
begin
  select * into v_request
  from cloud.invite_requests r
  where lower(r.handle) = lower(p_handle) and r.closed_at is null
  order by r.requested_at
  limit 1;

  if not found then
    raise exception 'no open invite request from %', p_handle;
  end if;

  v_code := cloud.new_invitation_code();
  insert into cloud.invitations (code, email, request_id, note)
  values (v_code, v_request.email, v_request.id, coalesce(p_note, v_request.handle));
  return v_code;
end;
$$;
revoke all on function cloud.approve_invite_request(text, text) from public;

-- Invite somebody who never asked, by naming the address to send to.
create or replace function cloud.issue_invitation(p_email text, p_note text default null)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  v_code := cloud.new_invitation_code();
  insert into cloud.invitations (code, email, note) values (v_code, p_email, p_note);
  return v_code;
end;
$$;
revoke all on function cloud.issue_invitation(text, text) from public;

-- Withdraw a code. Before it is redeemed this stops it admitting anybody and stops it going
-- out; after, it closes the door it opened.
create or replace function cloud.withdraw_invitation(p_code text)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_found boolean;
begin
  update cloud.invitations
     set withdrawn_at = now()
   where cloud.normalize_code(code) = cloud.normalize_code(p_code)
     and withdrawn_at is null
  returning true into v_found;
  return coalesce(v_found, false);
end;
$$;
revoke all on function cloud.withdraw_invitation(text) from public;

-- Remove an admitted account, by both doors: the listed handle, and every code it redeemed.
-- Its request and its invitation go with it, which is what the privacy page's retention
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
  delete from cloud.admitted_accounts where lower(handle) = lower(p_handle);

  select coalesce(array_agg(a.id), '{}'::uuid[]) into v_subjects
  from cloud.accounts a
  where lower(a.handle) = lower(p_handle);

  delete from cloud.invitations where redeemed_by = any (v_subjects);
  delete from cloud.invite_requests where subject = any (v_subjects);
  delete from cloud.accounts where id = any (v_subjects);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function cloud.remove_account(text) from public;
