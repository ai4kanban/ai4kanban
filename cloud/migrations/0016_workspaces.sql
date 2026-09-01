-- The control plane a Cloud workspace runs on (#314).
--
-- 0.8.0's service knew one account at a time and held no board: nothing allocated a card an
-- id, nothing ordered two writes against one card, and no change was recorded as having
-- happened. This migration is the workspace, its ids, and the one transaction every mutation
-- runs inside.
--
-- Five tables:
--   • `workspaces`            — the board itself, and the revision it reads at now.
--   • `workspace_cards`       — one row per card, numbered with the board's own integers.
--   • `workspace_operations`  — the ledger that makes a retried attempt answer once.
--   • `workspace_audit`       — the immutable attributed trail.
--   • `workspace_deliveries`  — one row per delivery attempt, so its id is the service's.
-- and one altered: #318's `board_servers` gains the workspace its node belongs to.
--
-- Every mutation below is one `api` function and therefore one transaction: authorization,
-- lifecycle rules, operation uniqueness and the expected revision are checked, the change is
-- applied, revisions advance, and an audit event is appended — all of it or none of it. Each
-- one opens by locking the workspace's own row, so the control plane decides the ORDER of two
-- writes and not only whether each is allowed (`cloud.workspace_for_update`). A renewal takes
-- no lock: it is a machine saying it is alive, and it changes nothing anybody reads a revision
-- of.
--
-- A workspace answers ONE account here: the owner who created it. `cloud.workspace_for` is
-- the whole of that check, in one place, so #376 changes it rather than reworks this file.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB06  the revision a write expected has moved. DETAIL carries the revision the resource
--        holds now, so a client re-reads that one card rather than the whole board.
-- AKB07  an operation id already on record against a different payload. A retry carrying
--        the same payload gets the first result instead.
-- AKB08  the node a call named is not this workspace's live node — removed, or another
--        workspace's. Its next renewal, write and delivery confirmation all meet this.
-- AKB09  an audit event was going to be rewritten or dropped on its own.
-- AKB10  the call named a card or a delivery this workspace does not hold.
--
-- A workspace that is not the caller's and one that has been deleted both raise 0002's
-- AKB02, deliberately: no client has to tell "gone" from "not yours", and nothing leaks
-- whether a workspace once existed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One board, stored here rather than in a folder on one machine. The id is the service's,
-- unlike `cloud.boards`, whose id a machine mints for a board it keeps itself.
create table cloud.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null default '',
  -- What the board reads at now. Opaque to every client: only equality is read into it, and
  -- it advances on every mutation so #315's snapshot has a cursor to carry.
  revision bigint not null default 1,
  -- The next card number to hand out. Import carries a board's own numbers in (#315), so a
  -- write naming one moves this past it.
  next_card_id integer not null default 1,
  -- The attempt that created it. The one mutation the ledger below cannot cover — the ledger
  -- lives inside the workspace it would deduplicate — so a create whose reply was lost finds
  -- this workspace again rather than leaving a second empty one behind.
  created_op text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner on cloud.workspaces (owner_id);
create unique index workspaces_created_op on cloud.workspaces (owner_id, created_op)
  where created_op is not null;
alter table cloud.workspaces enable row level security;

-- One row per card. `card_id` is the board's own small integer, kept so #315's import
-- carries every card's number in unchanged and a link to card 42 goes on meaning card 42.
--
-- `data` is the card whole, and this migration reads nothing out of it: what a card holds is
-- #315's, and putting its shape here would make every change to a card a migration.
create table cloud.workspace_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  card_id integer not null,
  revision bigint not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, card_id)
);
alter table cloud.workspace_cards enable row level security;

-- The operation ledger. #312 mints one `opId` per ATTEMPT, so a retry that lost its reply
-- finds the first result here rather than doing the work twice.
--
-- Only an operation that COMMITTED a change is on record: a conflict and a refusal write
-- nothing, so there is nothing to make idempotent and re-running the check answers the same
-- way. That also keeps a refused write costing the day's budget nothing.
--
-- `payload_digest` is what makes the id a promise rather than a name: the same id carrying
-- different words is refused instead of being answered with somebody else's result.
create table cloud.workspace_operations (
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  op_id text not null,
  payload_digest text not null,
  -- Filled in by the same transaction that did the work. A row whose transaction rolled back
  -- is gone with it, so a committed row always carries its result.
  result json,
  at timestamptz not null default now(),
  primary key (workspace_id, op_id)
);
create index workspace_operations_at on cloud.workspace_operations (at);
alter table cloud.workspace_operations enable row level security;

