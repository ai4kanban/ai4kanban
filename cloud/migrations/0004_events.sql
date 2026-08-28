-- Durable events, the connector deliveries they fan out to, the one human action each may
-- carry, and how the delivery that action started ended (#319).
--
-- Four tables and not one, because any stage has to retry without duplicating another: a
-- Slack delivery that failed is retried while the action stands, an action stands while its
-- outcome is still coming, and the event outlives all of them. Every row hangs off
-- `cloud.accounts (id)` like #314 said it would, and nothing here is reachable outside `api`
-- — see 0001 for why that is a property of the project rather than a rule each migration
-- remembers.
--
-- The board is an opaque id the MACHINE minted. Cloud never learns where that board is: the
-- mapping from this id to a local path is held in `~/.ai4kanban/boards.json` and nowhere
-- else.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB03  the revision an action names has moved, so the card it was granted against is not
--        the card on the board any more. Cloud may reject one it already knows is stale;
--        the local check is still the final one.
-- AKB04  an action is already on record. Exactly one per event, whichever surface took it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per board its owner turned notifications on for.
create table cloud.boards (
  id uuid primary key,
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  -- What to call it in a bell that carries more than one. The folder's own name; never a
  -- path.
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_owner on cloud.boards (owner_id);
alter table cloud.boards enable row level security;

-- One row per task a board is holding actionable. `(board_id, task_id)` is unique on
-- purpose: one task means one row, so a card revised twice before anyone looks refreshes
-- the same event rather than leaving three asking about revisions two of them no longer
-- bind.
create table cloud.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  board_id uuid not null references cloud.boards (id) on delete cascade,
  task_id integer not null,
  task_title text not null,
  release text not null default '',
  -- The card revision this event binds. Opaque to Cloud — only equality is ever read into
  -- it.
  revision text not null,
  kind text not null check (kind in ('ready_for_review', 'question')),
  decision text not null check (decision in ('implement', 'answer')),
  -- Every user-owned question with its options and recommendation, and no other part of the
  -- card. The board's internal tags are stripped before they get here.
  questions jsonb not null default '[]'::jsonb,
  -- What the publisher last sent, so a snapshot that has not moved costs no write and
  -- interrupts nobody.
  fingerprint text not null,
  state text not null default 'actionable' check (state in (
    'actionable', 'accepted', 'waiting_for_server', 'running',
    'completed', 'failed', 'stale', 'cancelled', 'interrupted'
  )),
  created_at timestamptz not null default now(),
  -- The event's newest change. The bell orders its rows by this, and a row goes unread
  -- again when it moves.
  changed_at timestamptz not null default now(),
  -- When it reached a final outcome. Null while it is live work, which is kept however old
  -- it is.
  finished_at timestamptz
);
create index events_owner_changed on cloud.events (owner_id, changed_at desc);
create index events_finished on cloud.events (finished_at) where finished_at is not null;

-- One task means one LIVE row, and the rows a delivery finished stay behind it as history.
--
-- A partial index rather than a plain unique constraint, because both halves of that
-- sentence matter: a card revised twice before anyone looks must not leave three rows
-- asking about revisions two of them no longer bind, AND a task whose delivery finished and
-- which later needs a person again is new work — reusing that row would erase the week's
-- history the bell is meant to be able to look back over.
create unique index events_one_live_per_task
  on cloud.events (board_id, task_id)
  where finished_at is null;
alter table cloud.events enable row level security;

-- Where one event was sent, per connector. #320 writes Slack's rows; the desktop needs
-- none, because it reads the event itself. Kept apart from the event so a delivery retried
-- under the same stable id never rewrites the event it delivers.
create table cloud.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cloud.events (id) on delete cascade,
  connector text not null,
  state text not null default 'pending' check (state in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  -- What the connector calls the message it left — a Slack `ts`, say.
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, connector)
);
alter table cloud.event_deliveries enable row level security;

