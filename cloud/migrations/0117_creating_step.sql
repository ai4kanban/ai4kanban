-- A new task's card is not open until it is written (#98): its planned create says `create`, and the task
-- says `creating` until a create ends done.

-- 0115's, with `create` for a planned create.
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
      when 'create' then case when (j.flow ->> 'skip_plan')::boolean then 'implement' else 'create' end
      when 'approve' then 'refine'
      else j.flow ->> 'verb' end) end
  from cloud.v1_flow_job(t.id) j
  cross join lateral (select coalesce(j.claimed_by, cloud.runner_job_host(j), t.account_id) as host) h;
$$;

create function cloud.v1_creating(t cloud.tasks) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cloud.runner_jobs j where j.task_id = t.id and j.flow ->> 'verb' = 'create'
                   and not coalesce((j.flow ->> 'skip_plan')::boolean, false))
    and not exists (select 1 from cloud.runner_jobs j where j.task_id = t.id and j.flow ->> 'verb' = 'create'
                      and j.outcome = 'done');
$$;

-- 0105's, with `creating`.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing, 'resume', cloud.v1_resume_json(t), 'waiting_for_slot', cloud.v1_waiting_for_slot(t),
         'creating', cloud.v1_creating(t));
$$;

revoke all on function cloud.v1_creating(cloud.tasks) from public;
