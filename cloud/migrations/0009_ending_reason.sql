-- Why a delivery ended the way it did, where a surface can read it.
--
-- A refusal has always carried words — "you have uncommitted changes in …" — but they stopped
-- at `cloud.event_requests.reason`, which two things made useless: no surface renders a
-- request, and a decision taken ON the board's own machine raises no request at all, so its
-- words had nowhere to land. A reason belongs to the EVENT, which is the one row every
-- surface draws. So "Delivery failed" and nothing else was the whole of what a channel was
-- told, for a refusal a `git stash` would have cleared.
--
-- The second half is the clock. #182 gave the event `content_at` and made a connector's
-- rewrite due against it, but only a publication moved it: an action and an outcome moved
-- `changed_at` alone, so a message that got out while its card was actionable would have
-- stayed on "Ready for review" for the whole life of that card. A state change IS content
-- moving, and both functions below move both clocks.

alter table cloud.events add column if not exists reason text not null default '';

comment on column cloud.events.reason is
  'Why the delivery ended as it did, in the board''s own words. Empty when the ending had nothing to explain.';

-- What a request already recorded, for the events that ended before this column existed. The
-- clocks are left alone on purpose: a message already in a channel is history, and rewriting
-- every one of them to add a line is a day of Slack calls nobody asked for.
update cloud.events e
   set reason = r.reason
  from cloud.event_requests r
 where r.event_id = e.id
   and coalesce(r.reason, '') <> ''
   and e.reason = '';

-- ---------------------------------------------------------------------------
-- The event, with its reason on it
-- ---------------------------------------------------------------------------

-- 0006's, plus `reason`. An ending nobody explained carries an empty one, so a surface writes
-- a line only where there are words to write.
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
    'summary', p_event.summary,
    'notes', p_event.notes,
    'reason', p_event.reason,
    'serverName', coalesce((
      select s.machine_name from cloud.board_servers s
       where s.board_id = p_event.board_id and s.enabled
       limit 1
    ), ''),
    'createdAt', p_event.created_at,
    'changedAt', p_event.changed_at,
    'acted', exists (select 1 from cloud.event_actions a where a.event_id = p_event.id)
  );
$$;
revoke all on function cloud.event_json(cloud.events) from public;

-- ---------------------------------------------------------------------------
-- The two writes that move an event's state
-- ---------------------------------------------------------------------------

-- 0005's action, moving `content_at` with `changed_at`: a card that has been decided is not
-- the card the message in the channel is showing.
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
         changed_at = now(),
         content_at = now()
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

-- 0005's outcome, with the reason kept on the event and the same second clock moved.
--
-- The reason is the one this ending gave, not the last one on record: a `running` reported
-- by a machine taking its request up again must not still show why the attempt before it was
-- refused. The request keeps its own copy, which is where a claim reads from.
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

  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) from public;
grant execute on function api.record_event_outcome(uuid, text, uuid, text, text, integer, integer) to service_role;
