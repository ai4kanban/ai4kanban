-- A lock says who is holding it (#375).
--
-- #315 gave a workspace one writer per card and refused the rest with "Another writer is
-- holding card 12." — true, and no use to the person reading it: a teammate turned away
-- could not tell whether to wait a minute or go do something else, because the refusal named
-- nobody. #376 made the members a holder is one of.
--
-- `workspace_locks.account_id` has recorded the holder since #315, so nothing new is stored.
-- What is new is that it is READ BACK — through the membership, the way #376 reads a handle
-- back off the account rather than copying it anywhere:
--
--   `cloud.lock_holder`   the holder's GitHub handle, or `''` when it cannot be attributed.
--
-- Unattributable means the account row is gone (`account_id` is `on delete set null`), or
-- the holder has since been removed from the workspace. Both answer `''`, and every reader
-- falls back to the wording it had before rather than showing a blank or a stale name.
--
-- No new lock, no new expiry, no override: a lock is still one holder at a time on a lease
-- the database mints, and nobody may take a live one from its holder.

-- The handle of the account holding a lock in this workspace, or `''`.
--
-- Read through `workspace_members` and not off the account alone: a former member's name on
-- a live hold would say a person is working a board they can no longer open.
create or replace function cloud.lock_holder(p_workspace uuid, p_account uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select a.handle
      from cloud.workspace_members m
      join cloud.accounts a on a.id = m.account_id
     where m.workspace_id = p_workspace and m.account_id = p_account
  ), '');
$$;
revoke all on function cloud.lock_holder(uuid, uuid) from public;

-- `holder` beside the lease, for every screen and command that draws a hold.
create or replace function cloud.lock_json(p_lock cloud.workspace_locks, p_revision text)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'leaseId', p_lock.lease_id,
    'cardId', nullif(p_lock.card_id, 0),
    'revision', p_revision,
    'holder', cloud.lock_holder(p_lock.workspace_id, p_lock.account_id),
    'grantedAt', p_lock.granted_at,
    'expiresAt', p_lock.expires_at
  );
$$;
revoke all on function cloud.lock_json(cloud.workspace_locks, text) from public;

-- The refusal names them. `@handle is holding card 12.`, and the sentence #315 raised when
-- there is no handle to name — the message travels to the reader as it stands (#316), so
-- this is the one place the wording lives.
create or replace function cloud.require_lock(p_workspace uuid, p_card integer, p_lease uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock cloud.workspace_locks;
  v_handle text;
begin
  select * into v_lock from cloud.workspace_locks
   where workspace_id = p_workspace and card_id = p_card;
  if v_lock.workspace_id is null then return; end if;
  if v_lock.expires_at <= now() then return; end if;
  if p_lease is not null and v_lock.lease_id = p_lease then return; end if;
  v_handle := cloud.lock_holder(p_workspace, v_lock.account_id);
  raise exception '% is holding %.',
    case when v_handle = '' then 'Another writer' else '@' || v_handle end,
    case when p_card = 0 then 'this board' else 'card ' || p_card end
    using errcode = 'AKB11', detail = v_lock.expires_at::text;
end;
$$;
revoke all on function cloud.require_lock(uuid, integer, uuid) from public;
