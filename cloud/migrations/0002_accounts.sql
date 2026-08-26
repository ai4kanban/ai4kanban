-- The account every later row hangs off, and the list of who is admitted to the preview.
--
-- Two facts, kept apart on purpose: `admitted_accounts` is the invite list, written by hand
-- one GitHub handle at a time, and `accounts` is what a sign-in leaves behind once that list
-- lets it through. Neither is reachable from outside `api` — see 0001 for why that is a
-- property of the project rather than a rule each migration remembers.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The invite list. A person adds and removes rows by hand (see cloud/README.md); nothing
-- in the Worker writes it, so admitting somebody is neither a deploy nor a migration.
--
-- Matched case-insensitively, because a hand-written row is typed by a person and GitHub
-- does not care about the case of a handle.
create table cloud.admitted_accounts (
  handle text primary key,
  -- Who this is, in a word, for whoever reads the list later.
  note text,
  admitted_at timestamptz not null default now()
);
create unique index admitted_accounts_lower_handle on cloud.admitted_accounts (lower(handle));
alter table cloud.admitted_accounts enable row level security;

-- One row per person Cloud has admitted, keyed on the verified sign-in subject. Every
-- later row — #318's execution nodes, #319's events and actions, #320's connectors —
-- carries `owner_id references cloud.accounts (id)`.
--
-- `handle` is what the identity provider attests, not what the account holder can rewrite,
-- and it is what #320 links a Slack actor to. It is deliberately NOT unique: GitHub lets a
-- handle be given up and taken by somebody else, and a rename must never refuse the
-- sign-in of the person who kept the account.
create table cloud.accounts (
  id uuid primary key,
  handle text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_lower_handle on cloud.accounts (lower(handle));
alter table cloud.accounts enable row level security;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- The one owner check every route ends up at, so a route that touches a row of somebody
-- else's is refused inside the same transaction as the work it was going to do. Raising
-- aborts that transaction, which is what makes this a check rather than a suggestion.
create or replace function cloud.require_owner(p_account uuid, p_owner uuid)
returns void
language plpgsql
immutable
as $$
begin
  if p_owner is null or p_account is null or p_owner <> p_account then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;
end;
$$;
revoke all on function cloud.require_owner(uuid, uuid) from public;

-- Who is signed in, whether we admit them, and the account record if we do.
--
-- The handle is read from `auth.identities` — the provider's own record, rewritten by Auth
-- on every sign-in — and never from a token. A Supabase access token carries only
-- `user_metadata`, which the account holder rewrites through Auth, so admission and #320's
-- Slack link would both be an account holder's to forge if it were read from there.
--
-- An account that is not admitted writes nothing at all: it is not recorded, and it costs
-- the day's write budget nothing, so anybody with a GitHub account cannot spend it.
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
  v_id uuid;
  v_known_handle text;
  v_known_name text;
  v_known_avatar text;
begin
  select i.identity_data ->> 'user_name',
         nullif(i.identity_data ->> 'name', ''),
         nullif(i.identity_data ->> 'avatar_url', '')
    into v_handle, v_name, v_avatar
  from auth.identities i
  where i.user_id = p_subject and i.provider = 'github'
  order by i.last_sign_in_at desc nulls last
  limit 1;

  -- Signed in through something other than the GitHub provider, so there is no attested
  -- handle to match the list on. Refused the same way an unlisted handle is.
  if v_handle is null then
    return json_build_object('admitted', false, 'handle', null, 'name', null,
                             'avatar_url', null, 'account_id', null);
  end if;

  select true into v_admitted
  from cloud.admitted_accounts a
  where lower(a.handle) = lower(v_handle);

  if not coalesce(v_admitted, false) then
    return json_build_object('admitted', false, 'handle', v_handle, 'name', v_name,
                             'avatar_url', v_avatar, 'account_id', null);
  end if;

  select a.id, a.handle, a.name, a.avatar_url
    into v_id, v_known_handle, v_known_name, v_known_avatar
  from cloud.accounts a
  where a.id = p_subject;

  -- Only a first sign-in, or a profile GitHub has since rewritten, is a write. Without
  -- this every request a signed-in client makes would spend one.
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
                           'avatar_url', v_avatar, 'account_id', p_subject);
end;
$$;
revoke all on function api.account_for_session(uuid, integer) from public;
grant execute on function api.account_for_session(uuid, integer) to service_role;
