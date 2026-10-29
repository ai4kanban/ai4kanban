-- A run task says which step it is on (#79), so the board tells refining from building.

-- 0104's, with the step: `refine` (creating the card, or the previews an approval starts), `implement`,
-- `revise` or `resolve`. An unplanned create (#2139) is a build from the start.
create or replace function cloud.v1_run_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when j.id is not null then jsonb_build_object(
    'state', case j.state when 'claimed' then 'running' else 'queued' end,
    'runner_connected', exists (select 1 from cloud.runners r where r.owner_id = h.host and r.live_until > now()
                                  and r.machine_id = coalesce(j.claimed_machine, j.machine_id, r.machine_id)),
    'machine', (select r.machine_name from cloud.runners r
                 where r.owner_id = h.host and r.machine_id = coalesce(j.claimed_machine, j.machine_id)),
    'runtime_name', (select x.name from cloud.runtimes x where x.id = j.runtime_id),
    'stopping', j.stop_requested,
    'runner_removed', j.state = 'waiting' and exists (select 1 from cloud.removed_runners x
      where x.workspace_id = t.workspace_id and x.machine_id = j.machine_id),
    'job', j.id,
    'step', case j.flow ->> 'verb'
      when 'create' then case when (j.flow ->> 'skip_plan')::boolean then 'implement' else 'refine' end
      when 'approve' then 'refine'
      else j.flow ->> 'verb' end) end
  from cloud.v1_flow_job(t.id) j
  cross join lateral (select coalesce(j.claimed_by, cloud.runner_job_host(j), t.account_id) as host) h;
$$;
