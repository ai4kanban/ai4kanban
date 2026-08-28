-- The board's server, and the requests it claims (#318).
--
-- #319 stored the event, the one action it carries, and how the delivery that action
-- started ended. All of that assumed the action was pressed on the machine holding the
-- board. This migration is what lets it be pressed anywhere: an action recorded as
-- `waiting_for_server` becomes one durable REQUEST, and the machine registered as that
-- board's server claims it, runs the flow locally and reports back.
--
-- Two tables:
--   • `board_servers`  — which machine runs a board's work. Exactly one enabled per board.
--   • `event_requests` — one claimable job per action taken somewhere else.
--
-- Cloud still learns nothing about where a board is. A server is a machine id the machine
-- minted and a name it calls itself; no path, no branch, no repository ever reaches here.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB05  another machine is already this board's server. A board attaches exactly one, so
--        the refusal names the machine that holds it and the move that takes it over.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per machine ever registered against a board. At most one of them is enabled:
-- that is the board's server, and it is the only machine that may claim the board's work.
--
-- A disabled row is kept rather than deleted, because a request it claimed and never
-- finished stays bound to it — the user cancels that one; no other server may take it up.
create table cloud.board_servers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  board_id uuid not null references cloud.boards (id) on delete cascade,
  -- What the MACHINE calls itself, minted there and held in `~/.ai4kanban/machine.json`.
  -- Opaque here: only equality is ever read into it.
  machine_id uuid not null,
  -- The name a person recognises that machine by — its hostname. Never an address.
  machine_name text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, machine_id)
);
-- "A board attaches exactly one server" as a property of the table rather than a check
-- somebody has to remember. Partial, so the machines a move disabled keep their rows.
create unique index board_servers_one_enabled on cloud.board_servers (board_id) where enabled;
create index board_servers_owner on cloud.board_servers (owner_id);
alter table cloud.board_servers enable row level security;

-- One claimable job per action taken somewhere other than the board's own machine.
--
-- Unique on `event_id`, which is what makes "one action, one request, one execution" a
-- property of the table: a retried action finds the request already there rather than
-- raising a second.
--
-- `server_id` is who it was raised FOR; `claimed_by` is who took it. They differ after a
-- move: a request the old machine never claimed is picked up by the new one, and a request
-- it claimed and left is bound to it for good.
create table cloud.event_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  board_id uuid not null references cloud.boards (id) on delete cascade,
  event_id uuid not null unique references cloud.events (id) on delete cascade,
  server_id uuid references cloud.board_servers (id) on delete set null,
  claimed_by uuid references cloud.board_servers (id) on delete set null,
  state text not null default 'waiting' check (state in ('waiting', 'claimed', 'finished')),
  -- How long the claim holds. Past it the claim reads as interrupted wherever it is read,
  -- because a killed server reports nothing and Cloud runs no sweep.
  lease_expires_at timestamptz,
  -- Why it ended, when it ended badly. Carried onto the event's `failed` outcome so a
  -- refused approval and a broken build never read as the same thing.
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_requests_live on cloud.event_requests (board_id) where state <> 'finished';
alter table cloud.event_requests enable row level security;

-- ---------------------------------------------------------------------------
-- What an expired lease means
-- ---------------------------------------------------------------------------
--
-- Interruption is DERIVED, never stored: a killed server reports nothing, so a state
-- nobody works out is a state nobody ever sees. It is read here, and it reaches the
-- event's own state through `cloud.event_json` below — the bell and Slack render the
-- event, not the request.

create or replace function cloud.request_interrupted(p_request cloud.event_requests)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_request.state = 'claimed'
     and p_request.lease_expires_at is not null
     and p_request.lease_expires_at < now();
$$;
revoke all on function cloud.request_interrupted(cloud.event_requests) from public;

-- The event as every surface reads it, with one line added to #319's: an event whose
-- request's lease has run out reads `interrupted` however it was last written.
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
    'state', case
      when p_event.state in ('waiting_for_server', 'running')
       and exists (
         select 1 from cloud.event_requests r
          where r.event_id = p_event.id and cloud.request_interrupted(r)
       )
      then 'interrupted'
      else p_event.state
    end,
    'questions', p_event.questions,
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- The server's own private Realtime topic
-- ---------------------------------------------------------------------------
--
-- `server:<server id>`, and this policy is the whole of its authorization: a socket may
-- receive on a server row of its own account and no other. #319 left this to the row this
-- card introduces — there was nothing to scope a policy to until now.
--
-- Unlike the account topic, EVERY enabled board's server listens on its own, backgrounded
-- ones included: a request is addressed to one board's server, so a second listener cannot
-- duplicate anything, and the board a user has switched away from is exactly the one whose
-- approval would otherwise never run.

