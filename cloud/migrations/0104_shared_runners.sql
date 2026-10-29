-- A computer shared with a team workspace's members (#2196).
--
-- - **Only its owner shares it**: per workspace, never in a personal one. A share ends when its
--   owner stops it, the workspace stops sending tasks to the computer, or the owner leaves.
-- - **A member picks the computer**: `tasks.machine_id` holds the pick. Every job of that task —
--   steps, chats, resumes — goes there and runs in the owner's folder on the owner's runtime for
--   that computer. The task stays the member's: `owner_id` is still theirs, `claimed_by` is whose
--   Runner holds the job.
-- - **Ending a share stops the members' work on it**: running steps are asked to stop, queued
--   ones end stopped, and the tasks are no longer pinned there. Resuming one asks for another
--   computer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.shared_runners (
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  machine_id uuid not null,
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, machine_id)
);
alter table cloud.shared_runners enable row level security;

alter table cloud.tasks add column machine_id uuid;
alter table cloud.runner_jobs add column claimed_by uuid;

-- ---------------------------------------------------------------------------
-- Who runs what
-- ---------------------------------------------------------------------------

-- The account sharing this computer with the workspace, null when none does.
create function cloud.runner_host(p_machine uuid, p_workspace text) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.owner_id from cloud.shared_runners s where s.machine_id = p_machine and s.workspace_id = p_workspace;
$$;

create function cloud.runner_job_workspace(j cloud.runner_jobs) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.workspace_id from cloud.tasks t where t.id = j.task_id),
                  (select p.workspace_id from cloud.projects p where p.id = j.project_id));
$$;

-- The account sharing the computer this job is on with its workspace.
create function cloud.runner_job_host(j cloud.runner_jobs) returns uuid
language sql stable security definer set search_path = '' as $$
  select cloud.runner_host(coalesce(j.claimed_machine, j.machine_id), cloud.runner_job_workspace(j));
$$;

-- Whose Runner runs this task: its creator's, or the owner of the shared computer it is pinned
-- to; null when that computer is no longer shared.
create function cloud.v1_task_host(t cloud.tasks) returns uuid
language sql stable security definer set search_path = '' as $$
  select case when t.machine_id is null
                or exists (select 1 from cloud.project_folders f
                           where f.project_id = t.project_id and f.machine_id = t.machine_id and f.account_id = t.account_id)
              then t.account_id
              else cloud.runner_host(t.machine_id, t.workspace_id) end;
$$;

-- The owner's runtime for that computer: its default first, else the owner's Global default.
create function cloud.v1_host_runtime(p_host uuid, p_machine uuid) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where account_id = p_host and runner = p_machine
  order by is_default desc, created_at limit 1;
  if found then return r; end if;
  return cloud.v1_default_runtime(p_host);
end;
$$;

-- A shared computer a member may pick: holding the project in its owner's folder, and online.
create function cloud.v1_shared_ready(p_workspace text, p_project text, p_machine uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cloud.shared_runners s
    join cloud.project_folders f on f.project_id = p_project and f.machine_id = s.machine_id and f.account_id = s.owner_id
    join cloud.runners r on r.owner_id = s.owner_id and r.machine_id = s.machine_id and r.live_until > now()
    where s.workspace_id = p_workspace and s.machine_id = p_machine);
$$;

create function cloud.v1_runner_unavailable() returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'That computer is no longer available. Pick another one.' using errcode = 'AKB26', detail = 'runner_unavailable';
end;
$$;

