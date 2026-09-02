-- The board's own content, stored in the workspace (#315).
--
-- #314 built the control plane: a workspace, its cards' numbers, the operation ledger, the
-- attributed trail and one delivery row per attempt. It deliberately read nothing out of a
-- card and held nothing else a board has. This migration is the rest of the board — the
-- memory set, the board's configuration, the per-flow rules, the archive, closed releases'
-- summaries, the delivery record and the frozen bodies it carries — plus the two things
-- that make two machines safe on one board: a writer lock per card, and an import that can
-- be retried without doubling anything.
--
-- What it adds:
--   • `workspace_documents`  — every board file that is not a card, keyed by the path it is
--                              exported back to.
--   • `workspace_locks`      — one writer per card, or over the board, on a lease.
--   • `workspace_cards.archived_at`     — a card that has left the board but not the record.
--   • `workspace_deliveries.record/...` — the portable half of a delivery and the bodies it
--                                         froze, with the repository half stripped HERE
--                                         rather than trusted to a client.
--   • `workspaces.import_fingerprint` and `workspace_audit.import_key` — what makes a
--                                         retried import find its own work.
--
-- Everything below keeps #314's shape: one `api` function is one transaction, every mutation
-- opens by locking the workspace row so the control plane decides the ORDER of two writes,
-- the expected revision is checked before anything is written, and an audit event is
-- appended beside the change.
--
-- What deliberately does NOT reach here, on any path this migration adds: a repository, a
-- branch, a worktree, a commit, an API key or a model name. `cloud.portable_delivery` is the
-- one place that is enforced rather than asked for.

-- ---------------------------------------------------------------------------
-- Refusals this migration adds
-- ---------------------------------------------------------------------------
-- AKB11  the card is held by another writer whose lease has not run out. DETAIL carries the
--        instant it expires, so a caller can say how long the wait is rather than "later".
-- AKB12  an import into a workspace that already holds a board somebody else put there.
--
-- Everything else stays #314's: AKB06 for a revision that moved, AKB07 for an operation id
-- reused against different words, AKB08 for a removed node, AKB10 for a card or delivery
-- this workspace does not hold, and 0002's AKB02 for a workspace that is not the caller's.

-- ---------------------------------------------------------------------------
-- Every board file that is not a card
-- ---------------------------------------------------------------------------
--
-- One row per document, keyed by the path it came from and is written back to —
-- `config.md`, `memory/cloud/readme.md`, `rules/revise.md`. The path is the key because it
-- is what makes export a file-for-file restore and import a file-for-file read: nothing has
-- to invent a name on either side, and a document this service has never heard of still
-- travels through unchanged.
--
-- `kind` is what a snapshot selects on, and the whole of what this migration reads into a
-- document. Five values, which are the two halves of a board:
--   • `config`, `memory`, `rule`  — the LIVE board. A snapshot carries them.
--   • `summary`, `history`        — finished work and the daily tally, read on demand.
-- Deliberately not a check constraint, for #314's reason: a vocabulary in a constraint makes
-- every addition a migration.
--
-- The body is text and not jsonb: these are markdown files, and a board that stored them as
-- anything else would export something a person did not write.
create table cloud.workspace_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  path text not null,
  kind text not null,
  revision bigint not null default 1,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, path)
);
create index workspace_documents_kind on cloud.workspace_documents (workspace_id, kind);
alter table cloud.workspace_documents enable row level security;

-- The kinds a snapshot carries — the board as it is being worked on now. The archive, the
-- trail and delivery records grow with the board's whole past while a screen draws its
-- present, so they are read on demand instead.
create or replace function cloud.live_kinds()
returns text[]
language sql
immutable
as $$ select array['config', 'memory', 'rule']::text[] $$;
revoke all on function cloud.live_kinds() from public;

