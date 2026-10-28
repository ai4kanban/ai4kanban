-- Stop or resume a task's run from its page (#2128).
--
-- - **Stop**: a running flow job is asked to stop over 0087's `stop_requested`. Its Runner pauses
--   the board's runs, keeping the work, and finishes the job `stopped`; the task becomes
--   `stopped`. Asked while the Runner is away, it holds until the Runner is back. A Runner before
--   protocol 10 cannot pause a flow job: its renewal ends the job here and loses the lease.
-- - **Resume**: a stopped or failed task's last step runs again on the computer that ran it, which
--   still has the work; it waits while that computer is offline.

alter table cloud.tasks drop constraint tasks_status_check;
alter table cloud.tasks add constraint tasks_status_check
  check (status in ('queued', 'running', 'waiting_review', 'done', 'failed', 'cancelled', 'stopped'));
alter table cloud.runner_jobs drop constraint runner_jobs_outcome_check;
alter table cloud.runner_jobs add constraint runner_jobs_outcome_check
  check (outcome in ('done', 'failed', 'conflict', 'stopped'));

-- The task's newest flow job.
create function cloud.v1_last_flow(p_task text) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j where j.task_id = p_task and j.flow is not null order by j.seq desc limit 1;
$$;

-- `{ machine }`, the computer a resume runs on; null when the task cannot be resumed.
create function cloud.v1_resume_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('machine', r.machine_name)
  from cloud.v1_last_flow(t.id) j
  join cloud.runners r on r.owner_id = j.owner_id and r.machine_id = j.claimed_machine
  where t.run and t.status in ('stopped', 'failed') and (cloud.v1_flow_job(t.id)).id is null;
$$;

-- 0059's, with `stopping` and the computer the step runs on.
create or replace function cloud.v1_run_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when j.id is not null then jsonb_build_object(
    'state', case j.state when 'claimed' then 'running' else 'queued' end,
    'runner_connected', exists (select 1 from cloud.runners r where r.owner_id = t.account_id and r.live_until > now()
                                  and r.machine_id = coalesce(j.claimed_machine, j.machine_id, r.machine_id)),
    'machine', (select r.machine_name from cloud.runners r
                 where r.owner_id = t.account_id and r.machine_id = coalesce(j.claimed_machine, j.machine_id)),
    'stopping', j.stop_requested,
    'job', j.id) end
  from cloud.v1_flow_job(t.id) j;
$$;

-- 0086's, with what a resume needs.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing, 'resume', cloud.v1_resume_json(t));
$$;

-- 0086's, a stopped step stopping its task.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if t.status in ('done', 'failed', 'cancelled') or j.outcome = 'conflict' then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'stopped' then
    update cloud.tasks set status = 'stopped', updated_at = now() where id = t.id returning * into t;
  elsif j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif j.flow ->> 'verb' = 'implement' and jsonb_typeof(r) is distinct from 'object' then
    update cloud.tasks set status = 'done', result = j.reply, updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = j.owner_id and x.machine_id = j.claimed_machine), '')) end,
      landed_owner = case when jsonb_typeof(l) = 'object' then j.owner_id end,
      landed_machine = case when jsonb_typeof(l) = 'object' then j.claimed_machine end
     where id = t.id returning * into t;
  else
    perform cloud.v1_submit_draft(t.id, case
      when jsonb_typeof(r) = 'object' then jsonb_build_object('question', r ->> 'question',
        'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'approve', false) order by o.n)
                    from jsonb_array_elements_text(r -> 'options') with ordinality o(label, n)),
        'card_question', (r ->> 'position')::integer)
      when concat(t.request, t.title) ~ '[一-鿿]' then
        '{"question": "批准这份方案？", "options": [{"label": "确认", "approve": true}, {"label": "需要修改", "approve": false}]}'
      else '{"question": "Approve this plan?", "options": [{"label": "Approve", "approve": true},
             {"label": "Request changes", "approve": false}]}' end);
    return;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- `{ job, result }`: `job` is the one whose Runner the Worker tells now, null when its renewal does.
create function api.v1_stop_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  j := cloud.v1_flow_job(p_id);
  if j.state is distinct from 'claimed' then perform cloud.v1_refuse('This task is not running.'); end if;
  update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = j.id;
  update cloud.tasks set updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return jsonb_build_object('result', cloud.v1_task_json(t),
    'job', case when coalesce((select r.protocol from cloud.runners r
                                where r.owner_id = j.owner_id and r.machine_id = j.claimed_machine), 0) >= 10 then j.id end);
end;
$$;

-- The last step again, on the computer that ran it, carrying on its work there.
create function api.v1_resume_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  l cloud.runner_jobs;
  j cloud.runner_jobs;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  if cloud.v1_resume_json(t) is null then perform cloud.v1_refuse('This task cannot be resumed.'); end if;
  l := cloud.v1_last_flow(p_id);
  insert into cloud.runner_jobs (owner_id, runtime, model, runtime_id, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (l.owner_id, l.runtime, l.model, l.runtime_id, l.project_id, l.project_dir, l.claimed_machine, l.task_id, l.prompt,
          l.flow || jsonb_strip_nulls(jsonb_build_object('card', t.run_card, 'resume', true)))
  returning * into j;
  -- 0088's binding follows the runtime's Runner; the work is on this computer.
  update cloud.runner_jobs set machine_id = l.claimed_machine,
    project_dir = coalesce((select f.path from cloud.project_folders f
                             where f.project_id = l.project_id and f.machine_id = l.claimed_machine and f.account_id = l.owner_id), l.project_dir)
   where id = j.id;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', failure = null, result = null, updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- A flow job an older Runner was asked to stop, ended here.
create function cloud.v1_end_stopped_flow(p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  h cloud.task_chats;
begin
  update cloud.runner_jobs set state = 'finished', outcome = 'stopped', reason = 'Stopped.', finished_at = now(), updated_at = now()
   where id = p_job returning * into j;
  perform cloud.v1_finish_flow(j, '{}');
  for h in update cloud.task_chats set job_id = null, failure = null, updated_at = now() where job_id = p_job returning * loop
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
end;
$$;

-- 0087's: a flow job asked to stop says so to a Runner from protocol 10; an older one's ends here.
create or replace function api.renew_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  -- The protocol a Runner can stop this job from.
  v_knows integer;
begin
  if v_job.id is null then
    return json_build_object('renewed', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  v_knows := case when v_job.flow is null then 8 else 10 end;
  if v_job.stop_requested and coalesce((select r.protocol from cloud.runners r
                                         where r.owner_id = v_job.owner_id and r.machine_id = p_machine), 0) < v_knows then
    if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
    if v_job.flow is null then perform cloud.v1_end_stopped(v_job.id); else perform cloud.v1_end_stopped_flow(v_job.id); end if;
    return json_build_object('renewed', false);
  end if;
  update cloud.runner_jobs
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job;
  return json_build_object('renewed', true, 'stop', v_job.stop_requested);
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname like 'v1\_%') or (n.nspname = 'cloud' and p.proname like 'v1\_%')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
revoke all on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) to service_role;