-- The computer a new task is pinned to: the one picked, when it is the member's own or shared
-- here and online; with none picked, null (the member's own) unless the member has no folder of
-- the project, then the first shared computer ready.
create function cloud.v1_task_machine(p_account uuid, p_workspace text, p_project text, p_machine uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_machine is not null then
    if exists (select 1 from cloud.project_folders f
               where f.project_id = p_project and f.machine_id = p_machine and f.account_id = p_account)
       or cloud.v1_shared_ready(p_workspace, p_project, p_machine) then
      return p_machine;
    end if;
    perform cloud.v1_runner_unavailable();
  end if;
  if p_project is null or exists (select 1 from cloud.project_folders f where f.project_id = p_project and f.account_id = p_account) then
    return null;
  end if;
  return (select s.machine_id from cloud.shared_runners s
          where s.workspace_id = p_workspace and s.owner_id <> p_account and cloud.v1_shared_ready(p_workspace, p_project, s.machine_id)
          order by s.created_at, s.machine_id limit 1);
end;
$$;

-- A task's job goes where the task is pinned. On a shared computer it takes the owner's folder and
-- runtime, and that owner's Runner hears of it. Runs after 0088's `runner_job_bind`.
create function cloud.runner_job_pinned() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_host uuid;
  r cloud.runtimes;
begin
  if new.task_id is null or new.state <> 'waiting' then return new; end if;
  select * into t from cloud.tasks where id = new.task_id;
  if t.machine_id is null then return new; end if;
  v_host := cloud.v1_task_host(t);
  if v_host is null then return new; end if;
  new.machine_id := t.machine_id;
  new.project_dir := (select f.path from cloud.project_folders f
                      where f.project_id = t.project_id and f.machine_id = t.machine_id and f.account_id = v_host);
  if v_host <> t.account_id and new.test = false then
    r := cloud.v1_host_runtime(v_host, t.machine_id);
    if r.id is not null then
      new.runtime := r.connector;
      new.model := r.model;
      new.runtime_id := r.id;
      new.settings := r.settings;
    end if;
    if tg_op = 'INSERT' then perform cloud.hint_runner(v_host, new.id); end if;
  end if;
  return new;
end;
$$;

create trigger runner_job_pinned before insert or update of machine_id on cloud.runner_jobs
for each row execute function cloud.runner_job_pinned();

-- 0088's, also finding a runtime bound to the job's computer: a shared computer's owner's.
create or replace function cloud.runner_job_runtime(j cloud.runner_jobs) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
  t cloud.tasks;
begin
  if j.runtime_id is not null then
    select * into r from cloud.runtimes where id = j.runtime_id and (account_id = j.owner_id or runner = j.machine_id);
    if found then return r; end if;
  end if;
  if j.task_id is not null then
    select * into t from cloud.tasks where id = j.task_id;
    if found then
      select * into r from cloud.runtimes where id = t.runtime and account_id = t.account_id;
      if found and r.connector = j.runtime and r.model is not distinct from j.model then return r; end if;
    end if;
  end if;
  select * into r from cloud.runtimes
  where account_id = j.owner_id and connector = j.runtime and model is not distinct from j.model
  order by is_default desc, created_at limit 1;
  if found then return r; end if;
  select * into r from cloud.runtimes where account_id = j.owner_id and is_default and connector = j.runtime;
  return r;
end;
$$;

-- 0089's, keeping the claiming account's computer current.
create or replace function cloud.runner_job_seen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cloud.runner_machines set last_active_at = now()
  where owner_id = coalesce(new.claimed_by, new.owner_id) and machine_id = new.claimed_machine;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Runner
-- ---------------------------------------------------------------------------

-- 0048's, held by the account whose Runner claimed it.
create or replace function cloud.held_runner_job(p_subject uuid, p_machine uuid, p_job uuid)
returns cloud.runner_jobs
language plpgsql
stable
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  perform cloud.require_owner(coalesce(v_job.claimed_by, v_job.owner_id), p_subject);
  if v_job.state <> 'claimed' or v_job.claimed_machine <> p_machine or cloud.runner_job_interrupted(v_job) then
    return null;
  end if;
  return v_job;
end;
$$;

-- 0089's, with the members' jobs pinned to a computer this account shares.
create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_runner cloud.runners := cloud.runner_for(p_subject, p_machine);
begin
  if v_runner.owner_id is null then return '[]'::json; end if;
  perform cloud.v1_requeue_lapsed(p_subject);
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at, j.seq)
    from cloud.runner_jobs j
    where (j.owner_id = p_subject or j.machine_id = p_machine and cloud.runner_job_host(j) = p_subject
           or j.claimed_by = p_subject)
      and (j.machine_id is null or j.machine_id = p_machine)
      and (j.agent is null or v_runner.protocol >= 6 and exists (select 1 from cloud.project_folders f
                                      where f.project_id = j.project_id and f.machine_id = p_machine))
      and ((j.state = 'waiting' and not cloud.runner_job_queued(j) and not cloud.runner_job_removed(j, p_machine))
           or (j.state = 'claimed' and j.claimed_machine = p_machine and coalesce(j.claimed_by, j.owner_id) = p_subject
               and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
end;
$$;

-- 0089's, a computer's owner claiming a member's job pinned to it while it is shared.
create or replace function api.claim_runner_job(
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
  v_job cloud.runner_jobs;
  t cloud.tasks;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    return json_build_object('claimed', false, 'reason', 'This computer is not your connected Runner.');
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such job.');
  end if;
  if v_job.owner_id <> p_subject
     and (v_job.machine_id is distinct from p_machine or cloud.runner_job_host(v_job) is distinct from p_subject) then
    perform cloud.require_owner(v_job.owner_id, p_subject);
  end if;
  if v_job.task_id is not null then
    if not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
      return json_build_object('claimed', false, 'reason', 'There is no such job.');
    end if;
    perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id));
    perform 1 from cloud.tasks where id = v_job.task_id for update;
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job for update;
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
  end if;
  if cloud.runner_job_removed(v_job, p_machine) then
    return json_build_object('claimed', false, 'reason', 'This computer was removed from that workspace.');
  end if;
  if cloud.runner_job_queued(v_job) then
    return json_build_object('claimed', false, 'reason', 'An earlier job of this task has not ended.');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.runner_jobs
     set state = 'claimed',
         claimed_machine = p_machine,
         claimed_by = p_subject,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_job.flow is not null then
    update cloud.tasks set status = 'running', updated_at = now() where id = v_job.task_id and status = 'queued'
    returning * into t;
    if t.id is not null then perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t)); end if;
  end if;
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