create policy "a server receives its own broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.messages.extension) = 'broadcast'
    and realtime.topic() like 'server:%'
    and exists (
      select 1 from cloud.board_servers s
      where s.id::text = substring(realtime.topic() from 8)
        and s.owner_id = (select auth.uid())
        and s.enabled
    )
  );

-- Say a request moved, to the server it belongs to. Called inside the same transaction as
-- the write it reports, like #319's `cloud.hint`, and swallowing its own failure for the
-- same reason: the catch-up read on every start and reconnect is what makes the durable
-- write enough on its own.
create or replace function cloud.hint_server(p_server uuid, p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_server is null then return; end if;
  perform realtime.send(
    json_build_object('requestId', p_request::text)::jsonb,
    'request',
    'server:' || p_server::text,
    true
  );
exception when others then
  null;
end;
$$;
revoke all on function cloud.hint_server(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- What a server and a request look like on the wire
-- ---------------------------------------------------------------------------

create or replace function cloud.server_json(p_server cloud.board_servers)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_server.id,
    'boardId', p_server.board_id,
    'machineId', p_server.machine_id,
    'machineName', p_server.machine_name,
    'enabled', p_server.enabled
  );
$$;
revoke all on function cloud.server_json(cloud.board_servers) from public;

-- A request, with everything the server needs to run it and nothing else: which card, which
-- revision it was approved against, what was decided, and the answers an answer carried.
create or replace function cloud.request_json(p_request cloud.event_requests)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_request.id,
    'boardId', p_request.board_id,
    'eventId', p_request.event_id,
    'serverId', p_request.server_id,
    'claimedBy', p_request.claimed_by,
    'state', case when cloud.request_interrupted(p_request) then 'interrupted' else p_request.state end,
    'leaseExpiresAt', p_request.lease_expires_at,
    'taskId', e.task_id,
    'taskTitle', e.task_title,
    'revision', a.revision,
    'decision', a.decision,
    'answers', a.answers,
    'questions', e.questions
  )
  from cloud.events e
  join cloud.event_actions a on a.event_id = e.id
  where e.id = p_request.event_id;
$$;
revoke all on function cloud.request_json(cloud.event_requests) from public;

-- ---------------------------------------------------------------------------
-- Registering a machine as a board's server
-- ---------------------------------------------------------------------------

