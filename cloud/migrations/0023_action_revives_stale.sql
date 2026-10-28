-- An action revives the row a retirement took down under it (#640).
--
-- A click on the card page starts a run, and starting one sets off a pass that finds the card
-- held and retires its row. The action arrives a moment behind that retirement, and 0022
-- refused it: `state <> 'actionable'` is a terminal refusal, so the click was dropped, the
-- event carried no action, and `api.record_event_outcome` returned without writing — a
-- delivery that landed left no notification at all.
--
-- The board now records its action before it starts anything, which closes the ordinary case.
-- It does not close the race: another process can retire the row between the click and the
-- send, and the action still has to land on the row the user pressed.
--
-- So a `stale` event NOBODY ACTED ON accepts an action and comes back as `accepted`. That is
-- not a new judgment — it is exactly the rule `api.publish_event` already uses to decide that
-- a card's row is still that card's row, and reading the two together is what keeps one card
-- to one row. The other two refusals are untouched: an event that already carries an action
-- is still `already_acted`, and a revision that has moved is still `stale_revision`, because
-- what the user approved is what gets built.

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
  -- `stale` and unacted is the row this click is about, taken down a moment too early. Every
  -- other state is an event whose work is somebody else's to finish.
  if v_event.state <> 'actionable' and v_event.state <> 'stale' then
    raise exception 'That event is no longer waiting for anybody.' using errcode = 'AKB03';
  end if;

  perform cloud.count_write(p_daily_write_budget, 2);
  insert into cloud.event_actions (event_id, owner_id, decision, revision, answers, op_id)
  values (p_event, p_subject, p_decision, p_revision, coalesce(p_answers, '[]'::jsonb), p_op_id);
  -- A workspace decision is a workspace mutation, attributed to the member who gave it on the
  -- same trail every other one writes (#314). No node: the press came from a browser, or from
  -- a machine that is not the one answering.
  if v_event.workspace_id is not null then
    perform cloud.audit(v_event.workspace_id, p_subject, null, 'decision.' || p_decision,
                        v_event.task_id, json_build_object('eventId', p_event)::jsonb);
  end if;

  update cloud.events
     set state = case when p_state = 'waiting_for_server' then 'waiting_for_server' else 'accepted' end,
         -- A retirement finished this event; the action un-finishes it, or the sweep that
         -- clears finished rows after 30 days would take a live delivery's row with it.
         finished_at = null,
         changed_at = now(),
         content_at = now()
   where id = p_event
  returning * into v_event;

  if p_state = 'waiting_for_server' then
    perform cloud.count_write(p_daily_write_budget);
    perform cloud.raise_request(v_event, p_subject);
  end if;

  perform cloud.hint_audience(v_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) from public;
grant execute on function api.record_event_action(uuid, text, uuid, text, text, jsonb, text, integer) to service_role;
