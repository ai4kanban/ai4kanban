-- A refine scheduled on a card nothing blocks starts as the write lands (#124), rather than
-- waiting for a blocker that will never leave.

-- 0124's, with `refine`: the verb a card's schedule starts, and the Runner already runs.
alter table cloud.runner_jobs drop constraint runner_jobs_flow_check;
alter table cloud.runner_jobs add constraint runner_jobs_flow_check
  check (flow is null or flow ->> 'verb' in ('create', 'resolve', 'refine', 'revise', 'approve', 'implement', 'discard'));

-- A task whose card was made without a run takes one here, on the computer that wrote the card;
-- `api.v1_release_task` refuses such a task, and starts it from there.
create function api.v1_start_scheduled_refine(p_project text, p_number integer, p_notes text, p_machine uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where project_id = p_project and number = p_number;
  if t.id is null then return jsonb_build_object('started', false); end if;
  perform cloud.v1_lock(t.workspace_id);
  select * into t from cloud.tasks where id = t.id for update;
  if t.status in ('done', 'cancelled') or (cloud.v1_flow_job(t.id)).id is not null
     or cardinality(cloud.v1_open_blockers(t)) > 0 then
    return jsonb_build_object('started', false);
  end if;
  update cloud.tasks set run = true, run_card = t.number,
    machine_id = coalesce(t.machine_id, cloud.v1_task_machine(t.account_id, t.workspace_id, t.project_id, p_machine)),
    updated_at = now()
  where id = t.id;
  return api.v1_release_task(t.id, 'refine', p_notes);
end;
$$;

revoke all on function api.v1_start_scheduled_refine(text, integer, text, uuid) from public;
grant execute on function api.v1_start_scheduled_refine(text, integer, text, uuid) to service_role;