-- Attach this machine. Idempotent for the machine already holding the board.
--
-- A second machine is REFUSED rather than routed to, and the refusal names the one that
-- holds it — a board's work runs in one repository, and handing it to another machine would
-- rerun a build on a checkout the first one may already have written to. `p_take_over` is
-- the user saying, on purpose, that the machine in front of them is the board's server now:
-- it disables the old row, whose unfinished claims can then only be cancelled.
create or replace function api.attach_server(
  p_subject uuid,
  p_board uuid,
  p_machine uuid,
  p_machine_name text,
  p_take_over boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_holder cloud.board_servers;
  v_mine cloud.board_servers;
begin
  select * into v_board from cloud.boards where id = p_board;
  if v_board.id is null then return null; end if;
  perform cloud.require_owner(v_board.owner_id, p_subject);

  select * into v_holder from cloud.board_servers
   where board_id = p_board and enabled and machine_id is distinct from p_machine;
  if v_holder.id is not null then
    if not coalesce(p_take_over, false) then
      raise exception 'This board already runs its work on %.',
        coalesce(nullif(v_holder.machine_name, ''), 'another machine')
        using errcode = 'AKB05';
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.board_servers set enabled = false, updated_at = now() where id = v_holder.id;
  end if;

  select * into v_mine from cloud.board_servers
   where board_id = p_board and machine_id = p_machine;
  if v_mine.id is not null then
    if v_mine.enabled and v_mine.machine_name = p_machine_name then
      return cloud.server_json(v_mine);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.board_servers
       set enabled = true, machine_name = p_machine_name, updated_at = now()
     where id = v_mine.id
    returning * into v_mine;
    return cloud.server_json(v_mine);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.board_servers (owner_id, board_id, machine_id, machine_name)
  values (v_board.owner_id, p_board, p_machine, coalesce(p_machine_name, ''))
  returning * into v_mine;
  return cloud.server_json(v_mine);
end;
$$;
revoke all on function api.attach_server(uuid, uuid, uuid, text, boolean, integer) from public;
grant execute on function api.attach_server(uuid, uuid, uuid, text, boolean, integer) to service_role;

-- Stop this machine running a board's work. The local board is untouched: a delivery
-- already going finishes where it is, while its request reads interrupted once the lease
-- it stops renewing runs out.
create or replace function api.detach_server(
  p_subject uuid,
  p_board uuid,
  p_machine uuid,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
begin
  select * into v_server from cloud.board_servers
   where board_id = p_board and machine_id = p_machine;
  if v_server.id is null then return null; end if;
  perform cloud.require_owner(v_server.owner_id, p_subject);
  if not v_server.enabled then return cloud.server_json(v_server); end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.board_servers set enabled = false, updated_at = now()
   where id = v_server.id
  returning * into v_server;
  return cloud.server_json(v_server);
end;
$$;
revoke all on function api.detach_server(uuid, uuid, uuid, integer) from public;
grant execute on function api.detach_server(uuid, uuid, uuid, integer) to service_role;

-- Which machine runs each of this account's boards. One read, so the Cloud section and
-- `akb cloud` both name the holder without a call per board.
create or replace function api.list_servers(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.server_json(s)), '[]'::json)
  from cloud.board_servers s
  where s.owner_id = p_subject and s.enabled;
$$;
revoke all on function api.list_servers(uuid) from public;
grant execute on function api.list_servers(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The requests a server claims
-- ---------------------------------------------------------------------------

-- Raise the request an action taken somewhere else needs. Called from
-- `api.record_event_action` below, inside that action's own transaction, so one action can
-- never leave two requests or none.
create or replace function cloud.raise_request(
  p_owner uuid,
  p_board uuid,
  p_event uuid
) returns cloud.event_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server uuid;
  v_request cloud.event_requests;
begin
  select id into v_server from cloud.board_servers where board_id = p_board and enabled;
  insert into cloud.event_requests (owner_id, board_id, event_id, server_id)
  values (p_owner, p_board, p_event, v_server)
  on conflict (event_id) do nothing
  returning * into v_request;
  if v_request.id is null then
    select * into v_request from cloud.event_requests where event_id = p_event;
  end if;
  perform cloud.hint_server(v_server, v_request.id);
  return v_request;
end;
$$;
revoke all on function cloud.raise_request(uuid, uuid, uuid) from public;

-- #319's action, with one line added: an action taken somewhere other than the board's own
-- machine leaves a claimable request behind it. An `accepted` one is already running there
-- and never becomes one.
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

  if p_state = 'waiting_for_server' then
    perform cloud.count_write(p_daily_write_budget);
    perform cloud.raise_request(v_event.owner_id, v_event.board_id, v_event.id);
  end if;

  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) from public;
grant execute on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) to service_role;