-- The ONE action an event may carry, whichever surface took it. Unique on `event_id`, which
-- is what makes "record exactly one, refuse a second" a property of the table rather than a
-- check somebody has to remember.
create table cloud.event_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references cloud.events (id) on delete cascade,
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  -- Which surface it came from. `desktop` today; #320 adds `slack`.
  actor text not null default 'desktop',
  decision text not null check (decision in ('implement', 'answer')),
  -- The revision it was granted against. A local server re-reads the card and checks this
  -- before anything runs (#318).
  revision text not null,
  -- One entry per question the event carried, blanks included: a ticked option, the user's
  -- own words, or neither. Never a tick and words together, which is the board's own rule.
  answers jsonb not null default '[]'::jsonb,
  -- The attempt that recorded it, so a retry is recognised rather than refused as a second
  -- action.
  op_id text not null unique,
  created_at timestamptz not null default now()
);
alter table cloud.event_actions enable row level security;

-- How the delivery an action started ended, recorded independently of the action so either
-- can retry without duplicating the other.
create table cloud.event_outcomes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cloud.events (id) on delete cascade,
  outcome text not null check (outcome in (
    'running', 'completed', 'failed', 'cancelled', 'interrupted'
  )),
  op_id text not null unique,
  created_at timestamptz not null default now()
);
create index event_outcomes_event on cloud.event_outcomes (event_id);
alter table cloud.event_outcomes enable row level security;

-- ---------------------------------------------------------------------------
-- The account's private Realtime topic
-- ---------------------------------------------------------------------------
--
-- Realtime carries HINTS: the id of something already stored. Every durable read and write
-- goes through the Worker, so a missed or reordered broadcast loses nothing.
--
-- The topic is `account:<subject>`, and the policy below is the whole of its authorization:
-- a socket may join and receive on its own account's topic and no other. #318 adds the
-- server's topic with the server row it introduces — there is nothing to scope a policy to
-- until then.

create policy "an account receives its own broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.messages.extension) = 'broadcast'
    and realtime.topic() = 'account:' || (select auth.uid())::text
  );

-- Say an event moved, to whoever is listening on that account. Called inside the same
-- transaction as the write it reports, so a hint never runs ahead of what it points at.
create or replace function cloud.hint(p_owner uuid, p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    json_build_object('eventId', p_event::text)::jsonb,
    'event',
    'account:' || p_owner::text,
    true
  );
exception when others then
  -- A hint is an optimisation. The catch-up read on every connect is what makes the durable
  -- write enough on its own, so a Realtime that is having a bad minute must not roll back
  -- the event it was going to announce.
  null;
