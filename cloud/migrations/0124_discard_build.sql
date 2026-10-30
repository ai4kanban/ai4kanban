-- Discard a build, keeping the task (#61): a running build stops, the task waits on its plan's
-- approval again, and a `discard` step on the computer that built it throws the build's worktree
-- and branch away — once that computer is connected. Steps of a task run in order, so a build
-- approved again starts after that cleanup.

alter table cloud.tasks add column discarded_seq bigint;
alter table cloud.runner_jobs drop constraint runner_jobs_flow_check;
alter table cloud.runner_jobs add constraint runner_jobs_flow_check
  check (flow is null or flow ->> 'verb' in ('create', 'resolve', 'revise', 'approve', 'implement', 'discard'));

-- 0059's: neither a discard's cleanup nor a discarded build still stopping is the task's step.
create or replace function cloud.v1_flow_job(p_task text) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j
  where j.task_id = p_task and j.flow is not null and j.state <> 'finished' and not cloud.runner_job_interrupted(j)
    and j.flow ->> 'verb' is distinct from 'discard'
    and j.seq > coalesce((select t.discarded_seq from cloud.tasks t where t.id = p_task), 0)
  order by j.state = 'claimed' desc, j.attempt desc, j.seq limit 1;
$$;

-- 0090's, likewise.
create or replace function cloud.v1_last_flow(p_task text) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j
  where j.task_id = p_task and j.flow is not null and j.flow ->> 'verb' is distinct from 'discard'
  order by j.seq desc limit 1;
$$;

-- 0080's, `last_job` the same.
create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'context', t.context,
    'status', t.status, 'card_version', nullif(t.card_version, 0), 'runtime', t.runtime,
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'review', cloud.v1_review_json(t),
    'last_job', (cloud.v1_last_flow(t.id)).id,
    'discussion', t.discussion_id,
    'cancel_reason', t.cancel_reason,
    'cancelled_by', (select a.handle from cloud.accounts a where a.id = t.cancelled_by),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

/** A build that has not landed: running, waiting, stopped or failed. */
create function cloud.v1_discardable(t cloud.tasks) returns boolean
language sql stable security definer set search_path = '' as $$
  select t.run and t.status in ('queued', 'running', 'stopped', 'failed')
    and (cloud.v1_last_flow(t.id)).flow ->> 'verb' = 'implement';
$$;

-- 0118's, with `discardable`.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing, 'resume', cloud.v1_resume_json(t), 'waiting_for_slot', cloud.v1_waiting_for_slot(t),
         'creating', cloud.v1_creating(t), 'restores_to', cloud.v1_restores_to(t), 'discardable', cloud.v1_discardable(t));
$$;

-- 0116's: a step from before a discard, and the discard's own, leave the task as the discard did.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
  v_by uuid := coalesce(j.claimed_by, j.owner_id);
  v_build boolean := (j.flow ->> 'verb' = 'implement' or (j.flow ->> 'verb' = 'create' and (j.flow ->> 'skip_plan')::boolean))
    and jsonb_typeof(r) is distinct from 'object';
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if j.seq <= t.discarded_seq then return; end if;
  if j.outcome = 'conflict' or t.status in ('failed', 'cancelled') then return; end if;
  if t.status = 'done' and not (j.outcome = 'done' and v_build) then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'stopped' then
    update cloud.tasks set status = 'stopped', updated_at = now() where id = t.id returning * into t;
  elsif j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif v_build then
    update cloud.tasks set status = 'done', result = coalesce(j.reply, case when t.status = 'done' then result end), updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = v_by and x.machine_id = j.claimed_machine), ''))
        when t.status = 'done' then landing end,
      landed_owner = case when jsonb_typeof(l) = 'object' then v_by when t.status = 'done' then landed_owner end,
      landed_machine = case when jsonb_typeof(l) = 'object' then j.claimed_machine when t.status = 'done' then landed_machine end
     where id = t.id returning * into t;
  else
    perform cloud.v1_submit_draft(t.id, cloud.v1_review_of(t, r));
    return;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

/** `{ job, result }` as a stop answers: the build stopped, the task waiting on its plan's approval
 *  again, and the build's checkout queued for removal on the computer that has it. */
create function api.v1_discard_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.runner_jobs;
  b cloud.runner_jobs;
  d cloud.runner_jobs;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  if not cloud.v1_discardable(t) then perform cloud.v1_refuse('Only a build that has not landed can be discarded.'); end if;
  k := cloud.v1_flow_job(p_id);
  if k.state = 'claimed' then
    update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = k.id;
  end if;
  perform cloud.v1_end_waiting(p_id, 'Discarded.');

  -- The computer the build last ran on, while it is still this task's to use.
  select j.* into b from cloud.runner_jobs j
   where j.task_id = p_id and j.flow ->> 'verb' = 'implement' and j.claimed_machine is not null
   order by j.seq desc limit 1;
  if b.id is not null and exists (select 1 from cloud.runners r
       where r.owner_id = coalesce(b.claimed_by, b.owner_id) and r.machine_id = b.claimed_machine
         and (r.owner_id = b.owner_id or cloud.runner_host(b.claimed_machine, t.workspace_id) is not distinct from r.owner_id)) then
    insert into cloud.runner_jobs (owner_id, runtime, model, runtime_id, project_id, project_dir, machine_id, task_id, prompt, flow)
    values (b.owner_id, b.runtime, b.model, b.runtime_id, b.project_id,
            coalesce((select f.path from cloud.project_folders f
                       where f.project_id = b.project_id and f.machine_id = b.claimed_machine and f.account_id = b.owner_id), b.project_dir),
            b.claimed_machine, p_id, format('akb discard: %s', t.title),
            jsonb_strip_nulls(jsonb_build_object('verb', 'discard', 'workflow', t.workflow ->> 'id', 'card', t.run_card)))
    returning * into d;
    perform cloud.hint_runner(coalesce(b.claimed_by, t.account_id), d.id);
  end if;

  update cloud.tasks set status = 'waiting_review', failure = null, result = null, held_flow = null, updated_at = now(),
    discarded_seq = (select max(j.seq) from cloud.runner_jobs j where j.task_id = p_id)
  where id = p_id returning * into t;
  perform cloud.v1_submit_draft(p_id, cloud.v1_review_of(t, null));
  select * into t from cloud.tasks where id = p_id;
  return jsonb_build_object('result', cloud.v1_task_json(t),
    'job', case when k.state = 'claimed' and coalesce((select r.protocol from cloud.runners r
                where r.owner_id = coalesce(k.claimed_by, k.owner_id) and r.machine_id = k.claimed_machine), 0) >= 10 then k.id end);
end;
$$;

revoke all on function cloud.v1_discardable(cloud.tasks) from public;
revoke all on function api.v1_discard_task(uuid, text, integer) from public;
grant execute on function api.v1_discard_task(uuid, text, integer) to service_role;