-- What this server has to do: the requests raised for it, and the ones it claimed and has
-- not finished. A read, so a reconnect storm costs the day's budget nothing.
--
-- A request the board's server never claimed is listed for whichever machine is the board's
-- server NOW, which is what lets a move pick up work the old machine never started. One it
-- claimed stays listed for that machine alone.
create or replace function api.list_requests(p_subject uuid, p_server uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null then return '[]'::json; end if;
  perform cloud.require_owner(v_server.owner_id, p_subject);
  if not v_server.enabled then return '[]'::json; end if;

  return coalesce((
    select json_agg(cloud.request_json(r) order by r.created_at)
    from cloud.event_requests r
    where r.board_id = v_server.board_id
      and r.state <> 'finished'
      and (r.claimed_by is null or r.claimed_by = v_server.id)
  ), '[]'::json);
end;
$$;
revoke all on function api.list_requests(uuid, uuid) from public;
grant execute on function api.list_requests(uuid, uuid) to service_role;

-- Take one request, or say why not.
--
-- It answers rather than raising, because the caller acts on the reason: a request it may
-- not have is one it reports `failed` against with those words, and a refused approval and
-- a broken build must never read as the same outcome.
--
-- The same server re-claiming one it left interrupted is a RESUME, not a second claim: the
-- delivery is already on that machine, and this is the machine coming back to it.
create or replace function api.claim_request(
  p_subject uuid,
  p_server uuid,
  p_request uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
  v_request cloud.event_requests;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null then
    return json_build_object('claimed', false, 'reason', 'This machine is not a server for that board.');
  end if;
  perform cloud.require_owner(v_server.owner_id, p_subject);
  if not v_server.enabled then
    return json_build_object('claimed', false, 'reason', 'This machine no longer runs that board’s work.');
  end if;

  select * into v_request from cloud.event_requests where id = p_request for update;
  if v_request.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such request.');
  end if;
  perform cloud.require_owner(v_request.owner_id, p_subject);
  if v_request.board_id <> v_server.board_id then
    return json_build_object('claimed', false, 'reason', 'That request belongs to another board.');
  end if;
  if v_request.state = 'finished' then
    return json_build_object('claimed', false, 'reason', 'That request has already been dealt with.');
  end if;
  -- Claimed, alive and somebody's: another machine's, or this one's own live claim. Either
  -- way it must not be started a second time.
  if v_request.state = 'claimed' and not cloud.request_interrupted(v_request) then
    return json_build_object('claimed', false, 'reason', 'That request is already running.');
  end if;
  -- Interrupted, and bound to the machine that claimed it. Only that machine may take it
  -- up again; for anybody else it is a cancellation.
  if v_request.claimed_by is not null and v_request.claimed_by <> v_server.id then
    return json_build_object('claimed', false, 'reason', 'That request is held by another machine.');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.event_requests
     set state = 'claimed',
         claimed_by = v_server.id,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_request
  returning * into v_request;
  return json_build_object('claimed', true, 'request', cloud.request_json(v_request));
end;
$$;
revoke all on function api.claim_request(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.claim_request(uuid, uuid, uuid, integer, integer) to service_role;

-- Hold the claim for as long as the delivery is live on that machine. One write, on a
-- cadence measured in minutes: the whole service shares one daily write budget, so a
-- delivery running for hours must cost tens of these rather than thousands.
create or replace function api.renew_claim(
  p_subject uuid,
  p_server uuid,
  p_request uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server cloud.board_servers;
  v_request cloud.event_requests;
begin
  select * into v_server from cloud.board_servers where id = p_server;
  if v_server.id is null or not v_server.enabled then
    return json_build_object('renewed', false);
  end if;
  perform cloud.require_owner(v_server.owner_id, p_subject);

  select * into v_request from cloud.event_requests where id = p_request;
  if v_request.id is null then return json_build_object('renewed', false); end if;
  perform cloud.require_owner(v_request.owner_id, p_subject);
  if v_request.state <> 'claimed' or v_request.claimed_by <> v_server.id then
    return json_build_object('renewed', false);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.event_requests
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_request
  returning * into v_request;
  return json_build_object('renewed', true, 'request', cloud.request_json(v_request));
end;
$$;
revoke all on function api.renew_claim(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.renew_claim(uuid, uuid, uuid, integer, integer) to service_role;

-- #319's outcome, with the request ended in the same transaction.
--
-- One call, not two: the delivery's state and the job's are the same fact, and reporting
-- them apart would leave a completed delivery holding a claim nobody would ever release.
-- `running` renews the lease instead — a server that is reporting is a server that is alive.
create or replace function api.record_event_outcome(
  p_subject uuid,
  p_op_id text,
  p_event uuid,
  p_outcome text,
  p_reason text,
  p_lease_seconds integer,
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

  update cloud.event_requests
     set state = case when p_outcome = 'running' then state else 'finished' end,
         lease_expires_at = case
           when p_outcome = 'running'
           then now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60))
           else lease_expires_at
         end,
         reason = coalesce(nullif(p_reason, ''), reason),
         updated_at = now()
   where event_id = p_event and state <> 'finished';

  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) from public;
grant execute on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) to service_role;

-- #319's five-argument outcome is replaced by the one above. Dropped rather than left
-- beside it: two functions of one name would leave PostgREST choosing between them.
drop function if exists api.record_event_outcome(uuid, text, uuid, text, integer);

-- ---------------------------------------------------------------------------
-- The sweep
-- ---------------------------------------------------------------------------
--
-- A request goes with the event it belongs to — `on delete cascade` — so #319's sweep is
-- the whole of the retention this card adds.