end;
$$;
revoke all on function cloud.hint(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- What one event looks like on the wire
-- ---------------------------------------------------------------------------

create or replace function cloud.event_json(p_event cloud.events)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_event.id,
    'boardId', p_event.board_id,
    'boardName', coalesce((select b.name from cloud.boards b where b.id = p_event.board_id), ''),
    'taskId', p_event.task_id,
    'taskTitle', p_event.task_title,
    'release', p_event.release,
    'revision', p_event.revision,
    'kind', p_event.kind,
    'decision', p_event.decision,
    'state', p_event.state,
    'questions', p_event.questions,
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- Functions the Worker calls
-- ---------------------------------------------------------------------------

-- Register a board under the id the machine minted. Idempotent: turning a board's
-- notifications off and on again keeps its id, so its events are never orphaned.
create or replace function api.register_board(
  p_subject uuid,
  p_board uuid,
  p_name text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_known cloud.boards;
begin
  select * into v_known from cloud.boards where id = p_board;
  if v_known.id is not null then
    perform cloud.require_owner(v_known.owner_id, p_subject);
    if v_known.name is distinct from p_name then
      perform cloud.count_write(p_daily_write_budget);
      update cloud.boards set name = p_name, updated_at = now() where id = p_board;
    end if;
    return json_build_object('boardId', p_board);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, p_name);
  return json_build_object('boardId', p_board);
end;
$$;
revoke all on function api.register_board(uuid, uuid, text, integer) from public;
grant execute on function api.register_board(uuid, uuid, text, integer) to service_role;

-- Store or refresh one event.
--
-- Three endings, and only one of them writes:
--   • nothing on record          → the event is raised
--   • on record and unchanged    → nothing is written and nobody is interrupted
--   • on record and moved        → the SAME row is refreshed in place, so one task keeps
--                                  one row and the user is not told twice about one piece
--                                  of work
-- An event somebody has already acted on is not refreshed: the revision it bound is the one
-- the action was granted against.
create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_task_id integer,
  p_task_title text,
  p_release text,
  p_revision text,
  p_kind text,
  p_decision text,
  p_questions jsonb,
  p_fingerprint text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
    select * into v_board from cloud.boards where id = p_board;
  end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  -- The row this task's event should go on.
  --
  -- The live one, or — failing that — one retired as `stale` that nobody ever acted on.
  -- `stale` means "not waiting on anybody right now", not "over": a Resolve rewrites a card
  -- through more than one board write, so a task can leave `ready` and come straight back,
  -- and the user must see ONE row turn from the question into the approval rather than a
  -- retired row and a second one beside it.
  --
  -- A row with an action on record is never reused. That one is history — a delivery really
  -- happened against it — and the bell's 30 days are what it is for.
  select * into v_event
  from cloud.events e
  where e.board_id = p_board
    and e.task_id = p_task_id
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    -- The same piece of work, unchanged. Not a write, and nobody to interrupt.
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      return cloud.event_json(v_event);
    end if;
    -- Live work somebody already acted on is a delivery's to report, not a publication's to
    -- refresh: the revision it bound is the one the action was granted against.
    if v_event.state <> 'actionable' and v_event.state <> 'stale' then
      return cloud.event_json(v_event);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.events
       set task_title = p_task_title,
           release = p_release,
           revision = p_revision,
           kind = p_kind,
           decision = p_decision,
           questions = coalesce(p_questions, '[]'::jsonb),
           fingerprint = p_fingerprint,
           state = 'actionable',
           finished_at = null,
           changed_at = now()
     where id = v_event.id
    returning * into v_event;
    perform cloud.hint(p_subject, v_event.id);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, task_id, task_title, release, revision, kind, decision,
    questions, fingerprint
  ) values (
    p_subject, p_board, p_task_id, p_task_title, coalesce(p_release, ''), p_revision,
    p_kind, p_decision, coalesce(p_questions, '[]'::jsonb), p_fingerprint
  )
  returning * into v_event;
  perform cloud.hint(p_subject, v_event.id);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, integer) from public;
grant execute on function api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, integer) to service_role;

-- The durable catch-up read: every event of this account that is still live, and the
-- finished ones still inside their retention window, so the bell can look back over a
-- week's work. No write, so a reconnect storm costs the day's budget nothing.
create or replace function api.list_events(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.event_json(e) order by e.changed_at desc), '[]'::json)
  from cloud.events e
  where e.owner_id = p_subject;
$$;
revoke all on function api.list_events(uuid) from public;
grant execute on function api.list_events(uuid) to service_role;