-- What happened, who did it, and on which machine. Appended inside the same transaction as
-- the change it records, never rewritten, and removed only when the workspace is.
--
-- The handle is copied in rather than joined out: the trail has to go on saying who long
-- after a rename, and #376's members are a second name to keep.
create table cloud.workspace_audit (
  -- Counted rather than random, because the trail is read in order and a mutation writing
  -- several events writes them all at one `now()` — a transaction has one clock.
  id bigint generated always as identity primary key,
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  account_id uuid,
  actor_handle text not null default '',
  -- The machine it was done from, where there was one. Null for the owner acting in the app.
  node_id uuid,
  -- What was done, in one word. Deliberately not a check constraint: #315 adds actions, and
  -- a vocabulary in a constraint would make each one a migration.
  action text not null,
  card_id integer,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index workspace_audit_order on cloud.workspace_audit (workspace_id, id desc);
alter table cloud.workspace_audit enable row level security;

-- One row per delivery attempt, so the id a machine reports against is the service's rather
-- than one it made up. What a prepared delivery holds is #315's; this is the id and the
-- attempt's own state.
create table cloud.workspace_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  card_id integer not null,
  node_id uuid references cloud.board_servers (id) on delete set null,
  state text not null default 'open' check (state in ('open', 'completed', 'failed', 'cancelled')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_deliveries_live on cloud.workspace_deliveries (workspace_id) where state = 'open';
alter table cloud.workspace_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- #318's node record, now under a workspace
-- ---------------------------------------------------------------------------
--
-- One node record and not two. #316 gives a node its work, #317 manages nodes and #318 lets
-- "the same node" confirm a pending delivery, so a second table would leave a removed node
-- refused on one path and welcome on another.
--
-- A row names a board (0.8.0's, a board kept on a machine that publishes events here) or a
-- workspace, never both. A board attaches exactly one node; a workspace has as many as the
-- owner registers machines.
alter table cloud.board_servers
  alter column board_id drop not null,
  add column workspace_id uuid references cloud.workspaces (id) on delete cascade,
  -- What the OWNER calls this machine. Seeded from the machine's own name and rewritten by a
  -- rename, so registering again never takes back a name a person chose.
  add column node_name text not null default '',
  -- When it last said it was alive. #316 renews it; nothing here reads it but the list.
  add column lease_expires_at timestamptz,
  add column removed_at timestamptz,
  add constraint board_servers_one_home check (num_nonnulls(board_id, workspace_id) = 1);
-- One LIVE node per machine per workspace. Partial on `removed_at`, because a removal has to
-- stick to the node it removed and not to the machine: the node id the owner took off stays
-- refused for good, and the same machine opening the workspace again registers a NEW node
-- rather than reviving the one they removed or being locked out of the board.
create unique index board_servers_workspace_machine
  on cloud.board_servers (workspace_id, machine_id)
  where workspace_id is not null and removed_at is null;

-- 0005's list is a BOARD's servers. A workspace's nodes are read by `api.list_nodes` below,
-- so the pane that draws board servers never grows rows it cannot render.
create or replace function api.list_servers(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.server_json(s)), '[]'::json)
  from cloud.board_servers s
  where s.owner_id = p_subject and s.enabled and s.board_id is not null;
$$;
revoke all on function api.list_servers(uuid) from public;
grant execute on function api.list_servers(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The trail is immutable
-- ---------------------------------------------------------------------------
--
-- A property of the table rather than a rule each later migration remembers. A delete
-- reaches this only as the cascade from the workspace being removed, by which point the
-- workspace row is already gone — which is exactly the one operation allowed to take a
-- trail with it.
create or replace function cloud.audit_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'An audit event is never rewritten.' using errcode = 'AKB09';
  end if;
  if exists (select 1 from cloud.workspaces w where w.id = old.workspace_id) then
    raise exception 'An audit event is removed only with its workspace.' using errcode = 'AKB09';
  end if;
  return old;
end;
$$;
revoke all on function cloud.audit_is_immutable() from public;

create trigger workspace_audit_immutable
  before update or delete on cloud.workspace_audit
  for each row execute function cloud.audit_is_immutable();

-- ---------------------------------------------------------------------------
-- The checks every mutation runs
-- ---------------------------------------------------------------------------

-- The one authorization check a workspace has. A workspace that is not the caller's and one
-- that no longer exists raise the same AKB02, so a write, a renewal, a delivery confirmation
-- and a second delete all meet the refusal a stranger meets.
--
-- #376 replaces the owner comparison here with a membership check, and changes nothing else.
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
  perform cloud.require_owner(v_workspace.owner_id, p_subject);
  return v_workspace;
end;
$$;
revoke all on function cloud.workspace_for(uuid, uuid) from public;

-- The same, holding the workspace's row until the transaction ends. Every MUTATION starts
-- here, and that lock is what makes the control plane decide the ORDER as well as the change:
-- without it two writers both read revision 3, both pass the expected-revision check, and the
-- second quietly writes over the first. With it the second waits, re-reads a revision that
-- has moved, and is answered with the conflict it should have had.
--
-- One writer at a time per workspace, which is a board's own natural pace: a write is a card
-- being saved, not a keystroke. #375's per-card lease is what narrows this, and it narrows a
-- guarantee that already holds rather than adding one.
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
  perform cloud.require_owner(v_workspace.owner_id, p_subject);
  return v_workspace;
end;
$$;
revoke all on function cloud.workspace_for_update(uuid, uuid) from public;

-- The node a call was made from, or a null row when it named none — the owner acting in the
-- app names no machine. A node that was removed, or that belongs to another workspace, is
-- refused here, which is the one place all three of its refusals come from.
create or replace function cloud.require_node(p_workspace uuid, p_node uuid)
returns cloud.board_servers
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_node cloud.board_servers;
begin
  if p_node is null then return v_node; end if;
  select * into v_node from cloud.board_servers
   where id = p_node and workspace_id = p_workspace and removed_at is null and enabled;
  if v_node.id is null then
    raise exception 'That machine no longer runs this workspace''s work.' using errcode = 'AKB08';
  end if;
  return v_node;
end;
$$;
revoke all on function cloud.require_node(uuid, uuid) from public;

-- The expected revision, checked. DETAIL is the revision the resource holds NOW, so the
-- refusal tells a client which one card to re-read instead of a sentence to interpret.
-- A resource that does not exist yet reads as '' — #312's NO_REVISION, what a create expects.
create or replace function cloud.expect_revision(p_expect text, p_current bigint, p_what text)
returns void
language plpgsql
immutable
as $$
begin
  if coalesce(p_expect, '') is distinct from coalesce(p_current::text, '') then
    raise exception 'That % has changed since it was read.', p_what
      using errcode = 'AKB06', detail = coalesce(p_current::text, '');
  end if;
end;
$$;
revoke all on function cloud.expect_revision(text, bigint, text) from public;

-- Take this attempt, or hand back what it already did.
--
-- Null means "not on record — do the work". Anything else is the first attempt's result, and
-- the same id carrying different words raises AKB07 rather than being answered with somebody
-- else's outcome.
--
-- The row is inserted BEFORE the work, so two machines retrying one attempt at the same
-- moment serialise on it: the second waits on the first's insert, then reads what it wrote.
-- A transaction that rolls back takes its row with it, so nothing is left claiming an
-- attempt that never happened.
create or replace function cloud.claim_operation(p_workspace uuid, p_op_id text, p_payload jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digest text := md5(coalesce(p_payload, '{}'::jsonb)::text);
  v_row cloud.workspace_operations;
begin
  if coalesce(p_op_id, '') = '' then return null; end if;

  insert into cloud.workspace_operations (workspace_id, op_id, payload_digest)
  values (p_workspace, p_op_id, v_digest)
  on conflict (workspace_id, op_id) do nothing
  returning * into v_row;
  if v_row.op_id is not null then return null; end if;

  select * into v_row from cloud.workspace_operations
   where workspace_id = p_workspace and op_id = p_op_id;
  if v_row.payload_digest is distinct from v_digest then
    raise exception 'That operation is already on record against a different change.'
      using errcode = 'AKB07';
  end if;
  return v_row.result;
end;
$$;
revoke all on function cloud.claim_operation(uuid, text, jsonb) from public;

-- What the attempt did, against the row it claimed above. Same transaction as the work.
create or replace function cloud.record_operation(p_workspace uuid, p_op_id text, p_result json)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_op_id, '') = '' then return; end if;
  update cloud.workspace_operations set result = p_result
   where workspace_id = p_workspace and op_id = p_op_id;
end;
$$;
revoke all on function cloud.record_operation(uuid, text, json) from public;

-- Append one event to the trail, attributed to the account and — where the change came from
-- a machine — to the node it was made on.
create or replace function cloud.audit(
  p_workspace uuid,
  p_account uuid,
  p_node uuid,
  p_action text,
  p_card integer,
  p_detail jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into cloud.workspace_audit (
    workspace_id, account_id, actor_handle, node_id, action, card_id, detail
  ) values (
    p_workspace, p_account,
    coalesce((select a.handle from cloud.accounts a where a.id = p_account), ''),
    p_node, p_action, p_card, coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;
revoke all on function cloud.audit(uuid, uuid, uuid, text, integer, jsonb) from public;

-- The board moved. Every mutation ends here, so a client holding the workspace's revision
-- can tell that something changed without reading the whole board back.
create or replace function cloud.touch_workspace(p_workspace uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  update cloud.workspaces set revision = revision + 1, updated_at = now()
   where id = p_workspace
  returning revision into v_revision;
  return v_revision;
end;
$$;
revoke all on function cloud.touch_workspace(uuid) from public;

-- ---------------------------------------------------------------------------
-- What a workspace, a card, a node and a delivery look like on the wire
-- ---------------------------------------------------------------------------

create or replace function cloud.workspace_json(p_workspace cloud.workspaces)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_workspace.id,
    'ownerId', p_workspace.owner_id,
    'name', p_workspace.name,
    'revision', p_workspace.revision::text,
    'nextCardId', p_workspace.next_card_id,
    'createdAt', p_workspace.created_at,
    'updatedAt', p_workspace.updated_at
  );
$$;
revoke all on function cloud.workspace_json(cloud.workspaces) from public;

create or replace function cloud.card_json(p_card cloud.workspace_cards)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_card.card_id,
    'revision', p_card.revision::text,
    'data', p_card.data,
    'createdAt', p_card.created_at,
    'updatedAt', p_card.updated_at
  );
$$;
revoke all on function cloud.card_json(cloud.workspace_cards) from public;

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
    'leaseExpiresAt', p_node.lease_expires_at,
    'live', p_node.lease_expires_at is not null and p_node.lease_expires_at > now()
  );
$$;
revoke all on function cloud.node_json(cloud.board_servers) from public;

create or replace function cloud.delivery_json(p_delivery cloud.workspace_deliveries)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_delivery.id,
    'workspaceId', p_delivery.workspace_id,
    'cardId', p_delivery.card_id,
    'nodeId', p_delivery.node_id,
    'state', p_delivery.state,
    'detail', p_delivery.detail,
    'createdAt', p_delivery.created_at,
    'updatedAt', p_delivery.updated_at
  );
$$;
revoke all on function cloud.delivery_json(cloud.workspace_deliveries) from public;

-- ---------------------------------------------------------------------------
-- The workspace itself
-- ---------------------------------------------------------------------------

-- Any admitted account may make one, and there is no cap: #326's admission list bounds who
-- reaches the service at all, and the day's write budget bounds what they can spend. So this
-- adds no second invite list and no second refusal.
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
    -- Two attempts of one create arrived at once and the other made it. Answer with theirs,
    -- which is the same answer the read above gives a retry that arrives a moment later.
    select * into v_workspace from cloud.workspaces
     where owner_id = p_subject and created_op = p_op_id;
    return cloud.workspace_json(v_workspace);
  end;

  perform cloud.count_write(p_daily_write_budget, 2);
  perform cloud.audit(v_workspace.id, p_subject, null, 'workspace.created', null,
                      json_build_object('name', v_workspace.name)::jsonb);
  return cloud.workspace_json(v_workspace);
end;
$$;
revoke all on function api.create_workspace(uuid, text, text, integer) from public;
grant execute on function api.create_workspace(uuid, text, text, integer) to service_role;

create or replace function api.list_workspaces(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.workspace_json(w) order by w.created_at), '[]'::json)
  from cloud.workspaces w
  where w.owner_id = p_subject;
$$;
revoke all on function api.list_workspaces(uuid) from public;
grant execute on function api.list_workspaces(uuid) to service_role;

create or replace function api.read_workspace(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  return cloud.workspace_json(cloud.workspace_for(p_subject, p_workspace));
end;
$$;
revoke all on function api.read_workspace(uuid, uuid) from public;
grant execute on function api.read_workspace(uuid, uuid) to service_role;

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

-- Delete the workspace and everything stored in it, inside this call. Cards, nodes, the
-- operation ledger, the delivery attempts and the audit trail all go with it — the foreign
-- keys cascade — so there is no grace window, no deleted-but-answering state, and nothing
-- left to restore from. It is the operation #321's privacy page promises.
--
-- Deliberately OUTSIDE the daily write budget, like the heartbeat and the sweep: somebody
-- removing their own data must never be refused for a reason that is about how busy the
-- service was today.
--
-- What it does not take: the owner's #326 account and its admission, which are service data
-- rather than workspace content.
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
  delete from cloud.workspaces where id = p_workspace;
  return json_build_object('deleted', true, 'workspaceId', p_workspace,
                           'name', v_workspace.name);
end;
$$;
revoke all on function api.delete_workspace(uuid, uuid) from public;
grant execute on function api.delete_workspace(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

-- Write one card or twenty, in one transaction. Every expected revision is checked BEFORE
-- anything is written, so a multi-card operation commits whole or changes nothing.
--
-- `p_cards` is `[{"id": 3 | null, "expect": "7", "data": {...}}, ...]`. An entry naming no id
-- is given the next one the board has free; one naming an id the workspace does not hold yet
-- keeps that number, which is what lets #315's import carry a board's own numbering in.
create or replace function api.write_cards(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_cards jsonb,
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
  v_cards jsonb := coalesce(p_cards, '[]'::jsonb);
  v_entry jsonb;
  v_card cloud.workspace_cards;
  v_id integer;
  v_next integer;
  v_written json[] := array[]::json[];
  v_revision bigint;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);
  if jsonb_typeof(v_cards) <> 'array' or jsonb_array_length(v_cards) = 0 then
    return json_build_object('revision', v_workspace.revision::text, 'cards', '[]'::json);
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id, v_cards);
  if v_done is not null then return v_done; end if;

  -- Every check first. A conflict on the last card must leave the first one untouched.
  for v_entry in select * from jsonb_array_elements(v_cards) loop
    v_id := nullif(v_entry ->> 'id', '')::integer;
    if v_id is null then
      perform cloud.expect_revision(v_entry ->> 'expect', null, 'card');
    else
      select * into v_card from cloud.workspace_cards
       where workspace_id = p_workspace and card_id = v_id;
      perform cloud.expect_revision(v_entry ->> 'expect', v_card.revision, 'card ' || v_id);
    end if;
  end loop;

  -- The cards, the trail beside each of them, the workspace's own revision, and the ledger.
  perform cloud.count_write(p_daily_write_budget, jsonb_array_length(v_cards) * 2 + 2);

  v_next := v_workspace.next_card_id;
  for v_entry in select * from jsonb_array_elements(v_cards) loop
    v_id := nullif(v_entry ->> 'id', '')::integer;
    if v_id is null then
      v_id := v_next;
      v_next := v_next + 1;
    end if;

    insert into cloud.workspace_cards as c (workspace_id, card_id, data)
    values (p_workspace, v_id, coalesce(v_entry -> 'data', '{}'::jsonb))
    on conflict (workspace_id, card_id) do update
      set data = excluded.data, revision = c.revision + 1, updated_at = now()
    returning * into v_card;

    if v_id >= v_next then v_next := v_id + 1; end if;
    v_written := v_written || cloud.card_json(v_card);
    perform cloud.audit(p_workspace, p_subject, p_node, 'card.written', v_id, '{}'::jsonb);
  end loop;

  update cloud.workspaces set next_card_id = v_next, revision = revision + 1, updated_at = now()
   where id = p_workspace
  returning revision into v_revision;

  v_result := json_build_object('revision', v_revision::text,
                                'cards', array_to_json(v_written));
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.write_cards(uuid, uuid, text, uuid, jsonb, integer) from public;
grant execute on function api.write_cards(uuid, uuid, text, uuid, jsonb, integer) to service_role;

create or replace function api.read_cards(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
begin
  v_workspace := cloud.workspace_for(p_subject, p_workspace);
  return json_build_object(
    'revision', v_workspace.revision::text,
    'cards', coalesce((
      select json_agg(cloud.card_json(c) order by c.card_id)
      from cloud.workspace_cards c where c.workspace_id = p_workspace
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_cards(uuid, uuid) from public;
grant execute on function api.read_cards(uuid, uuid) to service_role;

-- The trail, newest first. A workspace that keeps a record nobody can read keeps no record.
create or replace function api.read_audit(p_subject uuid, p_workspace uuid, p_limit integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return coalesce((
    select json_agg(json_build_object(
      'id', e.id, 'accountId', e.account_id, 'handle', e.actor_handle, 'nodeId', e.node_id,
      'action', e.action, 'cardId', e.card_id, 'detail', e.detail, 'at', e.at
    ) order by e.id desc)
    from (
      select * from cloud.workspace_audit
       where workspace_id = p_workspace
       order by id desc
       limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) e
  ), '[]'::json);
end;
$$;
revoke all on function api.read_audit(uuid, uuid, integer) from public;
grant execute on function api.read_audit(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The workspace's execution nodes
-- ---------------------------------------------------------------------------

-- A machine registers itself the first time it opens the workspace. Idempotent on the
-- machine id, and free when nothing about the machine moved — a registration happens on
-- every open, and the day's budget must not be spent saying the same thing.
--
-- A machine registering again after it was removed is a new node: the removal stands, and
-- the row it holds keeps its `removed_at` so the trail goes on saying it happened.
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
  v_workspace cloud.workspaces;
  v_node cloud.board_servers;
  v_runtimes jsonb := coalesce(p_runtimes, '[]'::jsonb);
  v_name text := coalesce(p_machine_name, '');
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);

  select * into v_node from cloud.board_servers
   where workspace_id = p_workspace and machine_id = p_machine and removed_at is null;
  if v_node.id is not null then
    if v_node.machine_name = v_name and v_node.runtimes = v_runtimes and v_node.enabled then
      return cloud.node_json(v_node);
    end if;
    -- Something about the machine moved, so this is a change like any other: the revision
    -- advances and the trail records it. The path above is the free one, and it is free
    -- because nothing changed.
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
  values (v_workspace.owner_id, p_workspace, p_machine, v_name, v_name, v_runtimes)
  returning * into v_node;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, v_node.id, 'node.registered', null,
                      json_build_object('name', v_node.node_name)::jsonb);
  return cloud.node_json(v_node);
end;
$$;
revoke all on function api.register_node(uuid, uuid, uuid, text, jsonb, integer) from public;
grant execute on function api.register_node(uuid, uuid, uuid, text, jsonb, integer) to service_role;

create or replace function api.list_nodes(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return coalesce((
    select json_agg(cloud.node_json(s) order by s.created_at)
    from cloud.board_servers s
    where s.workspace_id = p_workspace and s.removed_at is null and s.enabled
  ), '[]'::json);
end;
$$;
revoke all on function api.list_nodes(uuid, uuid) from public;
grant execute on function api.list_nodes(uuid, uuid) to service_role;

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

-- Take a machine off the workspace. Its next renewal, its next write and its next delivery
-- confirmation all meet AKB08 — `cloud.require_node` is the one place that says so.
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

-- A node saying it is still there. One write on a cadence measured in minutes, like #318's
-- claim renewal and for the same reason: the whole service shares one daily write budget.
create or replace function api.renew_node(
  p_subject uuid,
  p_workspace uuid,
  p_node uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node cloud.board_servers;
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  v_node := cloud.require_node(p_workspace, p_node);

  perform cloud.count_write(p_daily_write_budget);
  update cloud.board_servers
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_node
  returning * into v_node;
  return cloud.node_json(v_node);
end;
$$;
revoke all on function api.renew_node(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.renew_node(uuid, uuid, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Delivery attempts
-- ---------------------------------------------------------------------------

-- Open one, under an id the service allocates. What the attempt carries is #315's; this is
-- the id a machine reports against and the account and node it is attributed to.
create or replace function api.open_delivery(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_card integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done json;
  v_result json;
  v_delivery cloud.workspace_deliveries;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);
  if not exists (select 1 from cloud.workspace_cards c
                  where c.workspace_id = p_workspace and c.card_id = p_card) then
    raise exception 'This workspace holds no card %.', p_card using errcode = 'AKB10';
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('card', p_card, 'node', p_node)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  insert into cloud.workspace_deliveries (workspace_id, card_id, node_id)
  values (p_workspace, p_card, p_node)
  returning * into v_delivery;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, p_node, 'delivery.opened', p_card,
                      json_build_object('deliveryId', v_delivery.id)::jsonb);

  v_result := cloud.delivery_json(v_delivery);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.open_delivery(uuid, uuid, text, uuid, integer, integer) from public;
grant execute on function api.open_delivery(uuid, uuid, text, uuid, integer, integer) to service_role;

-- How it ended, from the machine that ran it. A removed node's confirmation is refused, so a
-- machine the owner took off the workspace cannot go on reporting against it.
create or replace function api.confirm_delivery(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_delivery uuid,
  p_outcome text,
  p_detail jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery cloud.workspace_deliveries;
  v_done json;
  v_result json;
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);

  select * into v_delivery from cloud.workspace_deliveries
   where id = p_delivery and workspace_id = p_workspace;
  if v_delivery.id is null then
    raise exception 'This workspace holds no such delivery.' using errcode = 'AKB10';
  end if;

  -- The whole payload, `detail` included: two reports of one attempt that differ in what
  -- they say happened are two changes, and answering the second with the first would put a
  -- delivery's own account of itself on record as something nobody sent.
  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('delivery', p_delivery, 'outcome', p_outcome,
                                                    'detail', coalesce(p_detail, '{}'::jsonb))::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  update cloud.workspace_deliveries
     set state = p_outcome, detail = coalesce(p_detail, '{}'::jsonb), updated_at = now()
   where id = p_delivery
  returning * into v_delivery;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, p_node, 'delivery.confirmed', v_delivery.card_id,
                      json_build_object('deliveryId', p_delivery, 'outcome', p_outcome)::jsonb);

  v_result := cloud.delivery_json(v_delivery);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.confirm_delivery(uuid, uuid, text, uuid, uuid, text, jsonb, integer) from public;
grant execute on function api.confirm_delivery(uuid, uuid, text, uuid, uuid, text, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
--
-- The ledger is a retry window, not a record: it exists so an attempt whose reply was lost is
-- answered once, and #312's publisher gives up on a send after just under four hours. A week
-- is far past that and keeps the table bounded whatever a busy day writes.
--
-- The audit trail is NOT swept. It is the record of what happened, and it goes when the
-- workspace does and at no other time.
--
-- A step in the hourly run rather than a schedule of its own, and outside the daily write
-- budget like the heartbeat and the event sweep: a busy day must not switch off the thing
-- that frees space.
create or replace function api.prune_operations()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from cloud.workspace_operations where at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return json_build_object('deleted', v_deleted);
end;
$$;
revoke all on function api.prune_operations() from public;
grant execute on function api.prune_operations() to service_role;
