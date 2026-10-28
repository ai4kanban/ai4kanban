-- A card's live decision belongs to the workspace it is in (#364).
--
-- #319 keyed an event to `cloud.boards` — a row a machine mints per checkout path and stamps
-- with one account. Two things fall out of that, and this migration is both of them:
--
--   • one owner opening a workspace on two machines raises TWO live events for one card,
--     because each checkout minted its own board id;
--   • a browser knows a workspace id and nothing else, so a hosted card page has no way to
--     find the decision the card is waiting on.
--
-- So an event, its execution request and a card's chat message each name a board OR a
-- workspace, never both — the shape #315 already gave `cloud.board_servers`. 0.8.0's
-- board-kept events keep their board and their one account, with nothing about them changed.
--
-- What a workspace event changes beyond its home:
--   • authorization is `cloud.require_member` (#376) rather than the owner comparison, so a
--     teammate reads and answers the same one event;
--   • the request an action raises is addressed to NO node, and any of the workspace's live
--     machines may claim it — a board attaches one server, a workspace has as many machines
--     as its members register.
--
-- How an event is rendered, delivered and settled is untouched: the bell, Slack and Lark read
-- `cloud.event_json` exactly as they do now.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.events
  alter column board_id drop not null,
  add column workspace_id uuid references cloud.workspaces (id) on delete cascade,
  add constraint events_one_home check (num_nonnulls(board_id, workspace_id) = 1);
create index events_workspace on cloud.events (workspace_id) where workspace_id is not null;

-- "One task means one LIVE row" per home. #319's index is split rather than widened: a unique
-- index treats NULLs as distinct, so leaving it on `(board_id, task_id)` alone would let a
-- workspace card raise a row per publishing machine — the very thing this migration removes.
drop index if exists cloud.events_one_live_per_task;
create unique index events_one_live_per_task
  on cloud.events (board_id, task_id)
  where board_id is not null and finished_at is null;
create unique index events_one_live_per_workspace_task
  on cloud.events (workspace_id, task_id)
  where workspace_id is not null and finished_at is null;

alter table cloud.event_requests
  alter column board_id drop not null,
  add column workspace_id uuid references cloud.workspaces (id) on delete cascade,
  add constraint event_requests_one_home check (num_nonnulls(board_id, workspace_id) = 1);
create index event_requests_workspace_live
  on cloud.event_requests (workspace_id)
  where workspace_id is not null and state <> 'finished';

-- The card's chat message follows the card, so it follows the card's home (#359).
alter table cloud.card_messages
  alter column board_id drop not null,
  add column workspace_id uuid references cloud.workspaces (id) on delete cascade,
  add constraint card_messages_one_home check (num_nonnulls(board_id, workspace_id) = 1);
create unique index card_messages_one_per_workspace_card
  on cloud.card_messages (workspace_id, task_id, connector)
  where workspace_id is not null;

-- ---------------------------------------------------------------------------
-- Who may read and answer an event
-- ---------------------------------------------------------------------------

-- One check in front of every event route, so widening membership cannot be forgotten on one
-- of them. A board event is its owner's, exactly as #319 wrote it; a workspace event is every
-- member's, and a workspace that is not the caller's and one that was deleted meet the same
-- refusal (#376).
create or replace function cloud.require_event_reader(p_event cloud.events, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_event.workspace_id is not null then
    perform cloud.require_member(p_event.workspace_id, p_subject);
  else
    perform cloud.require_owner(p_event.owner_id, p_subject);
  end if;
end;
$$;
revoke all on function cloud.require_event_reader(cloud.events, uuid) from public;

-- The same check in front of a node: this workspace's, or this board's owner's. A workspace
-- node attributes rather than gates (#376), so a teammate's machine may claim its work.
create or replace function cloud.require_node_reader(p_node cloud.board_servers, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_node.workspace_id is not null then
    perform cloud.require_member(p_node.workspace_id, p_subject);
  else
    perform cloud.require_owner(p_node.owner_id, p_subject);
  end if;
end;
$$;
revoke all on function cloud.require_node_reader(cloud.board_servers, uuid) from public;

-- And the same in front of a request. A board's request is its owner's, exactly as 0005 had
-- it; a workspace's is any member's, so a teammate's machine may take it up.
create or replace function cloud.require_request_reader(p_request cloud.event_requests, p_subject uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_request.workspace_id is not null then
    perform cloud.require_member(p_request.workspace_id, p_subject);
  else
    perform cloud.require_owner(p_request.owner_id, p_subject);
  end if;
end;
$$;
revoke all on function cloud.require_request_reader(cloud.event_requests, uuid) from public;

-- ---------------------------------------------------------------------------
-- The event on the wire
-- ---------------------------------------------------------------------------

-- 0019's, plus the workspace an event may belong to. `boardId` is empty on a workspace event
-- rather than absent, so every surface reading it keeps one shape; `boardName` is what the
-- board is CALLED either way, which for a workspace event is the workspace's own name.
--
-- `serverName` names what the decision is waiting for. A board has one server; a workspace has
-- as many machines as its members registered, so a live one is named — and where none is live
-- the name is empty, which is what every surface already draws as *waiting for a machine*.
create or replace function cloud.event_json(p_event cloud.events)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_event.id,
    'boardId', coalesce(p_event.board_id::text, ''),
    'workspaceId', coalesce(p_event.workspace_id::text, ''),
    'boardName', coalesce(
      (select b.name from cloud.boards b where b.id = p_event.board_id),
      (select w.name from cloud.workspaces w where w.id = p_event.workspace_id),
      ''
    ),
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
    'summary', p_event.summary,
    'notes', p_event.notes,
    'reason', p_event.reason,
    'serverName', coalesce(
      (select s.machine_name from cloud.board_servers s
        where s.board_id = p_event.board_id and s.enabled
        limit 1),
      (select coalesce(nullif(s.node_name, ''), s.machine_name) from cloud.board_servers s
        where s.workspace_id = p_event.workspace_id
          and s.removed_at is null
          and s.enabled
          and s.lease_expires_at is not null
          and s.lease_expires_at > now()
        order by s.lease_expires_at desc
        limit 1),
      ''
    ),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'broughtIn', p_event.brought_in_at is not null and p_event.state = 'actionable',
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- Publishing into a home
-- ---------------------------------------------------------------------------

-- 0019's, taking the workspace a checkout carrying a pointer publishes into. Exactly one of
-- the two is named; the row this task's event goes on is looked up inside that home, so one
-- workspace card keeps one live row however many of its machines publish it.
create or replace function api.publish_event(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
  p_task_id integer,
  p_task_title text,
  p_release text,
  p_revision text,
  p_kind text,
  p_decision text,
  p_questions jsonb,
  p_summary text,
  p_notes text,
  p_fingerprint text,
  p_brought_in boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_event cloud.events;
  v_brought_in timestamptz := case when coalesce(p_brought_in, false) then now() else null end;
begin
  if num_nonnulls(p_board, p_workspace) <> 1 then
    raise exception 'An event names a board or a workspace, never both.' using errcode = 'AKB10';
  end if;

  if p_workspace is not null then
    perform cloud.require_member(p_workspace, p_subject);
  else
    select * into v_board from cloud.boards where id = p_board;
    if v_board.id is null then
      perform cloud.count_write(p_daily_write_budget);
      insert into cloud.boards (id, owner_id, name) values (p_board, p_subject, '');
      select * into v_board from cloud.boards where id = p_board;
    end if;
    perform cloud.require_owner(v_board.owner_id, p_subject);
  end if;

  select * into v_event
  from cloud.events e
  where e.task_id = p_task_id
    and e.board_id is not distinct from p_board
    and e.workspace_id is not distinct from p_workspace
    and (
      e.finished_at is null
      or (e.state = 'stale' and not exists (select 1 from cloud.event_actions a where a.event_id = e.id))
    )
  order by e.changed_at desc
  limit 1;

  if v_event.id is not null then
    -- Nothing the person is being asked to decide has moved. Whatever else did is written
    -- through without touching `changed_at`, so a row already read stays read.
    if v_event.state = 'actionable' and v_event.fingerprint = p_fingerprint then
      if v_event.revision is distinct from p_revision
         or v_event.release is distinct from coalesce(p_release, '') then
        perform cloud.count_write(p_daily_write_budget);
        update cloud.events
           set revision = p_revision,
               release = coalesce(p_release, ''),
               content_at = now()
         where id = v_event.id
        returning * into v_event;
      end if;
      return cloud.event_json(v_event);
    end if;
    if v_event.state <> 'actionable' and v_event.state <> 'stale' then
      return cloud.event_json(v_event);
    end if;
    perform cloud.count_write(p_daily_write_budget);
    update cloud.events
       set task_title = p_task_title,
           release = coalesce(p_release, ''),
           revision = p_revision,
           kind = p_kind,
           decision = p_decision,
           questions = coalesce(p_questions, '[]'::jsonb),
           summary = coalesce(p_summary, ''),
           notes = coalesce(p_notes, ''),
           fingerprint = p_fingerprint,
           state = 'actionable',
           finished_at = null,
           brought_in_at = v_brought_in,
           changed_at = now(),
           content_at = now()
     where id = v_event.id
    returning * into v_event;
    perform cloud.hint(v_event.owner_id, v_event.id);
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.events (
    owner_id, board_id, workspace_id, task_id, task_title, release, revision, kind, decision,
    questions, summary, notes, fingerprint, brought_in_at
  ) values (
    coalesce(v_board.owner_id, p_subject), p_board, p_workspace, p_task_id, p_task_title,
    coalesce(p_release, ''), p_revision, p_kind, p_decision,
    coalesce(p_questions, '[]'::jsonb), coalesce(p_summary, ''), coalesce(p_notes, ''),
    p_fingerprint, v_brought_in
  )
  returning * into v_event;
  perform cloud.hint(v_event.owner_id, v_event.id);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) from public;
grant execute on function api.publish_event(uuid, uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer) to service_role;
-- 0019's, which can only publish into a board. Dropped rather than left beside it, or the
-- schema keeps a path that raises a second row for a workspace card.
drop function if exists api.publish_event(uuid, uuid, integer, text, text, text, text, text, jsonb, text, text, text, boolean, integer);

-- ---------------------------------------------------------------------------
-- Reading one, and the workspace's own list
-- ---------------------------------------------------------------------------

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
  perform cloud.require_event_reader(v_event, p_subject);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.read_event(uuid, uuid) from public;
grant execute on function api.read_event(uuid, uuid) to service_role;

-- Every decision this workspace's board is raising — what a hosted card page reads beside the
-- board, so it knows whether the card on screen is waiting on one and what state it is in.
-- The live rows alone: a finished delivery is history, and no surface offers a press on one.
create or replace function api.list_workspace_events(p_subject uuid, p_workspace uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cloud.require_member(p_workspace, p_subject);
  return coalesce((
    select json_agg(cloud.event_json(e) order by e.changed_at desc)
    from cloud.events e
    where e.workspace_id = p_workspace and e.finished_at is null
  ), '[]'::json);
end;
$$;
revoke all on function api.list_workspace_events(uuid, uuid) from public;
grant execute on function api.list_workspace_events(uuid, uuid) to service_role;

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
  perform cloud.require_event_reader(v_event, p_subject);
  if v_event.state <> 'actionable'
     or exists (select 1 from cloud.event_actions a where a.event_id = p_event) then
    return cloud.event_json(v_event);
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.events
     set state = 'stale', changed_at = now(), content_at = now(), finished_at = now()
   where id = p_event
  returning * into v_event;
  perform cloud.hint(v_event.owner_id, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.retire_event(uuid, uuid, integer) from public;
grant execute on function api.retire_event(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The request an action raises, and the machines that may claim it
-- ---------------------------------------------------------------------------

-- 0005's, plus the home the request belongs to. `boardId` stays empty rather than absent on a
-- workspace request, for the reason the event's does.
create or replace function cloud.request_json(p_request cloud.event_requests)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_request.id,
    'boardId', coalesce(p_request.board_id::text, ''),
    'workspaceId', coalesce(p_request.workspace_id::text, ''),
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

-- A board event's request is addressed to that board's ONE server. A workspace event's is
-- addressed to none: any of the workspace's live machines may take it, which is what lets a
-- decision made on a phone be picked up by whichever machine is running.
create or replace function cloud.raise_request(p_event cloud.events)
returns cloud.event_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server uuid;
  v_request cloud.event_requests;
  v_node cloud.board_servers;
begin
  if p_event.board_id is not null then
    select id into v_server from cloud.board_servers where board_id = p_event.board_id and enabled;
  end if;
  insert into cloud.event_requests (owner_id, board_id, workspace_id, event_id, server_id)
  values (p_event.owner_id, p_event.board_id, p_event.workspace_id, p_event.id, v_server)
  on conflict (event_id) do nothing
  returning * into v_request;
  if v_request.id is null then
    select * into v_request from cloud.event_requests where event_id = p_event.id;
  end if;

  if p_event.workspace_id is null then
    perform cloud.hint_server(p_event.owner_id, v_server, v_request.id);
    return v_request;
  end if;
  -- No one machine to tell, so every live one is told — each on its OWN account's topic
  -- (#325), because a workspace's machines can be registered by different members. A hint is
  -- an optimisation either way: the catch-up read on every start and reconnect is what makes
  -- the durable row enough on its own.
  for v_node in
    select * from cloud.board_servers s
     where s.workspace_id = p_event.workspace_id
       and s.removed_at is null
       and s.enabled
       and s.lease_expires_at is not null
       and s.lease_expires_at > now()
  loop
    perform cloud.hint_server(v_node.owner_id, v_node.id, v_request.id);
  end loop;
  return v_request;
end;
$$;
revoke all on function cloud.raise_request(cloud.events) from public;
-- 0005's took the three ids apart. The row carries all of them, and a workspace event has a
-- fourth thing to say, so the row itself is what travels now.
drop function if exists cloud.raise_request(uuid, uuid, uuid);

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
  perform cloud.require_event_reader(v_event, p_subject);

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
  -- `owner_id` on the action is who ANSWERED, which for a workspace event is the member who
  -- pressed rather than the machine that published.
  insert into cloud.event_actions (event_id, owner_id, decision, revision, answers, op_id)
  values (p_event, p_subject, p_decision, p_revision, coalesce(p_answers, '[]'::jsonb), p_op_id);
  -- A workspace decision is a workspace mutation, so it is attributed on the same trail every
  -- other one writes (#314). No node: the press came from a browser, or from a machine that
  -- is not the one answering. A board event has no workspace to write a trail in.
  if v_event.workspace_id is not null then
    perform cloud.audit(v_event.workspace_id, p_subject, null, 'decision.' || p_decision,
                        v_event.task_id, json_build_object('eventId', p_event)::jsonb);
  end if;

  update cloud.events
     set state = case when p_state = 'waiting_for_server' then 'waiting_for_server' else 'accepted' end,
         changed_at = now(),
         content_at = now()
   where id = p_event
  returning * into v_event;

  if p_state = 'waiting_for_server' then
    perform cloud.count_write(p_daily_write_budget);
    perform cloud.raise_request(v_event);
  end if;

  perform cloud.hint(v_event.owner_id, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) from public;
grant execute on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) to service_role;

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
  perform cloud.require_event_reader(v_event, p_subject);
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
         reason = coalesce(nullif(p_reason, ''), ''),
         changed_at = now(),
         content_at = now(),
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

  perform cloud.hint(v_event.owner_id, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) from public;
grant execute on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) to service_role;

create or replace function api.record_event_delivery(
  p_subject uuid,
  p_event uuid,
  p_connector text,
  p_state text,
  p_external_ref text,
  p_last_error text,
  p_rendered_at timestamptz,
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
  perform cloud.require_event_reader(v_event, p_subject);

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.event_deliveries as d (
    event_id, connector, state, attempts, external_ref, last_error, rendered_at
  ) values (
    p_event, p_connector, p_state, case when p_state = 'sent' then 0 else 1 end,
    p_external_ref, nullif(p_last_error, ''),
    case when p_state = 'sent' then p_rendered_at end
  )
  on conflict (event_id, connector) do update
    set state = excluded.state,
        attempts = case when excluded.state = 'sent' then 0 else d.attempts + 1 end,
        external_ref = coalesce(excluded.external_ref, d.external_ref),
        last_error = excluded.last_error,
        rendered_at = coalesce(excluded.rendered_at, d.rendered_at),
        updated_at = now();
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_delivery(uuid, uuid, text, text, text, text, timestamptz, integer) from public;
grant execute on function api.record_event_delivery(uuid, uuid, text, text, text, text, timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- What a machine may claim
-- ---------------------------------------------------------------------------

-- 0005's list, answering for a workspace node as well as a board's server. A board server sees
-- its board's requests; a workspace node sees its workspace's, which is what lets a decision
-- made in a browser run on whichever machine is up.
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
  perform cloud.require_node_reader(v_server, p_subject);
  if not v_server.enabled or v_server.removed_at is not null then return '[]'::json; end if;

  return coalesce((
    select json_agg(cloud.request_json(r) order by r.created_at)
    from cloud.event_requests r
    where r.state <> 'finished'
      and r.board_id is not distinct from v_server.board_id
      and r.workspace_id is not distinct from v_server.workspace_id
      and (r.claimed_by is null or r.claimed_by = v_server.id)
  ), '[]'::json);
end;
$$;
revoke all on function api.list_requests(uuid, uuid) from public;
grant execute on function api.list_requests(uuid, uuid) to service_role;

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
    return json_build_object('claimed', false, 'reason', 'This machine is not registered to run that board’s work.');
  end if;
  perform cloud.require_node_reader(v_server, p_subject);
  if not v_server.enabled or v_server.removed_at is not null then
    return json_build_object('claimed', false, 'reason', 'This machine no longer runs that board’s work.');
  end if;

  select * into v_request from cloud.event_requests where id = p_request for update;
  if v_request.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such request.');
  end if;
  perform cloud.require_request_reader(v_request, p_subject);
  if v_request.board_id is distinct from v_server.board_id
     or v_request.workspace_id is distinct from v_server.workspace_id then
    return json_build_object('claimed', false, 'reason', 'That request belongs to another board.');
  end if;
  if v_request.state = 'finished' then
    return json_build_object('claimed', false, 'reason', 'That request has already been dealt with.');
  end if;
  if v_request.state = 'claimed' and not cloud.request_interrupted(v_request) then
    return json_build_object('claimed', false, 'reason', 'That request is already running.');
  end if;
  -- Interrupted, and bound to the machine that claimed it. Only that machine may take it up
  -- again; for anybody else it is a cancellation.
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
  if v_server.id is null or not v_server.enabled or v_server.removed_at is not null then
    return json_build_object('renewed', false);
  end if;
  perform cloud.require_node_reader(v_server, p_subject);

  select * into v_request from cloud.event_requests where id = p_request;
  if v_request.id is null then return json_build_object('renewed', false); end if;
  perform cloud.require_request_reader(v_request, p_subject);
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

-- ---------------------------------------------------------------------------
-- The card's chat message, in its home
-- ---------------------------------------------------------------------------

create or replace function api.record_card_message(
  p_subject uuid,
  p_board uuid,
  p_workspace uuid,
  p_task_id integer,
  p_connector text,
  p_external_ref text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board cloud.boards;
  v_owner uuid;
begin
  if num_nonnulls(p_board, p_workspace) <> 1 then
    raise exception 'A card message names a board or a workspace, never both.' using errcode = 'AKB10';
  end if;
  if p_workspace is not null then
    perform cloud.require_member(p_workspace, p_subject);
    v_owner := p_subject;
  else
    select * into v_board from cloud.boards where id = p_board;
    if v_board.id is null then return null; end if;
    perform cloud.require_owner(v_board.owner_id, p_subject);
    v_owner := v_board.owner_id;
  end if;

  perform cloud.count_write(p_daily_write_budget);
  if p_workspace is not null then
    insert into cloud.card_messages as m (owner_id, workspace_id, task_id, connector, external_ref)
    values (v_owner, p_workspace, p_task_id, p_connector, p_external_ref)
    on conflict (workspace_id, task_id, connector) where workspace_id is not null do update
      set external_ref = excluded.external_ref,
          updated_at = now();
  else
    insert into cloud.card_messages as m (owner_id, board_id, task_id, connector, external_ref)
    values (v_owner, p_board, p_task_id, p_connector, p_external_ref)
    on conflict (board_id, task_id, connector) do update
      set external_ref = excluded.external_ref,
          updated_at = now();
  end if;
  return json_build_object('externalRef', p_external_ref);
end;
$$;
revoke all on function api.record_card_message(uuid, uuid, uuid, integer, text, text, integer) from public;
grant execute on function api.record_card_message(uuid, uuid, uuid, integer, text, text, integer) to service_role;
drop function if exists api.record_card_message(uuid, uuid, integer, text, text, integer);

-- 0019's jobs, grouping a card's events and messages by the HOME they share rather than by a
-- board id every workspace event leaves null — without which one workspace's card would be
-- threaded under another's.
create or replace function api.connector_jobs(
  p_connector text,
  p_event uuid,
  p_limit integer,
  p_max_attempts integer
) returns json
language sql
security definer
set search_path = ''
as $$
  with connected as (
    select s.owner_id,
           s.state = 'active' as active,
           s.channel_id <> '' as addressed,
           s.created_at as connected_at,
           ''::text as thread_scope,
           json_build_object(
             'botToken', s.bot_token,
             'channelId', s.channel_id,
             'actorId', s.slack_user_id
           ) as posts
      from cloud.slack_connections s
     where p_connector = 'slack'
    union all
    select l.owner_id,
           l.state = 'active',
           l.destination_id <> '',
           l.created_at,
           l.destination_id || ':',
           json_build_object(
             'cloud', l.cloud,
             'tenantKey', l.tenant_key,
             'destinationId', l.destination_id,
             'direct', l.direct,
             'openId', l.open_id
           )
      from cloud.lark_connections l
     where p_connector = 'lark'
  )
  select coalesce(json_agg(job), '[]'::json) from (
    select json_build_object(
      'ownerId', e.owner_id,
      'eventId', e.id,
      'contentAt', e.content_at,
      'changedAt', e.content_at,
      'posts', c.posts,
      'messageRef', d.external_ref,
      'endingRef', d.ended_ref,
      'cardRef', (
        select m.external_ref
          from cloud.card_messages m
         where m.task_id = e.task_id
           and m.board_id is not distinct from e.board_id
           and m.workspace_id is not distinct from e.workspace_id
           and m.connector = p_connector
           and starts_with(m.external_ref, c.thread_scope)
      ),
      'card', (
        select cloud.event_json(newest)
          from cloud.events newest
         where newest.task_id = e.task_id
           and newest.board_id is not distinct from e.board_id
           and newest.workspace_id is not distinct from e.workspace_id
         order by newest.content_at desc, newest.created_at desc, newest.id desc
         limit 1
      ),
      'threadRef', (
        select root.external_ref
          from cloud.events sibling
          join cloud.event_deliveries root
            on root.event_id = sibling.id and root.connector = p_connector
         where sibling.task_id = e.task_id
           and sibling.board_id is not distinct from e.board_id
           and sibling.workspace_id is not distinct from e.workspace_id
           and root.external_ref is not null
           and starts_with(root.external_ref, c.thread_scope)
         order by root.created_at, root.id
         limit 1
      ),
      'attempts', coalesce(d.attempts, 0),
      'event', cloud.event_json(e)
    ) as job
    from cloud.events e
    join connected c on c.owner_id = e.owner_id
    left join cloud.event_deliveries d on d.event_id = e.id and d.connector = p_connector
    where c.active
      and c.addressed
      and (p_event is null or e.id = p_event)
      and (e.state = 'actionable' or d.external_ref is not null)
      and (d.id is null or d.state <> 'sent' or d.rendered_at is null or d.rendered_at < e.content_at)
      and coalesce(d.attempts, 0) < p_max_attempts
      and (
        e.brought_in_at is null
        or d.external_ref is not null
        or c.connected_at > e.brought_in_at
      )
    order by e.content_at
    limit greatest(coalesce(p_limit, 20), 1)
  ) due;
$$;
revoke all on function api.connector_jobs(text, uuid, integer, integer) from public;
grant execute on function api.connector_jobs(text, uuid, integer, integer) to service_role;

-- The adoption 0013 ran is a board-only statement, and it is re-run by the SQL checks. Its
-- board grouping is still right — a workspace card had no message before this migration —
-- so it is left exactly as it was.
