-- Members and roles in a Cloud workspace (#376).
--
-- #314 gave a workspace to the account that created it, and `cloud.workspace_for` was the
-- whole of that check — one owner comparison, deliberately left in one place for this
-- migration to swap. This is the swap: a workspace answers its MEMBERS, and the owner check
-- moves in front of the operations that manage the workspace itself.
--
-- One table, `workspace_members`: one row per account inside one workspace, carrying the
-- role and nothing else. The GitHub handle is read back from `cloud.accounts` rather than
-- copied here — the trail already keeps its own copy, written at the time, and a second
-- live copy would be a second answer to keep in step.
--
-- Two roles and no third:
--   • owner   — manages members, roles, execution nodes and the workspace itself.
--   • member  — every ordinary board operation.
-- There are no per-card permissions. Widening the workspace check must not hand every
-- member the workspace's delete, so each owner-only operation keeps a check of its own.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB13  the caller is not a member of this workspace. A workspace that was deleted answers
--        with this one too, so nothing says whether a workspace exists. It replaces 0002's
--        AKB02 on every workspace route: AKB02 is shared with a board, a server and a
--        connection, none of which has an owner to ask.
-- AKB14  the caller is a member without the owner role. Its own refusal, because telling
--        somebody already in the workspace to ask to be added would leave their checkout
--        offering the way out of a board they can still read.
-- AKB15  the handle an owner named does not resolve to exactly one admitted account. One
--        message for a handle that never signed in, one still waiting on us, one that does
--        not exist and one two accounts hold — so adding a member cannot be used to find
--        out who has a Cloud account.
-- AKB16  the change would leave the workspace with no owner.

-- ---------------------------------------------------------------------------
-- The member row
-- ---------------------------------------------------------------------------

create table cloud.workspace_members (
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  added_at timestamptz not null default now(),
  primary key (workspace_id, account_id)
);
-- Read the other way round by `api.list_workspaces` — the workspaces an account may open.
create index workspace_members_account on cloud.workspace_members (account_id);
alter table cloud.workspace_members enable row level security;

-- Every workspace #314 already created gains its creator's owner row, so a live workspace
-- goes on answering the account that made it.
insert into cloud.workspace_members (workspace_id, account_id, role)
select w.id, w.owner_id, 'owner' from cloud.workspaces w where w.owner_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- `workspaces.owner_id` records the create and nothing else
-- ---------------------------------------------------------------------------
--
-- It stops answering who may open a workspace, so it becomes nullable and is CLEARED when
-- that account goes rather than taking the workspace with it. A cascade would still delete a
-- transferred workspace when its creator closed their account, and a restrict would make
-- closing that account impossible. What is left is the create-retry it deduplicates.
alter table cloud.workspaces alter column owner_id drop not null;
alter table cloud.workspaces drop constraint workspaces_owner_id_fkey;
alter table cloud.workspaces
  add constraint workspaces_owner_id_fkey
  foreign key (owner_id) references cloud.accounts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- The checks every workspace route runs
-- ---------------------------------------------------------------------------

-- The role this account holds in this workspace, or null for somebody who is not in it.
create or replace function cloud.member_role(p_workspace uuid, p_subject uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from cloud.workspace_members m
   where m.workspace_id = p_workspace and m.account_id = p_subject;
$$;
revoke all on function cloud.member_role(uuid, uuid) from public;

-- Membership, in place of #314's owner comparison. A workspace that is not the caller's and
-- one that has been deleted raise the same refusal — the member row goes with the workspace
-- — so nothing leaks whether a workspace ever existed.
create or replace function cloud.require_member(p_workspace uuid, p_subject uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := cloud.member_role(p_workspace, p_subject);
  if v_role is null then
    raise exception 'You are not in this workspace. Ask an owner to add you to it.'
      using errcode = 'AKB13';
  end if;
  return v_role;
end;
$$;
revoke all on function cloud.require_member(uuid, uuid) from public;

-- Membership AND the owner role. In front of the operations that manage the workspace
-- rather than work on the board, so widening the check above hands nobody the delete.
create or replace function cloud.require_workspace_owner(p_workspace uuid, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cloud.require_member(p_workspace, p_subject) <> 'owner' then
    raise exception 'An owner of this workspace has to do that.' using errcode = 'AKB14';
  end if;
end;
$$;
revoke all on function cloud.require_workspace_owner(uuid, uuid) from public;

-- #314's two entry points, now membership checks. Every route in 0016 and 0017 ends at one
-- of these, so this is the whole of the swap.
create or replace function cloud.workspace_for(p_subject uuid, p_workspace uuid)
returns cloud.workspaces
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  select * into v_workspace from cloud.workspaces where id = p_workspace;
  perform cloud.require_member(p_workspace, p_subject);
  return v_workspace;
end;
$$;
revoke all on function cloud.workspace_for(uuid, uuid) from public;

create or replace function cloud.workspace_for_update(p_subject uuid, p_workspace uuid)
returns cloud.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  select * into v_workspace from cloud.workspaces where id = p_workspace for update;
  perform cloud.require_member(p_workspace, p_subject);
  return v_workspace;
end;
$$;
revoke all on function cloud.workspace_for_update(uuid, uuid) from public;

-- The account behind a GitHub handle, or the one refusal every handle an owner cannot add
-- meets. `cloud.accounts` rather than `cloud.admitted_accounts`: an account row exists only
-- for an admission let through, and #326's approvals are decided on the sign-in rather than
-- on the handle, so the account table is the one place a handle and an admitted account
-- meet. Its handle index is deliberately not unique — GitHub lets a handle be given up and
-- taken by somebody else — so two matches are refused rather than guessed at.
create or replace function cloud.admitted_account_for(p_handle text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_account uuid;
  v_found integer;
begin
  select count(*) into v_found from cloud.accounts a where lower(a.handle) = v_handle;
  if v_handle = '' or v_found <> 1 then
    raise exception 'AI4Kanban Cloud has no admitted account for that GitHub handle. '
                    'They have to sign in to Cloud and be admitted before they can be added.'
      using errcode = 'AKB15';
  end if;

  select a.id into v_account from cloud.accounts a where lower(a.handle) = v_handle;
  return v_account;
end;
$$;
revoke all on function cloud.admitted_account_for(text) from public;

-- A workspace always keeps an owner: #328 addresses a user-owned question to the owner role,
-- so a workspace with no owner is one whose questions reach nobody. Run AFTER the change, so
-- it sees what the workspace would be left with.
create or replace function cloud.require_an_owner(p_workspace uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from cloud.workspace_members m
                  where m.workspace_id = p_workspace and m.role = 'owner') then
    raise exception 'A workspace always keeps an owner. Make somebody else an owner first.'
      using errcode = 'AKB16';
  end if;
end;
$$;
revoke all on function cloud.require_an_owner(uuid) from public;

-- ---------------------------------------------------------------------------
-- What a member and a node look like on the wire
-- ---------------------------------------------------------------------------

-- The handle, the name and the avatar are read back from the account rather than kept here,
-- so a member who renames on GitHub is one name and not two.
create or replace function cloud.member_json(p_member cloud.workspace_members)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'accountId', p_member.account_id,
    'handle', coalesce((select a.handle from cloud.accounts a where a.id = p_member.account_id), ''),
    'name', (select a.name from cloud.accounts a where a.id = p_member.account_id),
    'avatarUrl', (select a.avatar_url from cloud.accounts a where a.id = p_member.account_id),
    'role', p_member.role,
    'addedAt', p_member.added_at
  );
$$;
revoke all on function cloud.member_json(cloud.workspace_members) from public;

-- A node now says whose machine it is. The stamp ATTRIBUTES rather than gates:
-- `cloud.require_node` still asks only whether a node is this workspace's and live, because
-- narrowing it to the registering account would refuse a teammate taking a machine over
-- while protecting nothing the trail does not already attribute.
create or replace function cloud.node_json(p_node cloud.board_servers)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_node.id,
    'workspaceId', p_node.workspace_id,
    'name', coalesce(nullif(p_node.node_name, ''), p_node.machine_name),
    'machineId', p_node.machine_id,
    'machineName', p_node.machine_name,
    'runtimes', p_node.runtimes,
    'accountId', p_node.owner_id,
    'handle', coalesce((select a.handle from cloud.accounts a where a.id = p_node.owner_id), ''),
    'leaseExpiresAt', p_node.lease_expires_at,
    'live', p_node.lease_expires_at is not null and p_node.lease_expires_at > now()
  );
$$;
revoke all on function cloud.node_json(cloud.board_servers) from public;

-- `ownerId` leaves the wire with the check it used to answer. The column still records the
-- create, and nothing else reads it.
create or replace function cloud.workspace_json(p_workspace cloud.workspaces)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_workspace.id,
    'name', p_workspace.name,
    'revision', p_workspace.revision::text,
    'nextCardId', p_workspace.next_card_id,
    'createdAt', p_workspace.created_at,
    'updatedAt', p_workspace.updated_at
  );
$$;
revoke all on function cloud.workspace_json(cloud.workspaces) from public;

-- ---------------------------------------------------------------------------
-- The workspace, as its members open it
-- ---------------------------------------------------------------------------

-- Creating one writes the creator's owner row in the same transaction, so a workspace is
-- never a moment old without somebody in it.
create or replace function api.create_workspace(
  p_subject uuid,
  p_op_id text,
  p_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  if coalesce(p_op_id, '') <> '' then
    select * into v_workspace from cloud.workspaces
     where owner_id = p_subject and created_op = p_op_id;
    if v_workspace.id is not null then return cloud.workspace_json(v_workspace); end if;
  end if;

  begin
    insert into cloud.workspaces (owner_id, name, created_op)
    values (p_subject, coalesce(p_name, ''), nullif(p_op_id, ''))
    returning * into v_workspace;
  exception when unique_violation then
    select * into v_workspace from cloud.workspaces
     where owner_id = p_subject and created_op = p_op_id;
    return cloud.workspace_json(v_workspace);
  end;

  insert into cloud.workspace_members (workspace_id, account_id, role)
  values (v_workspace.id, p_subject, 'owner');

  perform cloud.count_write(p_daily_write_budget, 3);
  perform cloud.audit(v_workspace.id, p_subject, null, 'workspace.created', null,
                      json_build_object('name', v_workspace.name)::jsonb);
  return cloud.workspace_json(v_workspace);
end;
$$;
revoke all on function api.create_workspace(uuid, text, text, integer) from public;
grant execute on function api.create_workspace(uuid, text, text, integer) to service_role;

-- The workspaces an account may open are the ones it is a MEMBER of, not the ones it
-- created. This is the one route that filtered for itself rather than calling the check.
create or replace function api.list_workspaces(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.workspace_json(w) order by w.created_at), '[]'::json)
  from cloud.workspaces w
  join cloud.workspace_members m on m.workspace_id = w.id and m.account_id = p_subject;
$$;
revoke all on function api.list_workspaces(uuid) from public;
grant execute on function api.list_workspaces(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The operations only an owner may run
-- ---------------------------------------------------------------------------
--
-- Each one keeps a check of its own on top of membership, and each one is otherwise exactly
-- the function #314 shipped. A member meets AKB14 here; a non-member met AKB13 one line
-- earlier, inside `cloud.workspace_for_update`.

create or replace function api.rename_workspace(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_expect text,
  p_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
  v_done json;
  v_result json;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  perform cloud.require_node(p_workspace, p_node);
  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('name', p_name)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.expect_revision(p_expect, v_workspace.revision, 'workspace');

  perform cloud.count_write(p_daily_write_budget, 3);
  update cloud.workspaces set name = coalesce(p_name, ''), revision = revision + 1,
                              updated_at = now()
   where id = p_workspace
  returning * into v_workspace;
  perform cloud.audit(p_workspace, p_subject, p_node, 'workspace.renamed', null,
                      json_build_object('name', v_workspace.name)::jsonb);

  v_result := cloud.workspace_json(v_workspace);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.rename_workspace(uuid, uuid, text, uuid, text, text, integer) from public;
grant execute on function api.rename_workspace(uuid, uuid, text, uuid, text, text, integer) to service_role;

create or replace function api.delete_workspace(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  delete from cloud.workspaces where id = p_workspace;
  return json_build_object('deleted', true, 'workspaceId', p_workspace,
                           'name', v_workspace.name);
end;
$$;
revoke all on function api.delete_workspace(uuid, uuid) from public;
grant execute on function api.delete_workspace(uuid, uuid) to service_role;

create or replace function api.rename_node(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node cloud.board_servers;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  v_node := cloud.require_node(p_workspace, p_node);
  v_done := cloud.claim_operation(p_workspace, p_op_id, json_build_object('name', p_name)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  update cloud.board_servers set node_name = coalesce(p_name, ''), updated_at = now()
   where id = p_node
  returning * into v_node;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, p_node, 'node.renamed', null,
                      json_build_object('name', v_node.node_name)::jsonb);

  v_result := cloud.node_json(v_node);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.rename_node(uuid, uuid, text, uuid, text, integer) from public;
grant execute on function api.rename_node(uuid, uuid, text, uuid, text, integer) to service_role;

create or replace function api.remove_node(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node cloud.board_servers;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  v_node := cloud.require_node(p_workspace, p_node);
  v_done := cloud.claim_operation(p_workspace, p_op_id, json_build_object('node', p_node)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  update cloud.board_servers
     set removed_at = now(), enabled = false, lease_expires_at = null, updated_at = now()
   where id = p_node
  returning * into v_node;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, p_node, 'node.removed', null,
                      json_build_object('name', v_node.node_name)::jsonb);

  v_result := json_build_object('removed', true, 'nodeId', p_node);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.remove_node(uuid, uuid, text, uuid, integer) from public;
grant execute on function api.remove_node(uuid, uuid, text, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Any member registers and renews their own machine
-- ---------------------------------------------------------------------------
--
-- The one change from #314's function: the node is stamped with the account that registered
-- it rather than with the workspace's creator, so the node list can say whose machine each
-- one is. A workspace holds one node per machine per member's machine, which is what lifts
-- 0.8.0's one-server-per-board rule.
create or replace function api.register_node(
  p_subject uuid,
  p_workspace uuid,
  p_machine uuid,
  p_machine_name text,
  p_runtimes jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node cloud.board_servers;
  v_runtimes jsonb := coalesce(p_runtimes, '[]'::jsonb);
  v_name text := coalesce(p_machine_name, '');
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);

  select * into v_node from cloud.board_servers
   where workspace_id = p_workspace and machine_id = p_machine and removed_at is null;
  if v_node.id is not null then
    if v_node.machine_name = v_name and v_node.runtimes = v_runtimes and v_node.enabled then
      return cloud.node_json(v_node);
    end if;
    perform cloud.count_write(p_daily_write_budget, 3);
    update cloud.board_servers
       set machine_name = v_name, runtimes = v_runtimes, enabled = true, updated_at = now()
     where id = v_node.id
    returning * into v_node;
    perform cloud.touch_workspace(p_workspace);
    perform cloud.audit(p_workspace, p_subject, v_node.id, 'node.registered', null,
                        json_build_object('name', v_node.node_name)::jsonb);
    return cloud.node_json(v_node);
  end if;

  perform cloud.count_write(p_daily_write_budget, 3);
  insert into cloud.board_servers (owner_id, workspace_id, machine_id, machine_name, node_name, runtimes)
  values (p_subject, p_workspace, p_machine, v_name, v_name, v_runtimes)
  returning * into v_node;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, v_node.id, 'node.registered', null,
                      json_build_object('name', v_node.node_name)::jsonb);
  return cloud.node_json(v_node);
end;
$$;
revoke all on function api.register_node(uuid, uuid, uuid, text, jsonb, integer) from public;
grant execute on function api.register_node(uuid, uuid, uuid, text, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Managing the members
-- ---------------------------------------------------------------------------

-- Who is in it, and what the CALLER's own role is. The role travels with the list rather
-- than being worked out from a handle on the client: the caller is already known here, and a
-- screen that drew the owner controls off a name match would draw them for a namesake.
create or replace function api.list_members(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return json_build_object(
    'role', cloud.member_role(p_workspace, p_subject),
    'members', coalesce((
      select json_agg(cloud.member_json(m) order by m.added_at)
      from cloud.workspace_members m where m.workspace_id = p_workspace
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.list_members(uuid, uuid) from public;
grant execute on function api.list_members(uuid, uuid) to service_role;

-- Add somebody already admitted to the preview, by GitHub handle.
--
-- Adding a member never ADMITS an account: a handle we have not let in is refused, and the
-- workspace keeps nothing for it — no pending member and no invitation of its own — so that
-- person asks the preview for themselves and an owner adds them once we have approved them.
--
-- The owner check runs before the handle is looked up, so a member without the role cannot
-- use this to find out who has a Cloud account.
create or replace function api.add_member(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_handle text,
  p_role text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_role text := case when p_role = 'owner' then 'owner' else 'member' end;
  v_member cloud.workspace_members;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);
  v_account := cloud.admitted_account_for(p_handle);

  -- Already in: answer with the membership as it stands rather than re-roling somebody a
  -- second owner is meanwhile changing — changing a role is `api.set_member_role`. Checked
  -- before the ledger, like a registration that finds nothing moved, so the free path writes
  -- nothing at all and costs the day's budget nothing.
  select * into v_member from cloud.workspace_members
   where workspace_id = p_workspace and account_id = v_account;
  if v_member.account_id is not null then return cloud.member_json(v_member); end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('account', v_account, 'role', v_role)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 3);
  insert into cloud.workspace_members (workspace_id, account_id, role)
  values (p_workspace, v_account, v_role)
  returning * into v_member;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'member.added', null,
                      json_build_object('accountId', v_account, 'role', v_role)::jsonb);

  v_result := cloud.member_json(v_member);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.add_member(uuid, uuid, text, text, text, integer) from public;
grant execute on function api.add_member(uuid, uuid, text, text, text, integer) to service_role;

-- Take somebody off. Their next write and their next delivery confirmation are refused —
-- `cloud.require_member` is the one place that says so — and nothing pushes to a board they
-- already have open, so they meet the removal on the first thing they try to change.
--
-- No tombstone row is kept: #314's audit event carries the acting account id under no
-- foreign key and the handle copied in at write time, so the trail reads after both the
-- member row and the account are gone.
create or replace function api.remove_member(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_account uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member cloud.workspace_members;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('account', p_account)::jsonb);
  if v_done is not null then return v_done; end if;

  delete from cloud.workspace_members
   where workspace_id = p_workspace and account_id = p_account
  returning * into v_member;
  if v_member.account_id is null then
    raise exception 'This workspace holds no such member.' using errcode = 'AKB10';
  end if;
  perform cloud.require_an_owner(p_workspace);

  perform cloud.count_write(p_daily_write_budget, 3);
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'member.removed', null,
                      json_build_object('accountId', p_account, 'role', v_member.role)::jsonb);

  v_result := json_build_object('removed', true, 'accountId', p_account);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.remove_member(uuid, uuid, text, uuid, integer) from public;
grant execute on function api.remove_member(uuid, uuid, text, uuid, integer) to service_role;

create or replace function api.set_member_role(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_account uuid,
  p_role text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := case when p_role = 'owner' then 'owner' else 'member' end;
  v_member cloud.workspace_members;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_workspace_owner(p_workspace, p_subject);

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('account', p_account, 'role', v_role)::jsonb);
  if v_done is not null then return v_done; end if;

  update cloud.workspace_members set role = v_role
   where workspace_id = p_workspace and account_id = p_account
  returning * into v_member;
  if v_member.account_id is null then
    raise exception 'This workspace holds no such member.' using errcode = 'AKB10';
  end if;
  perform cloud.require_an_owner(p_workspace);

  perform cloud.count_write(p_daily_write_budget, 3);
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'member.role_changed', null,
                      json_build_object('accountId', p_account, 'role', v_role)::jsonb);

  v_result := cloud.member_json(v_member);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.set_member_role(uuid, uuid, text, uuid, text, integer) from public;
grant execute on function api.set_member_role(uuid, uuid, text, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Closing an account no longer takes a workspace with it
-- ---------------------------------------------------------------------------
--
-- The removal is by handle and can match more than one account, so one held owner row
-- refuses the WHOLE call: removing some and refusing the rest would leave the operator
-- half-done. What a permitted removal takes is the account's memberships and its machines,
-- both by cascade; its name on the work it already did stays in the trail.
create or replace function cloud.remove_account(p_handle text)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_subjects uuid[];
  v_owned text;
  v_removed integer;
begin
  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_subjects
  from (
    select a.subject as s from cloud.admitted_accounts a
     where a.subject is not null and lower(a.handle) = lower(p_handle)
    union
    select a.id from cloud.accounts a where lower(a.handle) = lower(p_handle)
  ) found;

  select string_agg(coalesce(nullif(w.name, ''), w.id::text), ', ' order by w.created_at)
    into v_owned
  from cloud.workspace_members m
  join cloud.workspaces w on w.id = m.workspace_id
  where m.account_id = any (v_subjects) and m.role = 'owner';

  if v_owned is not null then
    raise exception 'That account still owns %. Transfer each one to another owner, or '
                    'delete it, then run this again.', v_owned;
  end if;

  delete from cloud.admitted_accounts
   where lower(handle) = lower(p_handle) or subject = any (v_subjects);
  delete from cloud.invite_requests where subject = any (v_subjects);
  delete from cloud.accounts where id = any (v_subjects);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;
revoke all on function cloud.remove_account(text) from public;