-- 0090's, asking the protocol of the Runner holding the job.
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
                                         where r.owner_id = p_subject and r.machine_id = p_machine), 0) < v_knows then
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

-- 0068's: the folder and runtime settings are for the Runner holding the job, never another reader.
create or replace function api.read_runner_job(p_subject uuid, p_job uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  if v_job.flow is null or not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_job.claimed_by is distinct from p_subject then perform cloud.require_owner(v_job.owner_id, p_subject); end if;
  end if;
  v_json := cloud.runner_job_json(v_job)::jsonb;
  if p_subject is distinct from coalesce(v_job.claimed_by, cloud.runner_job_host(v_job), v_job.owner_id) then
    v_json := v_json || '{"projectDir": null, "settings": {}}';
  end if;
  return json_build_object('job', (v_json || jsonb_build_object('reply', v_job.reply, 'usage', v_job.usage, 'costUsd', v_job.cost_usd))::json);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- 0092's, with the computer holding the step's Runner and its runtime's name.
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
    'job', j.id) end
  from cloud.v1_flow_job(t.id) j
  cross join lateral (select coalesce(j.claimed_by, cloud.runner_job_host(j), t.account_id) as host) h;
$$;

-- 0090's: `available` is false once the computer that ran it is no longer shared with the task's creator;
-- a resume then needs another computer.
create or replace function cloud.v1_resume_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('machine', r.machine_name,
    'available', r.owner_id = j.owner_id or cloud.runner_host(j.claimed_machine, t.workspace_id) is not distinct from r.owner_id)
  from cloud.v1_last_flow(t.id) j
  join cloud.runners r on r.owner_id = coalesce(j.claimed_by, j.owner_id) and r.machine_id = j.claimed_machine
  where t.run and t.status in ('stopped', 'failed') and (cloud.v1_flow_job(t.id)).id is null;