-- ---------------------------------------------------------------------------
-- A card that has left the board
-- ---------------------------------------------------------------------------
--
-- Archiving is not deletion: the card file moves to `.archive/` on a Local board and the
-- record of what shipped is the point of it. So an archived card keeps its row, its number
-- and its revision, and is simply not part of the live board any more.
--
-- A rejected card is the other thing entirely, and stays what it is on a Local board: the
-- row goes, and the reason lives on in memory and in the trail.
alter table cloud.workspace_cards add column archived_at timestamptz;
create index workspace_cards_live on cloud.workspace_cards (workspace_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- One writer per card
-- ---------------------------------------------------------------------------
--
-- #314's row lock decides the order of two writes that arrive together. It cannot decide
-- anything about two writes minutes apart, which is what a person editing a card actually
-- is — and one account on two machines already has two of those.
--
-- So a lock, held by one holder at a time on a lease. Its holder is the LEASE ID it was
-- granted under and not the account: this group serves one account on two machines, so an
-- account-wide lock would separate nobody and the second machine would overwrite the first
-- without a word. #375 names the member holding it when a second person can.
--
-- `card_id` 0 is the board itself — the memory set, releases, the module map, the per-flow
-- rules — matching the contract's `LeaseTarget`. Card numbers start at 1, so nothing
-- collides with it.
--
-- Nothing sweeps: an expired row is free for the next caller, who overwrites it. A lock
-- neither advances the workspace's revision nor writes to the trail — it changes nothing
-- anybody reads a revision of, and a board whose trail was mostly locks would be a trail
-- nobody reads.
create table cloud.workspace_locks (
  workspace_id uuid not null references cloud.workspaces (id) on delete cascade,
  card_id integer not null,
  -- What the holder presents to take it again and to write under it. Minted here, so
  -- nothing a client sends can name itself the holder of a lock it never took.
  lease_id uuid not null default gen_random_uuid(),
  account_id uuid references cloud.accounts (id) on delete set null,
  node_id uuid references cloud.board_servers (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (workspace_id, card_id)
);
alter table cloud.workspace_locks enable row level security;

-- Whether this caller may write `p_card` (0 for the board itself).
--
-- Three ways through, and one refusal:
--   • nothing holds it, or what held it has expired  — the write goes ahead
--   • the lease presented is the holder's            — the write goes ahead
--   • somebody else holds it and has not run out     — AKB11, carrying when it frees up
--
-- A write carrying no lease at all is allowed against an unheld card. That is what keeps a
-- one-machine board — and every #314 client — writing exactly as it did: the lock exists to
-- separate two writers, so a card nobody is holding needs none.
create or replace function cloud.require_lock(p_workspace uuid, p_card integer, p_lease uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock cloud.workspace_locks;
begin
  select * into v_lock from cloud.workspace_locks
   where workspace_id = p_workspace and card_id = p_card;
  if v_lock.workspace_id is null then return; end if;
  if v_lock.expires_at <= now() then return; end if;
  if p_lease is not null and v_lock.lease_id = p_lease then return; end if;
  raise exception 'Another writer is holding %.',
    case when p_card = 0 then 'this board' else 'card ' || p_card end
    using errcode = 'AKB11', detail = v_lock.expires_at::text;
end;
$$;
revoke all on function cloud.require_lock(uuid, integer, uuid) from public;

-- What a resource reads at now, for the revision a lock hands its holder. The board's own
-- revision for card 0, and `''` for a card that is not there yet — #312's NO_REVISION, what
-- a create expects to find.
create or replace function cloud.revision_at(p_workspace uuid, p_card integer)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when p_card = 0 then (select w.revision::text from cloud.workspaces w where w.id = p_workspace)
      else (select c.revision::text from cloud.workspace_cards c
             where c.workspace_id = p_workspace and c.card_id = p_card)
    end, '');
$$;
revoke all on function cloud.revision_at(uuid, integer) from public;

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
    'grantedAt', p_lock.granted_at,
    'expiresAt', p_lock.expires_at
  );
$$;
revoke all on function cloud.lock_json(cloud.workspace_locks, text) from public;

-- Take the lock over one card, or over the board, and be handed the revision it reads at.
--
-- Presenting the lease it was granted under takes it again and moves the expiry — a session
-- working a card for an hour renews rather than queues. Presenting none mints a new lease,
-- which is refused outright when somebody else is still holding it.
--
-- The revision comes back with the lease because a caller who never READ the card writes
-- against it — someone typing `akb board update 12 --status ready`. It is read inside the
-- same transaction that took the lock, so it is what the last writer left behind rather than
-- what a writer is in the middle of moving.
create or replace function api.take_lock(
  p_subject uuid,
  p_workspace uuid,
  p_node uuid,
  p_card integer,
  p_lease uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card integer := coalesce(p_card, 0);
  v_lock cloud.workspace_locks;
  v_seconds integer := greatest(coalesce(p_lease_seconds, 1800), 60);
begin
  perform cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);
  perform cloud.require_lock(p_workspace, v_card, p_lease);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.workspace_locks as l (workspace_id, card_id, lease_id, account_id, node_id, expires_at)
  values (p_workspace, v_card, coalesce(p_lease, gen_random_uuid()), p_subject, p_node,
          now() + make_interval(secs => v_seconds))
  on conflict (workspace_id, card_id) do update
    set lease_id = excluded.lease_id,
        account_id = excluded.account_id,
        node_id = excluded.node_id,
        granted_at = case when l.lease_id = excluded.lease_id then l.granted_at else now() end,
        expires_at = excluded.expires_at
  returning * into v_lock;

  return cloud.lock_json(v_lock, cloud.revision_at(p_workspace, v_card));
end;
$$;
revoke all on function api.take_lock(uuid, uuid, uuid, integer, uuid, integer, integer) from public;
grant execute on function api.take_lock(uuid, uuid, uuid, integer, uuid, integer, integer) to service_role;

-- Give it up before it runs out. Silent about a lock this caller does not hold: a client
-- releasing a lease that already expired and was taken by somebody else must not take
-- theirs away, and it has nothing to do about being told.
--
-- Outside the daily write budget, like the heartbeat and the workspace's own deletion: a
-- release refused for a reason about how busy the service was today would leave the card
-- held for the rest of the lease for nothing.
create or replace function api.release_lock(
  p_subject uuid,
  p_workspace uuid,
  p_card integer,
  p_lease uuid
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone integer;
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  delete from cloud.workspace_locks
   where workspace_id = p_workspace and card_id = coalesce(p_card, 0) and lease_id = p_lease;
  get diagnostics v_gone = row_count;
  return json_build_object('released', v_gone > 0);
end;
$$;
revoke all on function api.release_lock(uuid, uuid, integer, uuid) from public;
grant execute on function api.release_lock(uuid, uuid, integer, uuid) to service_role;

create or replace function api.list_locks(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return coalesce((
    select json_agg(cloud.lock_json(l, cloud.revision_at(p_workspace, l.card_id)) order by l.card_id)
    from cloud.workspace_locks l
    where l.workspace_id = p_workspace and l.expires_at > now()
  ), '[]'::json);
end;
$$;
revoke all on function api.list_locks(uuid, uuid) from public;
grant execute on function api.list_locks(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Cards, now that some of them are archived and some of them are held
-- ---------------------------------------------------------------------------

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
    'archived', p_card.archived_at is not null,
    'archivedAt', p_card.archived_at,
    'createdAt', p_card.created_at,
    'updatedAt', p_card.updated_at
  );
$$;

-- #314's writer, with two things added and nothing else moved.
--
--   • An entry may present the LEASE it holds over that card. A card somebody else is
--     holding is refused before anything is written, like every other check here.
--   • An entry may say whether the card is `archived`. Left out, the card keeps the state it
--     has — a save is about a card's words, not about whether it is still on the board — so
--     only a move that means it says so.
--
-- `p_cards` is `[{"id": 3 | null, "expect": "7", "lease": "…", "archived": true, "data": {…}}, …]`.
-- Replaced in place rather than overloaded: the signature does not move, because two
-- signatures of one function is a PostgREST call that cannot be resolved.
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
  v_archived timestamptz;
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
  --
  -- The revision is checked BEFORE the lock, and the order is the whole of what a stale
  -- writer is told. A machine whose lease ran out under a long run comes back holding words
  -- written against a version the board has moved past: what it needs to hear is that the
  -- card changed, so it re-reads that card — not that somebody else is holding it, which
  -- would send it away to try the same stale write again later. A caller whose words ARE
  -- current and who simply does not hold the card meets the lock, which is the refusal that
  -- fits it.
  for v_entry in select * from jsonb_array_elements(v_cards) loop
    v_id := nullif(v_entry ->> 'id', '')::integer;
    if v_id is null then
      perform cloud.expect_revision(v_entry ->> 'expect', null, 'card');
    else
      select * into v_card from cloud.workspace_cards
       where workspace_id = p_workspace and card_id = v_id;
      perform cloud.expect_revision(v_entry ->> 'expect', v_card.revision, 'card ' || v_id);
      perform cloud.require_lock(p_workspace, v_id, nullif(v_entry ->> 'lease', '')::uuid);
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

    insert into cloud.workspace_cards as c (workspace_id, card_id, data, archived_at)
    values (p_workspace, v_id, coalesce(v_entry -> 'data', '{}'::jsonb),
            case when (v_entry -> 'archived')::text = 'true' then now() end)
    on conflict (workspace_id, card_id) do update
      set data = excluded.data,
          archived_at = case
            when v_entry ? 'archived'
              then case when (v_entry -> 'archived')::text = 'true' then coalesce(c.archived_at, now()) end
            else c.archived_at
          end,
          revision = c.revision + 1,
          updated_at = now()
    returning * into v_card;

    if v_id >= v_next then v_next := v_id + 1; end if;
    v_written := v_written || cloud.card_json(v_card);
    perform cloud.audit(p_workspace, p_subject, p_node,
                        case when v_card.archived_at is null then 'card.written' else 'card.archived' end,
                        v_id, '{}'::jsonb);
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

-- The LIVE board's cards. An archived one keeps its row and its number and is read through
-- `api.read_archive` — a screen draws the board somebody is working on, and this board has
-- three times as many archived cards as live ones.
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
      from cloud.workspace_cards c
      where c.workspace_id = p_workspace and c.archived_at is null
    ), '[]'::json)
  );
