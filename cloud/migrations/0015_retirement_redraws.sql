-- A retirement is content moving too.
--
-- 0004's `retire_event` moved `changed_at` and `finished_at` and left `content_at` where it
-- was. `api.connector_jobs` owes a message only where `rendered_at < content_at`, and the
-- delivery that posted the ask recorded a `rendered_at` equal to the `content_at` it drew
-- from — so retiring a card raised no job at all. `stale` was the one state that never
-- reached a channel: the chat kept showing "Question waiting" with an **Implement** on it,
-- and `record_event_action` refuses that press with AKB03 because the event is no longer
-- waiting for anybody. A control nobody can use is worse than no control.
--
-- 0009 moved this clock for an action and for an outcome. This is the third and last writer
-- of a state, and the one it was missed on.
--
-- Nothing else changes: the refusal to retire an event somebody acted on is 0004's, and it
-- is what keeps `stale` meaning "no delivery ever started".
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
     set state = 'stale',
         changed_at = now(),
         content_at = now(),
         finished_at = now()
   where id = p_event
  returning * into v_event;
  perform cloud.hint(p_subject, p_event);
  return cloud.event_json(v_event);
end;
$$;
revoke all on function api.retire_event(uuid, uuid, integer) from public;
grant execute on function api.retire_event(uuid, uuid, integer) to service_role;