$$;

-- 0093's, a landing naming the Runner that made it.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
  v_by uuid := coalesce(j.claimed_by, j.owner_id);
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if t.status in ('done', 'failed', 'cancelled') or j.outcome = 'conflict' then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'stopped' then
    update cloud.tasks set status = 'stopped', updated_at = now() where id = t.id returning * into t;
  elsif j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif (j.flow ->> 'verb' = 'implement' or (j.flow ->> 'verb' = 'create' and (j.flow ->> 'skip_plan')::boolean))
        and jsonb_typeof(r) is distinct from 'object' then
    update cloud.tasks set status = 'done', result = j.reply, updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = v_by and x.machine_id = j.claimed_machine), '')) end,
      landed_owner = case when jsonb_typeof(l) = 'object' then v_by end,
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

-- 0090's, asking the protocol of the Runner holding the step.
create or replace function api.v1_stop_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
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
                                where r.owner_id = coalesce(j.claimed_by, j.owner_id) and r.machine_id = j.claimed_machine), 0) >= 10 then j.id end);
end;
$$;

-- 0092's, `machine` pinning the task to a computer.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  m jsonb := p_fields -> 'metadata';
  v_project text := p_fields ->> 'project';
  v_ws text;
begin
  v_ws := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_fields #>> '{context,workflow}' is not null then
    if p_workflow ->> 'id' <> 'wf_builtin_workflow_builder' then
      perform cloud.v1_refuse('Only the Workflow builder changes a workflow.');
    end if;
    if not exists (select 1 from cloud.workflows w where w.id = p_fields #>> '{context,workflow}' and w.workspace_id = v_ws) then
      perform cloud.v1_missing('workflow');
    end if;
  end if;
  if p_max_tasks is not null and coalesce((p_fields ->> 'run')::boolean, false)
     and cloud.v1_open_tasks((select w.account_id from cloud.v1_workspaces w where w.id = v_ws)) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
  end if;
  if coalesce((p_fields ->> 'skip_plan')::boolean, false) and not coalesce((p_fields ->> 'run')::boolean, false) then
    raise exception 'skip_plan needs run.' using errcode = 'AKB28';
  end if;
  if p_fields ? 'runtime' then perform cloud.v1_own_runtime(p_account, p_fields ->> 'runtime'); end if;
  if (p_workflow ->> 'builtin')::boolean then
    if not cloud.v1_installed(v_ws, p_workflow ->> 'id') then perform cloud.v1_missing('workflow'); end if;
    v := cloud.v1_builtin_version(p_workflow);
  else
    select v2.* into v from cloud.workflows w
      join cloud.workflow_versions v2 on v2.workflow_id = w.id and v2.version = w.version
     where w.id = p_workflow ->> 'id' and w.workspace_id = v_ws;
    if not found then perform cloud.v1_missing('workflow'); end if;
  end if;
  insert into cloud.tasks (id, account_id, workspace_id, project_id, workflow, workflow_version, title, request, source,
                           source_context, context, run, runtime, skip_plan, images, machine_id)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime',
          coalesce((p_fields ->> 'skip_plan')::boolean, false), coalesce(p_fields -> 'images', '[]'),
          case when coalesce((p_fields ->> 'run')::boolean, false)
            then cloud.v1_task_machine(p_account, v_ws, v_project, (p_fields ->> 'machine')::uuid) end)
  returning * into t;
  if jsonb_typeof(m) = 'object' then
    update cloud.tasks set card_metadata = jsonb_strip_nulls(jsonb_build_object(
        'priority', m -> 'priority', 'roi', m -> 'roi', 'modules', m -> 'modules',
        'related', case when m ? 'related' then cloud.v1_task_refs(t, m -> 'related', 'related') end,
        'blocked_by', case when m ? 'blocked_by' then cloud.v1_task_refs(t, m -> 'blocked_by', 'blocked_by') end))
    where id = t.id returning * into t;
  end if;
  if t.run then
    j := cloud.v1_dispatch_flow(t.id, 'create', t.request);
    perform cloud.v1_refuse_removed(j.id, v_ws);
    insert into cloud.task_chats (task_id, account_id, job_id) values (t.id, p_account, j.id);
    insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
    values (cloud.v1_id('msg'), t.id, p_account, 'user', coalesce(nullif(btrim(t.request), ''), t.title),
            cloud.v1_image_names(t.images));
    perform cloud.v1_chat_changed(t.id, p_account);
    select * into t from cloud.tasks where id = t.id;
  end if;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- 0103's, passing the picked computer on.