-- One event, which is how a Realtime hint is resolved: the id travels over the socket and
-- what it now says is read from Postgres.
create or replace function api.read_event(p_subject uuid, p_event uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_owner(v_event.owner_id, p_subject);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.read_event(uuid, uuid) from public;
grant execute on function api.read_event(uuid, uuid) to service_role;

-- Retire an event whose task stopped being one its board raises events for. Refused for one
-- with an action on record: that event has a delivery to report on, and `stale` is for an
-- event no delivery ever started.
create or replace function api.retire_event(
  p_subject uuid,
  p_event uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_owner(v_event.owner_id, p_subject);
  if v_event.state <> 'actionable'
     or exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.events
     set state = 'stale', changed_at = now(), finished_at = now()
   where id = p_event
  returning * into v_event;
  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.retire_event(uuid, uuid, integer) from public;
grant execute on function api.retire_event(uuid, uuid, integer) to service_role;

-- Record the one action an event carries.
--
-- The retry of an attempt already on record answers with the event as it stands, so a
-- publisher that lost the reply is never told it acted twice. A genuine second action is
-- refused with AKB04, and one against a revision that has moved with AKB03.
create or replace function api.record_event_action(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_decision text,
  p_revision text,
  p_answers jsonb,
  p_state text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
  v_action cloud.event_actions;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_owner(v_event.owner_id, p_subject);

  select * into v_action from cloud.event_actions where op_id = p_op_id;
  if v_action.id is not null then return cloud.event_json(v_event); end if;

  if exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    raise exception 'That event has already been answered.' using errcode = 'AKB04';
  end if;
  if v_event.revision is distinct from p_revision then
    raise exception 'That task has changed since this was asked.' using errcode = 'AKB03';
  end if;
  if v_event.state <> 'actionable' then
    raise exception 'That event is no longer waiting for anybody.' using errcode = 'AKB03';
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_actions (event_id, owner_id, decision, revision, answers, op_id)
  values (p_event, p_subject, p_decision, p_revision, coalesce(p_answers, '[]'::jsonb), p_op_id);

  update cloud.events
     set state = case when p_state = 'waiting_for_server' then 'waiting_for_server' else 'accepted' end,
         changed_at = now()
   where id = p_event
  returning * into v_event;
  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) from public;
grant execute on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) to service_role;

-- Where the delivery that action started has got to. Only an event with an action on record
-- has anything to report against.
create or replace function api.record_event_outcome(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_outcome text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_owner(v_event.owner_id, p_subject);
  if exists (select 1 from cloud.event_outcomes o where o.op_id = p_op_id) then
    return cloud.event_json(v_event);
  end if;
  if not exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_outcomes (event_id, outcome, op_id) values (p_event, p_outcome, p_op_id);
  update cloud.events
     set state = p_outcome,
         changed_at = now(),
         finished_at = case when p_outcome = 'running' then null else now() end
   where id = p_event
  returning * into v_event;
  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_outcome(uuid, text, uuid, text, integer) from public;
grant execute on function api.record_event_outcome(uuid, text, uuid, text, integer) to service_role;

-- Record where one connector's delivery of an event stands. #320's, written here so the
-- three stages are independent from the first migration that has any of them.
create or replace function api.record_event_delivery(
  p_subject uuid,
  p_event uuid,
  p_connector text,
  p_state text,
  p_external_ref text,
  p_last_error text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event cloud.events;
begin
  select * into v_event from cloud.events where id = p_event;
  if v_event.id is null then return null; end if;
  perform cloud.require_owner(v_event.owner_id, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (event_id, connector, state, attempts, external_ref, last_error)
  values (p_event, p_connector, p_state, 1, p_external_ref, p_last_error)
  on conflict (event_id, connector) do update
    set state = excluded.state,
        attempts = d.attempts + 1,
        external_ref = coalesce(excluded.external_ref, d.external_ref),
        last_error = excluded.last_error,
        updated_at = now();
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_delivery(uuid, uuid, text, text, text, text, integer) from public;
grant execute on function api.record_event_delivery(uuid, uuid, text, text, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------
--
-- An event is kept while it is unresolved, and for 30 days after it reaches a final
-- outcome. Deleting it takes its deliveries, its action and its outcome with it — the
-- foreign keys cascade — which is what the published privacy page promises.
--
-- A step in the hourly run rather than a schedule of its own, and deliberately outside the
-- daily write budget like the heartbeat: a busy day must not switch off the sweep that
-- frees space.

create or replace function api.sweep_events()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from cloud.events
   where finished_at is not null
     and finished_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return json_build_object('deleted', v_deleted);
end;
$$;
revoke all on function api.sweep_events() from public;
grant execute on function api.sweep_events() to service_role;