end;
$$;

-- One card, by its number. What a conflict is answered with: AKB06 names the card whose
-- revision moved, and the caller re-reads THAT card rather than the whole board.
create or replace function api.read_card(p_subject uuid, p_workspace uuid, p_card integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
  v_card cloud.workspace_cards;
begin
  v_workspace := cloud.workspace_for(p_subject, p_workspace);
  select * into v_card from cloud.workspace_cards
   where workspace_id = p_workspace and card_id = p_card;
  if v_card.id is null then
    raise exception 'This workspace holds no card %.', p_card using errcode = 'AKB10';
  end if;
  return json_build_object('revision', v_workspace.revision::text, 'card', cloud.card_json(v_card));
end;
$$;
revoke all on function api.read_card(uuid, uuid, integer) from public;
grant execute on function api.read_card(uuid, uuid, integer) to service_role;

-- The board's finished work. Read on demand and never in a snapshot.
create or replace function api.read_archive(p_subject uuid, p_workspace uuid)
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
      from cloud.workspace_cards c
      where c.workspace_id = p_workspace and c.archived_at is not null
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_archive(uuid, uuid) from public;
grant execute on function api.read_archive(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create or replace function cloud.document_json(p_doc cloud.workspace_documents)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'path', p_doc.path,
    'kind', p_doc.kind,
    'revision', p_doc.revision::text,
    'body', p_doc.body,
    'createdAt', p_doc.created_at,
    'updatedAt', p_doc.updated_at
  );
$$;
revoke all on function cloud.document_json(cloud.workspace_documents) from public;

-- Write one document or twenty, in one transaction, under the BOARD's lock — a memory file,
-- the module map, a release list and a per-flow rule are all "what is not one card", which
-- is exactly what the contract's `{ board: true }` target means.
--
-- `p_documents` is `[{"path": "rules/revise.md", "kind": "rule", "expect": "3", "body": "…"}, …]`.
-- An empty body DELETES the document, because that is what an empty rule means on a Local
-- board: a flow with no rule and a flow with an empty rule are the same flow, and a board
-- exported with a blank file in it would not be the board that was imported.
create or replace function api.write_documents(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_lease uuid,
  p_documents jsonb,
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
  v_docs jsonb := coalesce(p_documents, '[]'::jsonb);
  v_entry jsonb;
  v_doc cloud.workspace_documents;
  v_path text;
  v_body text;
  v_written json[] := array[]::json[];
  v_revision bigint;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  perform cloud.require_node(p_workspace, p_node);
  if jsonb_typeof(v_docs) <> 'array' or jsonb_array_length(v_docs) = 0 then
    return json_build_object('revision', v_workspace.revision::text, 'documents', '[]'::json);
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id, v_docs);
  if v_done is not null then return v_done; end if;

  -- Every check first, so a conflict on the last document leaves the first one untouched.
  -- The revision before the lock, for `write_cards`' reason: a stale writer is told what
  -- changed, and a current one that holds nothing is told who is holding it.
  for v_entry in select * from jsonb_array_elements(v_docs) loop
    v_path := coalesce(v_entry ->> 'path', '');
    if v_path = '' then
      raise exception 'A document names no path.' using errcode = 'AKB10';
    end if;
    select * into v_doc from cloud.workspace_documents
     where workspace_id = p_workspace and path = v_path;
    perform cloud.expect_revision(v_entry ->> 'expect', v_doc.revision, v_path);
  end loop;
  perform cloud.require_lock(p_workspace, 0, p_lease);

  perform cloud.count_write(p_daily_write_budget, jsonb_array_length(v_docs) * 2 + 2);

  for v_entry in select * from jsonb_array_elements(v_docs) loop
    v_path := v_entry ->> 'path';
    v_body := coalesce(v_entry ->> 'body', '');
    if v_body = '' then
      delete from cloud.workspace_documents
       where workspace_id = p_workspace and path = v_path;
      perform cloud.audit(p_workspace, p_subject, p_node, 'document.removed', null,
                          json_build_object('path', v_path)::jsonb);
      continue;
    end if;

    insert into cloud.workspace_documents as d (workspace_id, path, kind, body)
    values (p_workspace, v_path, coalesce(nullif(v_entry ->> 'kind', ''), 'config'), v_body)
    on conflict (workspace_id, path) do update
      set kind = excluded.kind, body = excluded.body, revision = d.revision + 1, updated_at = now()
    returning * into v_doc;

    v_written := v_written || cloud.document_json(v_doc);
    perform cloud.audit(p_workspace, p_subject, p_node, 'document.written', null,
                        json_build_object('path', v_path, 'kind', v_doc.kind)::jsonb);
  end loop;

  update cloud.workspaces set revision = revision + 1, updated_at = now()
   where id = p_workspace
  returning revision into v_revision;

  v_result := json_build_object('revision', v_revision::text, 'documents', array_to_json(v_written));
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.write_documents(uuid, uuid, text, uuid, uuid, jsonb, integer) from public;
grant execute on function api.write_documents(uuid, uuid, text, uuid, uuid, jsonb, integer) to service_role;

-- Every document, or the ones of one kind. `p_kind` empty reads the lot, which is what
-- export takes.
create or replace function api.read_documents(p_subject uuid, p_workspace uuid, p_kind text)
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
    'documents', coalesce((
      select json_agg(cloud.document_json(d) order by d.path)
      from cloud.workspace_documents d
      where d.workspace_id = p_workspace
        and (coalesce(p_kind, '') = '' or d.kind = p_kind)
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_documents(uuid, uuid, text) from public;
grant execute on function api.read_documents(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- The whole live board, under one cursor
-- ---------------------------------------------------------------------------
--
-- One read a screen hydrates from: the workspace, its live cards and the documents that are
-- the board being worked on now. Everything comes out of one transaction, so the `revision`
-- it carries really is the revision every row in it was read at — which is what makes it a
-- cursor a client can write against rather than a pile of separate reads.
--
-- What it leaves out is what grows with the board's whole past: the archive, the trail and
-- delivery records. This board holds 190 archived cards and 503 trail rows against 65 live
-- ones, and a screen draws the present.
create or replace function api.read_snapshot(p_subject uuid, p_workspace uuid)
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
    'workspace', cloud.workspace_json(v_workspace),
    'cards', coalesce((
      select json_agg(cloud.card_json(c) order by c.card_id)
      from cloud.workspace_cards c
      where c.workspace_id = p_workspace and c.archived_at is null
    ), '[]'::json),
    'documents', coalesce((
      select json_agg(cloud.document_json(d) order by d.path)
      from cloud.workspace_documents d
      where d.workspace_id = p_workspace and d.kind = any (cloud.live_kinds())
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_snapshot(uuid, uuid) from public;
grant execute on function api.read_snapshot(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- What a delivery leaves in the workspace
-- ---------------------------------------------------------------------------
--
-- A delivery's record is two halves. The PORTABLE half — the card it was for, the body it
-- was approved to build, every run in it, the steps it entered and how it ended — is what
-- another machine can read something true out of. The REPOSITORY half — the base commit,
-- the target branch, the branch, the worktree, the commit it landed as — means something
-- only where the repository is, and this migration is where it stops.
--
-- Stripped here rather than asked of a client, because "nothing about the code reaches
-- Cloud" is a property of the store or it is a promise somebody forgets to keep.
create or replace function cloud.portable_delivery(p_record jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p_record is null or jsonb_typeof(p_record) <> 'object' then '{}'::jsonb
    else (p_record - 'base' - 'branch' - 'targetBranch' - 'worktree')
         || case
              when p_record ? 'landing'
                then jsonb_build_object('landing', (p_record -> 'landing') - 'commit' - 'onto')
              else '{}'::jsonb
            end
         || case
              when p_record ? 'reviewed'
                then jsonb_build_object('reviewed', (p_record -> 'reviewed') - 'diff')
              else '{}'::jsonb
            end
  end;
$$;
revoke all on function cloud.portable_delivery(jsonb) from public;

alter table cloud.workspace_deliveries
  -- The portable half of the record, as the machine that ran it wrote it down.
  add column record jsonb not null default '{}'::jsonb,
  -- The card exactly as it was approved for this delivery, frozen when it started — every
  -- run in the delivery builds from this and not from the card file underneath.
  add column approved text not null default '',
  -- The card's body as the delivery left it. What review read, and what a second machine can
  -- see without the branch it was written on.
  add column final_body text not null default '',
  -- The id the SOURCE board gave a delivery that was imported, so a retried import finds its
  -- own work. Null on every delivery this workspace opened itself, which is why the index
  -- below is partial.
  add column source_id text;
create unique index workspace_deliveries_source
  on cloud.workspace_deliveries (workspace_id, source_id)
  where source_id is not null;

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
    'record', p_delivery.record,
    'approved', p_delivery.approved,
    'finalBody', p_delivery.final_body,
    'createdAt', p_delivery.created_at,
    'updatedAt', p_delivery.updated_at
  );
$$;

-- Store what a delivery prepared, and the bodies it froze. Called while the delivery is
-- open and again as it ends, so a second machine reading the workspace sees the same
-- delivery the machine that ran it does — minus its repository half.
create or replace function api.record_delivery(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_node uuid,
  p_delivery uuid,
  p_record jsonb,
  p_approved text,
  p_final text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery cloud.workspace_deliveries;
  v_record jsonb := cloud.portable_delivery(p_record);
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

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('delivery', p_delivery, 'record', v_record,
                                                    'approved', coalesce(p_approved, ''),
                                                    'final', coalesce(p_final, ''))::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 4);
  update cloud.workspace_deliveries
     set record = v_record,
         approved = coalesce(nullif(p_approved, ''), approved),
         final_body = coalesce(nullif(p_final, ''), final_body),
         updated_at = now()
   where id = p_delivery
  returning * into v_delivery;
  perform cloud.touch_workspace(p_workspace);
  perform cloud.audit(p_workspace, p_subject, p_node, 'delivery.recorded', v_delivery.card_id,
                      json_build_object('deliveryId', p_delivery)::jsonb);

  v_result := cloud.delivery_json(v_delivery);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.record_delivery(uuid, uuid, text, uuid, uuid, jsonb, text, text, integer) from public;
grant execute on function api.record_delivery(uuid, uuid, text, uuid, uuid, jsonb, text, text, integer) to service_role;

-- Every delivery this workspace holds, or one card's. Newest first — a card page wants the
-- one that is running, and the rest are its history.
create or replace function api.read_deliveries(p_subject uuid, p_workspace uuid, p_card integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return coalesce((
    select json_agg(cloud.delivery_json(d) order by d.created_at desc)
    from cloud.workspace_deliveries d
    where d.workspace_id = p_workspace and (p_card is null or d.card_id = p_card)
  ), '[]'::json);
end;
$$;
revoke all on function api.read_deliveries(uuid, uuid, integer) from public;
grant execute on function api.read_deliveries(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Importing a board that already exists
-- ---------------------------------------------------------------------------
--
-- A board being moved into Cloud arrives as ordinary writes — its cards through
-- `write_cards`, its files through `write_documents`, its deliveries through
-- `record_delivery` — because a board that could only arrive through a path of its own would
-- be a second way of writing a board to keep working.
--
-- Two things those writers cannot do by themselves, and this section is the whole of them:
--
--   • Refuse to import into a workspace somebody is already using. Cards and documents are
--     keyed by number and path, so an import into a live board would silently overwrite it.
--   • Carry the board's history without doubling it on a retry. The trail is append-only
--     with no natural key, so an imported event carries the source row's own identity.
alter table cloud.workspaces
  -- The source board this workspace was imported from — its fingerprint, which the machine
  -- derives from the board it is reading. Null on a workspace that was never imported into.
  add column import_fingerprint text,
  add column imported_at timestamptz;

alter table cloud.workspace_audit
  -- `<fingerprint>:<row>` for an event that came from a source board's own record, so a
  -- retried import finds its own work rather than appending it again. Null for every event
  -- this service raised itself.
  add column import_key text;
create unique index workspace_audit_import
  on cloud.workspace_audit (workspace_id, import_key)
  where import_key is not null;

-- What this workspace already holds. Import reads it to know whether it is starting or
-- finishing something, and `api.delete_workspace`'s caller to know what it is about to lose.
create or replace function cloud.workspace_counts(p_workspace uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'cards', (select count(*) from cloud.workspace_cards where workspace_id = p_workspace),
    'documents', (select count(*) from cloud.workspace_documents where workspace_id = p_workspace),
    'events', (select count(*) from cloud.workspace_audit where workspace_id = p_workspace and import_key is not null),
    'deliveries', (select count(*) from cloud.workspace_deliveries where workspace_id = p_workspace)
  );
$$;
revoke all on function cloud.workspace_counts(uuid) from public;

-- Claim this workspace for one source board.
--
-- Refuses a workspace that already holds a board unless it holds THIS one: an import that
-- lost its reply, was interrupted halfway or is simply being run again finds its own work
-- and carries on, and an import pointed at somebody's live board is refused before it
-- overwrites a single card.
create or replace function api.begin_import(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_fingerprint text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace cloud.workspaces;
  v_counts json;
  v_fingerprint text := coalesce(nullif(trim(p_fingerprint), ''), '');
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  if v_fingerprint = '' then
    raise exception 'An import names no source board.' using errcode = 'AKB12';
  end if;

  v_counts := cloud.workspace_counts(p_workspace);
  if coalesce(v_workspace.import_fingerprint, '') <> v_fingerprint
     and ((v_counts ->> 'cards')::bigint > 0 or (v_counts ->> 'documents')::bigint > 0) then
    raise exception 'This workspace already holds a board. Import into a new one.'
      using errcode = 'AKB12';
  end if;

  if coalesce(v_workspace.import_fingerprint, '') = v_fingerprint then
    return json_build_object('workspaceId', p_workspace, 'fingerprint', v_fingerprint,
                             'resuming', true, 'held', v_counts);
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  update cloud.workspaces
     set import_fingerprint = v_fingerprint, imported_at = now(), revision = revision + 1,
         updated_at = now()
   where id = p_workspace;
  perform cloud.audit(p_workspace, p_subject, null, 'import.began', null,
                      json_build_object('fingerprint', v_fingerprint)::jsonb);
  return json_build_object('workspaceId', p_workspace, 'fingerprint', v_fingerprint,
                           'resuming', false, 'held', v_counts);
end;
$$;
revoke all on function api.begin_import(uuid, uuid, text, text, integer) from public;
grant execute on function api.begin_import(uuid, uuid, text, text, integer) to service_role;

-- The source board's own history, appended to the trail as it happened.
--
-- `p_events` is `[{"key": "17", "at": "2026-04-02", "action": "card-archived", "cardId": 3,
-- "detail": {…}}, …]` — a `record.csv` row each. Two things this does NOT do, both
-- deliberate:
--
--   • It invents no author. An imported event carries no account and no handle, because
--     nobody in this service did it: it happened on a machine, before the board was here.
--   • It does not re-date anything. The row keeps the day it was written, so the trail reads
--     as the board's history rather than as the afternoon it was uploaded.
--
-- `key` is the source row's own identity, prefixed here with the workspace's fingerprint so
-- two boards' rows can never be taken for each other. A key already on record is skipped,
-- which is the whole of "a retried import finds its own work".
create or replace function api.import_events(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_events jsonb,
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
  v_events jsonb := coalesce(p_events, '[]'::jsonb);
  v_added integer;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  if coalesce(v_workspace.import_fingerprint, '') = '' then
    raise exception 'No import has been begun on this workspace.' using errcode = 'AKB12';
  end if;
  if jsonb_typeof(v_events) <> 'array' or jsonb_array_length(v_events) = 0 then
    return json_build_object('added', 0);
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id, v_events);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, jsonb_array_length(v_events) + 1);

  with rows as (
    insert into cloud.workspace_audit (workspace_id, account_id, actor_handle, node_id,
                                       action, card_id, detail, at, import_key)
    select p_workspace, null, '', null,
           coalesce(e ->> 'action', 'imported'),
           nullif(e ->> 'cardId', '')::integer,
           coalesce(e -> 'detail', '{}'::jsonb),
           coalesce(nullif(e ->> 'at', '')::timestamptz, now()),
           v_workspace.import_fingerprint || ':' || (e ->> 'key')
    from jsonb_array_elements(v_events) e
    where coalesce(e ->> 'key', '') <> ''
    on conflict (workspace_id, import_key) where import_key is not null do nothing
    returning 1
  )
  select count(*) into v_added from rows;

  v_result := json_build_object('added', v_added);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.import_events(uuid, uuid, text, jsonb, integer) from public;
grant execute on function api.import_events(uuid, uuid, text, jsonb, integer) to service_role;

-- The source board's finished deliveries.
--
-- A delivery that already happened is not one to OPEN: it has a card, a body it was approved
-- to build, the runs it took and how it ended, and no machine is going to report on it. So it
-- arrives whole, in the state it ended in, rather than through the open-and-confirm pair a
-- live one goes through.
--
-- `source_id` is the id the source board gave it, which is what makes a retried pass find its
-- own work — the same job `import_key` does for the trail.
--
-- `p_deliveries` is `[{"sourceId": "2yfmw37a", "cardId": 3, "state": "completed",
-- "record": {…}, "approved": "…", "finalBody": "…"}, …]`.
create or replace function api.import_deliveries(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_deliveries jsonb,
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
  v_list jsonb := coalesce(p_deliveries, '[]'::jsonb);
  v_added integer;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  if coalesce(v_workspace.import_fingerprint, '') = '' then
    raise exception 'No import has been begun on this workspace.' using errcode = 'AKB12';
  end if;
  if jsonb_typeof(v_list) <> 'array' or jsonb_array_length(v_list) = 0 then
    return json_build_object('added', 0);
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id, v_list);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, jsonb_array_length(v_list) + 1);

  with rows as (
    insert into cloud.workspace_deliveries
      (workspace_id, card_id, node_id, state, record, approved, final_body, source_id)
    select p_workspace,
           coalesce(nullif(d ->> 'cardId', '')::integer, 0),
           null,
           case when (d ->> 'state') in ('completed', 'failed', 'cancelled') then d ->> 'state'
                else 'completed' end,
           cloud.portable_delivery(d -> 'record'),
           coalesce(d ->> 'approved', ''),
           coalesce(d ->> 'finalBody', ''),
           v_workspace.import_fingerprint || ':' || (d ->> 'sourceId')
    from jsonb_array_elements(v_list) d
    where coalesce(d ->> 'sourceId', '') <> ''
    on conflict (workspace_id, source_id) where source_id is not null do nothing
    returning 1
  )
  select count(*) into v_added from rows;

  v_result := json_build_object('added', v_added);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.import_deliveries(uuid, uuid, text, jsonb, integer) from public;
grant execute on function api.import_deliveries(uuid, uuid, text, jsonb, integer) to service_role;

-- The board is in. One event on the trail saying so, and what the workspace ended up
-- holding — which is what a client prints back to the person who ran it.
create or replace function api.finish_import(
  p_subject uuid,
  p_workspace uuid,
  p_op_id text,
  p_next_card_id integer,
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
  v_counts json;
begin
  v_workspace := cloud.workspace_for_update(p_subject, p_workspace);
  if coalesce(v_workspace.import_fingerprint, '') = '' then
    raise exception 'No import has been begun on this workspace.' using errcode = 'AKB12';
  end if;

  v_done := cloud.claim_operation(p_workspace, p_op_id,
                                  json_build_object('next', p_next_card_id)::jsonb);
  if v_done is not null then return v_done; end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  -- The source board's own next number, so the first card written after an import carries on
  -- where that board left off rather than reusing an id a rejected card once had.
  update cloud.workspaces
     set next_card_id = greatest(next_card_id, coalesce(p_next_card_id, 1)),
         revision = revision + 1, updated_at = now()
   where id = p_workspace
  returning * into v_workspace;
  v_counts := cloud.workspace_counts(p_workspace);
  perform cloud.audit(p_workspace, p_subject, null, 'import.finished', null, v_counts::jsonb);

  v_result := json_build_object('workspace', cloud.workspace_json(v_workspace), 'held', v_counts);
  perform cloud.record_operation(p_workspace, p_op_id, v_result);
  return v_result;
end;
$$;
revoke all on function api.finish_import(uuid, uuid, text, integer, integer) from public;
grant execute on function api.finish_import(uuid, uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Exporting the whole board back
-- ---------------------------------------------------------------------------
--
-- Everything a standalone markdown board is made of, in one read: the workspace's own
-- numbering, every card live and archived, every document, and the portable half of every
-- delivery. The trail comes through `api.export_events` beside it, oldest first and paged,
-- because it is the one part of a board with no natural bound.
--
-- This is the only copy anybody can restore a Cloud board from — the preview's free tiers
-- give no backups — so it reads the lot rather than the live board.
create or replace function api.export_board(p_subject uuid, p_workspace uuid)
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
    'workspace', cloud.workspace_json(v_workspace),
    'cards', coalesce((
      select json_agg(cloud.card_json(c) order by c.card_id)
      from cloud.workspace_cards c where c.workspace_id = p_workspace
    ), '[]'::json),
    'documents', coalesce((
      select json_agg(cloud.document_json(d) order by d.path)
      from cloud.workspace_documents d where d.workspace_id = p_workspace
    ), '[]'::json),
    'deliveries', coalesce((
      select json_agg(cloud.delivery_json(dl) order by dl.created_at)
      from cloud.workspace_deliveries dl where dl.workspace_id = p_workspace
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.export_board(uuid, uuid) from public;
grant execute on function api.export_board(uuid, uuid) to service_role;

-- The trail in the order it happened, from where the last page stopped. `api.read_audit`
-- reads it newest first because that is what a person opening the trail wants; an export
-- writes a file that is appended to, so it wants the other end.
create or replace function api.export_events(
  p_subject uuid,
  p_workspace uuid,
  p_after bigint,
  p_limit integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.workspace_for(p_subject, p_workspace);
  return coalesce((
    select json_agg(json_build_object(
      'id', e.id, 'accountId', e.account_id, 'handle', e.actor_handle, 'nodeId', e.node_id,
      'action', e.action, 'cardId', e.card_id, 'detail', e.detail, 'at', e.at,
      'importKey', e.import_key
    ) order by e.id)
    from (
      select * from cloud.workspace_audit
       where workspace_id = p_workspace and id > coalesce(p_after, 0)
       order by id
       limit least(greatest(coalesce(p_limit, 500), 1), 1000)
    ) e
  ), '[]'::json);
end;
$$;
revoke all on function api.export_events(uuid, uuid, bigint, integer) from public;
grant execute on function api.export_events(uuid, uuid, bigint, integer) to service_role;