create or replace function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_max_tasks integer default null, p_expected_version integer default null, p_skip_plan boolean default false,
  p_machine uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
  i cloud.discussion_ideas;
  t cloud.tasks;
  v_task jsonb;
  v_job uuid;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_discussion for update;
  if d.request_id is not null then
    select * into t from cloud.tasks where id = (
      select x.task_id from cloud.discussion_ideas x where x.id = p_idea and x.discussion_id = d.id and x.state = 'started');
    if t.id is not null then return cloud.v1_task_json(t); end if;
    if d.version is distinct from p_expected_version then
      raise exception 'The ideas changed since version %; read them and start again.', p_expected_version using errcode = 'AKB27';
    end if;
  end if;
  i := cloud.v1_open_idea(d, p_idea);
  if p_workflow ->> 'id' is distinct from i.workflow then perform cloud.v1_refuse('This idea''s workflow has changed.'); end if;
  v_task := api.v1_create_task(p_account, jsonb_strip_nulls(jsonb_build_object(
      'title', i.title,
      'request', btrim(concat(i.outcome, E'\n\n## Done when\n' || (
        select string_agg('- ' || btrim(a), E'\n' order by n) from jsonb_array_elements_text(i.acceptance) with ordinality x(a, n))),
        E'\n'),
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true, 'skip_plan', p_skip_plan,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account),
      'machine', p_machine)),
    p_workflow, p_daily_write_budget, p_max_tasks);
  update cloud.tasks set discussion_id = p_discussion where id = v_task ->> 'id' returning * into t;
  for v_job in select j.id from cloud.runner_jobs j where j.task_id = t.id and j.state = 'waiting' loop
    perform cloud.v1_carry_session(v_job, t.account_id);
  end loop;
  update cloud.discussion_ideas set state = 'started', task_id = t.id, updated_at = now() where id = p_idea;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_task_json(t);
end;
$$;
drop function api.v1_start_idea(uuid, text, text, text, jsonb, integer, integer, integer, boolean);

-- 0094's: a session lives on the computer that made it, so a job on someone else's shared computer
-- reads the discussion afresh.
create or replace function cloud.v1_carry_session(p_job uuid, p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  d cloud.discussions;
  h cloud.task_chats;
  v_key text;
  v_own boolean;
  v_here boolean;
begin
  select * into j from cloud.runner_jobs where id = p_job;
  select x.* into d from cloud.tasks t join cloud.discussions x on x.id = t.discussion_id where t.id = j.task_id;
  if d.id is null then return; end if;
  select * into h from cloud.task_chats where task_id = j.task_id and account_id = p_account;
  v_key := cloud.v1_session_key(j.runtime, j.model);
  v_here := coalesce(cloud.runner_job_host(j), j.owner_id) = j.owner_id;
  v_own := v_here and h.session is not null and h.session_runtime is not distinct from v_key;
  update cloud.runner_jobs set transcript_of = d.id,
    resume = case when v_own then h.session when v_here and d.session_runtime is not distinct from v_key then d.session end,
    fork = v_here and not v_own and d.session is not null and d.session_runtime is not distinct from v_key
  where id = p_job;
end;
$$;

-- 0092's: resumed where it ran while that computer is still there; given another `p_machine`, the
-- last step starts afresh there, even one that never ran.
drop function api.v1_resume_task(uuid, text, integer);
create function api.v1_resume_task(p_account uuid, p_id text, p_daily_write_budget integer, p_machine uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  l cloud.runner_jobs;
  j cloud.runner_jobs;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
  v_resume jsonb;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  v_resume := cloud.v1_resume_json(t);
  l := cloud.v1_last_flow(p_id);
  if p_machine is not null and not (coalesce((v_resume ->> 'available')::boolean, false) and p_machine = l.claimed_machine) then
    if not t.run or t.status not in ('stopped', 'failed') or (cloud.v1_flow_job(p_id)).id is not null or l.id is null then
      perform cloud.v1_refuse('This task cannot be resumed.');
    end if;
    update cloud.tasks set machine_id = cloud.v1_task_machine(t.account_id, v_ws, t.project_id, p_machine) where id = p_id;
    j := cloud.v1_dispatch_flow(p_id, l.flow ->> 'verb', l.flow ->> 'text');
    perform cloud.v1_refuse_removed(j.id, v_ws);
    select * into t from cloud.tasks where id = p_id;
    perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    return cloud.v1_task_json(t);
  end if;
  if v_resume is null then perform cloud.v1_refuse('This task cannot be resumed.'); end if;
  if not (v_resume ->> 'available')::boolean then perform cloud.v1_runner_unavailable(); end if;
  insert into cloud.runner_jobs (owner_id, runtime, model, runtime_id, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (l.owner_id, l.runtime, l.model, l.runtime_id, l.project_id, l.project_dir, l.claimed_machine, l.task_id, l.prompt,
          l.flow || jsonb_strip_nulls(jsonb_build_object('card', t.run_card, 'resume', true)))
  returning * into j;
  -- 0088's binding follows the runtime's Runner; the work is on this computer.
  update cloud.runner_jobs set machine_id = l.claimed_machine,
    project_dir = coalesce((select f.path from cloud.project_folders f
                             where f.project_id = l.project_id and f.machine_id = l.claimed_machine and f.account_id = l.owner_id), l.project_dir)
   where id = j.id;
  perform cloud.v1_refuse_removed(j.id, v_ws);
  perform cloud.hint_runner(coalesce(l.claimed_by, t.account_id), j.id);
  update cloud.tasks set status = 'queued', failure = null, result = null, updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- 0094's, a chat on a task pinned to a shared computer going to it on its owner's runtime.
create or replace function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
                                   p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  r cloud.runtimes;
  v_pick text;
  v_ready text;
  v_key text;
  v_job uuid;
  v_host uuid;
begin
  select * into t from cloud.tasks where id = p_task for update;
  v_host := cloud.v1_task_host(t);
  if v_host is null then perform cloud.v1_runner_unavailable(); end if;
  insert into cloud.task_chats (task_id, account_id) values (p_task, p_account) on conflict do nothing;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if v_host <> t.account_id then
    r := cloud.v1_host_runtime(v_host, t.machine_id);
  else
    v_pick := case when p_runtime is null then h.runtime when p_runtime = 'task' then null
                   else (cloud.v1_own_runtime(p_account, p_runtime)).id end;
    if v_pick is null then r := cloud.v1_task_runtime(t);
    else select * into r from cloud.runtimes where id = v_pick;
    end if;
  end if;
  if not exists (select 1 from cloud.runners x where x.owner_id = v_host and x.live_until > now()
                   and (v_host = t.account_id or x.machine_id = t.machine_id)) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_ready := cloud.v1_connectors(v_host) ->> r.connector;
  if v_ready in ('not_installed', 'signed_out') then
    raise exception '% is not ready on the computer running this task.', r.connector
      using errcode = 'AKB30', detail = r.connector, hint = v_ready;
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', coalesce(p_body, ''), cloud.v1_image_names(p_images));
  v_job := (api.dispatch_runner_job(t.account_id, r.connector, null, cloud.task_chat_prompt(p_task, p_account),
                                    cloud.v1_image_files(p_images), p_daily_write_budget, p_task) ->> 'id')::uuid;
  perform cloud.v1_refuse_removed(v_job, t.workspace_id);
  v_key := cloud.v1_session_key(r.connector, r.model);
  update cloud.runner_jobs set model = r.model,
    resume = case when h.session_runtime is not distinct from v_key then h.session end
  where id = v_job;
  perform cloud.v1_carry_session(v_job, p_account);
  update cloud.task_chats set runtime = v_pick, job_id = v_job, failure = null,
    session = case when session_runtime is distinct from v_key then null else session end,
    context = case when session_runtime is distinct from v_key then null else context end,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sharing
-- ---------------------------------------------------------------------------

-- Ends a share: the members' work on that computer stops and their tasks are no longer pinned
-- there. Answers the running jobs whose Runner is told now.
create function cloud.runner_unshare(p_workspace text, p_machine uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_host uuid;
  j cloud.runner_jobs;
  t cloud.tasks;
  v_stop jsonb := '[]';
begin
  delete from cloud.shared_runners where workspace_id = p_workspace and machine_id = p_machine returning owner_id into v_host;
  if v_host is null then return v_stop; end if;
  for j in select x.* from cloud.runner_jobs x
    where x.owner_id <> v_host and x.state <> 'finished' and not cloud.runner_job_interrupted(x)
      and (x.claimed_by = v_host and x.claimed_machine = p_machine or x.state = 'waiting' and x.machine_id = p_machine)
      and cloud.runner_job_workspace(x) = p_workspace
    order by x.seq for update
  loop
    if j.state = 'claimed' then
      update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = j.id;
      if j.flow is not null and coalesce((select r.protocol from cloud.runners r
                                          where r.owner_id = v_host and r.machine_id = p_machine), 0) >= 10 then
        v_stop := v_stop || to_jsonb(j.id);
      end if;
    elsif j.flow is not null then
      perform cloud.v1_end_stopped_flow(j.id);
    else
      perform cloud.v1_end_stopped(j.id);
    end if;
  end loop;
  for t in update cloud.tasks set machine_id = null, updated_at = now()
    where workspace_id = p_workspace and machine_id = p_machine and account_id <> v_host returning *
  loop
    perform cloud.v1_emit(p_workspace, 'task.updated', cloud.v1_task_json(t));
  end loop;
  return v_stop;
end;
$$;

-- `{ result, stop }`: `stop` is the running jobs whose Runner the Worker tells now.
create function api.v1_share_runner(p_account uuid, p_workspace text, p_machine uuid, p_shared boolean, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  v_stop jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if not exists (select 1 from cloud.project_folders f join cloud.projects p on p.id = f.project_id
                 where p.workspace_id = v_ws and f.machine_id = p_machine and f.account_id = p_account) then
    perform cloud.v1_missing('runner');
  end if;
  if (select w.personal from cloud.v1_workspaces w where w.id = v_ws) then
    perform cloud.v1_refuse('A personal workspace has no members to share with.');
  end if;
  if p_shared then
    insert into cloud.shared_runners (workspace_id, machine_id, owner_id) values (v_ws, p_machine, p_account)
    on conflict do nothing;
    if cloud.runner_host(p_machine, v_ws) <> p_account then perform cloud.v1_missing('runner'); end if;
  elsif cloud.runner_host(p_machine, v_ws) = p_account then
    v_stop := cloud.runner_unshare(v_ws, p_machine);
  end if;
  perform cloud.v1_emit(v_ws, 'workspace.updated', jsonb_build_object('object', 'workspace', 'id', v_ws));
  return jsonb_build_object('stop', v_stop, 'result',
    jsonb_build_object('object', 'runner', 'workspace', v_ws, 'machine', p_machine, 'shared', p_shared));
end;
$$;

-- 0089's, ending the computer's share too.
create or replace function api.v1_remove_workspace_runner(p_account uuid, p_workspace text, p_machine uuid, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  v_stop jsonb;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  delete from cloud.project_folders f using cloud.projects p
  where p.id = f.project_id and p.workspace_id = v_ws and f.machine_id = p_machine;
  if not found then perform cloud.v1_missing('runner'); end if;
  insert into cloud.removed_runners (workspace_id, machine_id) values (v_ws, p_machine)
  on conflict do nothing;
  v_stop := cloud.runner_unshare(v_ws, p_machine);
  return jsonb_build_object('stop', v_stop, 'result',
    jsonb_build_object('object', 'runner', 'workspace', v_ws, 'machine', p_machine, 'deleted', true));
end;
$$;

-- A member leaving takes their shares with them.
create function cloud.member_left_unshares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.runner_unshare(s.workspace_id, s.machine_id)
  from cloud.shared_runners s where s.workspace_id = old.workspace_id and s.owner_id = old.account_id;
  return null;
end;
$$;

create trigger member_left_unshares after delete on cloud.v1_workspace_members
for each row execute function cloud.member_left_unshares();

-- 0102's, with `owner_account`, `shared`, the workspace's `projects` there and, on the caller's own
-- computer, the members' tasks running on it.
create or replace function api.v1_list_workspace_runners(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
begin
  return jsonb_build_object('runners', coalesce((
    select jsonb_agg(jsonb_build_object('machine', x.machine_id, 'name', x.name, 'owner', x.owner,
                                        'owner_account', x.owner_id, 'connected', x.connected, 'last_active', x.last_active,
                                        'shared', x.shared, 'projects', x.projects)
                     || case when x.owner_id = p_account then jsonb_build_object('runs', (
                          select jsonb_build_object('count', count(distinct j.task_id),
                                                    'by', coalesce(jsonb_agg(distinct coalesce(nullif(a.name, ''), a.handle)), '[]'))
                          from cloud.runner_jobs j
                          join cloud.tasks k on k.id = j.task_id and k.workspace_id = v_ws
                          join cloud.accounts a on a.id = j.owner_id
                          where j.owner_id <> p_account and j.state <> 'finished' and not cloud.runner_job_interrupted(j)
                            and (j.claimed_by = p_account and j.claimed_machine = x.machine_id
                                 or j.state = 'waiting' and j.machine_id = x.machine_id))) else '{}' end
                     order by x.connected desc, x.last_active desc nulls last, x.machine_id)
    from (
      select f.machine_id, a.id as owner_id,
             coalesce(max(nullif(m.machine_name, '')), '') as name,
             coalesce(nullif(a.name, ''), a.handle, '') as owner,
             bool_or(r.live_until > now() and r.machine_id = f.machine_id) is true as connected,
             max(m.last_active_at) as last_active,
             cloud.runner_host(f.machine_id, v_ws) is not distinct from a.id as shared,
             jsonb_agg(distinct f.project_id) as projects
      from cloud.project_folders f
      join cloud.projects p on p.id = f.project_id and p.workspace_id = v_ws
      join cloud.v1_workspace_members wm on wm.workspace_id = v_ws and wm.account_id = f.account_id
      join cloud.accounts a on a.id = f.account_id
      left join cloud.runner_machines m on m.owner_id = f.account_id and m.machine_id = f.machine_id
      left join cloud.runners r on r.owner_id = f.account_id
      group by f.machine_id, a.id
    ) x), '[]'));
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname like 'v1\_%') or (n.nspname = 'cloud' and p.proname like 'v1\_%')
       or (n.nspname = 'cloud' and p.proname in ('runner_host', 'runner_job_workspace', 'runner_job_host', 'runner_job_pinned',
                                                 'runner_unshare', 'member_left_unshares'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
