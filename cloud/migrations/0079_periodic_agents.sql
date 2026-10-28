-- The board's periodic agents, run on the Owner's Runner (#2068).
--
-- - **An agent job**: `runner_jobs.agent` `{ name, workflow?, tasks? }`, on a project and no task.
--   At most one waits or runs per project, agent and workflow.
-- - **The Runner says when one is due**, by its own clock, off `api.runner_agents`; Cloud only
--   dedupes and records the last pass that passed. Nothing here runs on a timer.
-- - **A finished task** queues a reflect over its project's tasks not yet reflected on, its
--   chat's review on the computer that answered it (#2065), and the project's description once
--   six hours have passed since the last.
-- - **A lapsed agent job goes back to the queue** once, for whichever computer has the folder.

alter table cloud.runner_jobs
  add column agent jsonb check (agent is null or (agent ->> 'name') ~ '^[a-z0-9][a-z0-9-]{0,63}$');
create index runner_jobs_agent on cloud.runner_jobs (project_id, (agent ->> 'name'), created_at desc) where agent is not null;

-- Set as a task finishes, cleared once a reflect has read it; tasks finished before stay clear.
alter table cloud.tasks add column reflect_waiting boolean not null default false;
create index tasks_reflect_waiting on cloud.tasks (project_id, closed_at) where reflect_waiting;

create table cloud.project_agents (
  project_id text not null references cloud.projects (id) on delete cascade,
  agent text not null,
  -- A workflow's scheduled agent names its workflow; the board's own agents ''.
  workflow text not null default '',
  -- When the last pass that passed began.
  last_success timestamptz not null,
  primary key (project_id, agent, workflow)
);
alter table cloud.project_agents enable row level security;

create function cloud.agent_job_open(p_project text, p_agent text, p_workflow text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from cloud.runner_jobs j
    where j.project_id = p_project and j.agent ->> 'name' = p_agent and coalesce(j.agent ->> 'workflow', '') = p_workflow
      and j.state <> 'finished' and not cloud.runner_job_interrupted(j));
$$;

-- A new agent job on the project, on the runtime its last job ran; none while one is open.
create function cloud.queue_agent_job(p_project text, p_agent jsonb, p_machine uuid) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  v_last cloud.runner_jobs;
  v_job cloud.runner_jobs;
begin
  select * into p from cloud.projects where id = p_project;
  if p.id is null or cloud.agent_job_open(p_project, p_agent ->> 'name', coalesce(p_agent ->> 'workflow', '')) then
    return v_job;
  end if;
  select j.* into v_last from cloud.runner_jobs j left join cloud.tasks t on t.id = j.task_id
   where j.owner_id = p.account_id and coalesce(j.project_id, t.project_id) = p_project and not j.test
   order by j.created_at desc limit 1;
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, machine_id, prompt, agent)
  values (p.account_id, coalesce(v_last.runtime, 'claude-code'), v_last.model, p_project, p_machine,
          'Run ' || (p_agent ->> 'name') || '.', p_agent)
  returning * into v_job;
  perform cloud.hint_runner(p.account_id, v_job.id);
  return v_job;
end;
$$;

-- A reflect reads the tasks waiting as it is claimed, ten at a time.
create function cloud.agent_job_claimed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.agent ->> 'name' = 'reflect' and not (new.agent ? 'tasks') then
    new.agent := new.agent || jsonb_build_object('tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number) order by x.closed_at, x.id)
      from (select t.id, t.number, t.closed_at from cloud.tasks t
            where t.project_id = new.project_id and t.reflect_waiting and t.number is not null
            order by t.closed_at, t.id limit 10) x), '[]'::jsonb));
  end if;
  return new;
end;
$$;

create trigger runner_jobs_agent_claimed before update of state on cloud.runner_jobs
  for each row when (new.agent is not null and old.state = 'waiting' and new.state = 'claimed')
  execute function cloud.agent_job_claimed();

-- A pass that passed is recorded; a reflect clears what it read, and goes on while more wait.
create function cloud.agent_job_finished() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.outcome <> 'done' then return null; end if;
  insert into cloud.project_agents (project_id, agent, workflow, last_success)
  values (new.project_id, new.agent ->> 'name', coalesce(new.agent ->> 'workflow', ''), new.created_at)
  on conflict (project_id, agent, workflow) do update
    set last_success = greatest(cloud.project_agents.last_success, excluded.last_success);
  if new.agent ->> 'name' = 'reflect' then
    update cloud.tasks set reflect_waiting = false
     where project_id = new.project_id and reflect_waiting
       and id in (select e ->> 'id' from jsonb_array_elements(coalesce(new.agent -> 'tasks', '[]')) e);
    if exists (select 1 from cloud.tasks t where t.project_id = new.project_id and t.reflect_waiting and t.number is not null) then
      perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', null);
    end if;
  end if;
  return null;
end;
$$;

create trigger runner_jobs_agent_finished after update of state on cloud.runner_jobs
  for each row when (new.agent is not null and old.state <> 'finished' and new.state = 'finished')
  execute function cloud.agent_job_finished();

-- A finished task: its reflect, its chat's review, and the project's description.
create function cloud.task_done_agents() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  r cloud.runner_jobs;
  v_owner uuid := (select p.account_id from cloud.projects p where p.id = new.project_id);
begin
  if v_owner is null then return null; end if;
  perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', null);
  if not exists (select 1 from cloud.runner_jobs j where j.project_id = new.project_id
                   and j.agent ->> 'name' = 'describe-project' and j.created_at > now() - interval '6 hours') then
    perform cloud.queue_agent_job(new.project_id, '{"name": "describe-project"}', null);
  end if;

  select * into h from cloud.task_chats
   where task_id = new.id and account_id = v_owner and machine_id is not null;
  if h.task_id is null then return null; end if;
  select j.* into r from cloud.runner_jobs j
   where j.owner_id = v_owner and j.project_id = new.project_id and j.review is not null and j.state <> 'finished'
     and not cloud.runner_job_interrupted(j)
   limit 1;
  if r.id is null then
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, prompt, review)
    select v_owner, coalesce(q.runtime, 'claude-code'), q.model, new.project_id, f.path, h.machine_id,
           'Review chat memory.', jsonb_build_object('tasks', jsonb_build_array(new.id))
    from (select 1) one
    left join cloud.project_folders f on f.project_id = new.project_id and f.machine_id = h.machine_id
    left join lateral (select j.runtime, j.model from cloud.runner_jobs j
                       where j.task_id = new.id and not j.test order by j.created_at desc limit 1) q on true
    returning * into r;
    perform cloud.hint_runner(v_owner, r.id);
  elsif r.state = 'waiting' and r.machine_id = h.machine_id and not (r.review -> 'tasks') ? new.id then
    update cloud.runner_jobs set review = jsonb_set(review, '{tasks}', (review -> 'tasks') || to_jsonb(new.id)), updated_at = now()
     where id = r.id;
  end if;
  return null;
end;
$$;

create function cloud.task_reflect_waiting() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.reflect_waiting := true;
  return new;
end;
$$;

create trigger tasks_reflect_waiting before update of status on cloud.tasks
  for each row when (new.status = 'done' and old.status <> 'done' and new.project_id is not null)
  execute function cloud.task_reflect_waiting();

create trigger tasks_done_agents after update of status on cloud.tasks
  for each row when (new.status = 'done' and old.status <> 'done' and new.project_id is not null)
  execute function cloud.task_done_agents();

-- 0075's, with an agent job's folder: the claiming computer's own.
create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'model', p_job.model,
    'test', p_job.test,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', coalesce(p_job.project_dir, case when p_job.agent is not null then
      (select f.path from cloud.project_folders f
        where f.project_id = p_job.project_id and f.machine_id = coalesce(p_job.claimed_machine, p_job.machine_id)) end),
    'task', p_job.task_id,
    'discussion', (select json_build_object('id', d.id, 'workspace', d.workspace_id,
        'ideas', coalesce((select json_agg(json_build_object('id', i.id, 'title', i.title, 'outcome', i.outcome,
            'acceptance', i.acceptance, 'workflow', i.workflow, 'task', i.task_id) order by i.seq)
          from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'::json))
      from cloud.discussions d where d.id = p_job.discussion_id),
    'chat', (select json_build_object('message', m.id, 'body', m.body)
      from cloud.task_chats h
      cross join lateral (select m.id, m.body from cloud.task_chat_messages m
                          where m.task_id = h.task_id and m.account_id = h.account_id and m.role = 'user'
                          order by m.seq desc limit 1) m
      where h.job_id = p_job.id limit 1),
    'review', p_job.review,
    'agent', p_job.agent,
    'stage', p_job.stage,
    'flow', p_job.flow,
    'number', (select t.number from cloud.tasks t where t.id = p_job.task_id),
    'workflow', (select v.workflow_id from cloud.tasks t join cloud.workflow_versions v on v.id = t.workflow_version
                 where t.id = p_job.task_id),
    'attempt', p_job.attempt,
    'resume', p_job.resume,
    'prompt', p_job.prompt,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;

-- 0066's, offering an agent job only to a Runner that knows one (protocol 6) with the project's folder.
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
    where j.owner_id = p_subject
      and (j.machine_id is null or j.machine_id = p_machine)
      and (j.agent is null or v_runner.protocol >= 6 and exists (select 1 from cloud.project_folders f
                                      where f.project_id = j.project_id and f.machine_id = p_machine))
      and ((j.state = 'waiting' and not cloud.runner_job_queued(j))
           or (j.state = 'claimed' and j.claimed_machine = p_machine and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
end;
$$;

-- 0066's, and an agent job's lapsed lease too: queued once more, for any computer.
create or replace function cloud.v1_requeue_lapsed(p_owner uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  r cloud.runner_jobs;
  n integer := 0;
begin
  for j in
    select * from cloud.runner_jobs x
    where x.task_id is not null and x.attempt < 2 and cloud.runner_job_interrupted(x)
      and (p_owner is null or x.owner_id = p_owner)
    order by x.seq for update skip locked
  loop
    perform cloud.v1_lock(cloud.v1_task_workspace(j.task_id));
    update cloud.runner_jobs x set state = 'finished', outcome = 'failed', reason = 'The Runner stopped before this step finished.',
      finished_at = now(), updated_at = now()
    where x.id = j.id and cloud.runner_job_interrupted(x);
    if not found then continue; end if;
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, stage, flow,
                                   attempt, resume, prompt, attachments)
    values (j.owner_id, j.runtime, j.model, j.project_id, j.project_dir, j.machine_id,
            j.task_id, j.stage, j.flow, 2, j.resume, j.prompt, j.attachments)
    returning * into r;
    perform cloud.hint_runner(j.owner_id, r.id);
    update cloud.task_chats set job_id = r.id, updated_at = now() where job_id = j.id;
    n := n + 1;
  end loop;
  for j in
    select * from cloud.runner_jobs x
    where x.agent is not null and x.attempt < 2 and cloud.runner_job_interrupted(x)
      and (p_owner is null or x.owner_id = p_owner)
    order by x.seq for update skip locked
  loop
    update cloud.runner_jobs x set state = 'finished', outcome = 'failed', reason = 'The Runner stopped before this step finished.',
      finished_at = now(), updated_at = now()
    where x.id = j.id and cloud.runner_job_interrupted(x);
    if not found then continue; end if;
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, attempt, prompt, agent)
    values (j.owner_id, j.runtime, j.model, j.project_id, 2, j.prompt, j.agent)
    returning * into r;
    perform cloud.hint_runner(j.owner_id, r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- What the Runner judges a project's periodic agents due by: its workflows, each agent's last
-- pass that passed and newest attempts, and what is new for them. Only a computer with the
-- project's folder reads it.
create function api.runner_agents(p_subject uuid, p_machine uuid, p_project text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    perform cloud.v1_refuse('This computer is not your connected Runner.');
  end if;
  select * into p from cloud.projects where id = p_project and account_id = p_subject;
  if p.id is null or not exists (select 1 from cloud.project_folders f where f.project_id = p_project and f.machine_id = p_machine) then
    perform cloud.v1_missing('project');
  end if;
  return jsonb_build_object(
    'since', p.created_at,
    'builtins', coalesce((select jsonb_agg(i.workflow_id order by i.workflow_id) from cloud.workflow_installs i
                          where i.workspace_id = p.workspace_id and i.workflow_id like 'wf\_builtin\_%'), '[]'),
    'workflows', coalesce((select jsonb_agg(jsonb_build_object('id', w.id,
        'files', (select coalesce(jsonb_object_agg(f.key, f.value), '{}') from jsonb_each(v.files) f
                  where f.key = 'WORKFLOW.md' or f.key like 'agents/%/AGENT.md')) order by w.id)
      from cloud.workflows w join cloud.workflow_versions v on v.workflow_id = w.id and v.version = w.version
      where w.workspace_id = p.workspace_id), '[]'),
    'runs', coalesce((select jsonb_agg(jsonb_build_object('agent', k.agent, 'workflow', nullif(k.workflow, ''),
        'lastSuccess', (select a.last_success from cloud.project_agents a
                        where a.project_id = p_project and a.agent = k.agent and a.workflow = k.workflow),
        'attempts', (select coalesce(jsonb_agg(jsonb_build_object('startedAt', x.created_at,
              'status', case when x.state <> 'finished' then 'running' when x.outcome = 'done' then 'done' else 'error' end)
              order by x.created_at desc), '[]')
            from (select j.created_at, j.state, j.outcome from cloud.runner_jobs j
                  where j.project_id = p_project and j.agent ->> 'name' = k.agent
                    and coalesce(j.agent ->> 'workflow', '') = k.workflow
                  order by j.created_at desc limit 5) x)))
      from (select a.agent, a.workflow from cloud.project_agents a where a.project_id = p_project
            union select j.agent ->> 'name', coalesce(j.agent ->> 'workflow', '') from cloud.runner_jobs j
                  where j.project_id = p_project and j.agent is not null) k), '[]'),
    'completedAt', (select max(t.closed_at) from cloud.tasks t where t.project_id = p_project and t.status = 'done'),
    'reflectWaiting', exists (select 1 from cloud.tasks t where t.project_id = p_project and t.reflect_waiting and t.number is not null),
    'dismissalsWaiting', exists (select 1 from cloud.tasks t where t.workspace_id = p.workspace_id and t.cancel_reviewed = false)
      or exists (select 1 from cloud.triage_items i where i.workspace_id = p.workspace_id and i.reviewed = false)
  );
end;
$$;

-- The Runner's ask for an agent it judged due: none while one is open, or once a pass passed
-- after the one it read (`p_seen`). Handed to the asking computer.
create function api.request_agent_job(p_subject uuid, p_machine uuid, p_project text, p_agent text, p_workflow text,
                                      p_seen timestamptz, p_daily_write_budget integer)
returns json language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  v_job cloud.runner_jobs;
  v_last timestamptz;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    perform cloud.v1_refuse('This computer is not your connected Runner.');
  end if;
  select * into p from cloud.projects where id = p_project and account_id = p_subject;
  if p.id is null or not exists (select 1 from cloud.project_folders f where f.project_id = p_project and f.machine_id = p_machine) then
    perform cloud.v1_missing('project');
  end if;
  if p_workflow is not null and not (cloud.v1_installed(p.workspace_id, p_workflow)
       or exists (select 1 from cloud.workflows w where w.id = p_workflow and w.workspace_id = p.workspace_id)) then
    perform cloud.v1_missing('workflow');
  end if;
  select a.last_success into v_last from cloud.project_agents a
   where a.project_id = p_project and a.agent = p_agent and a.workflow = coalesce(p_workflow, '');
  if v_last is not null and (p_seen is null or v_last > p_seen) then return null; end if;
  if cloud.agent_job_open(p_project, p_agent, coalesce(p_workflow, '')) then return null; end if;
  perform cloud.count_write(p_daily_write_budget);
  v_job := cloud.queue_agent_job(p_project, jsonb_strip_nulls(jsonb_build_object('name', p_agent, 'workflow', p_workflow)), p_machine);
  return case when v_job.id is null then null else cloud.runner_job_json(v_job) end;
end;
$$;

revoke all on function cloud.agent_job_open(text, text, text) from public;
revoke all on function cloud.queue_agent_job(text, jsonb, uuid) from public;
revoke all on function cloud.agent_job_claimed() from public;
revoke all on function cloud.agent_job_finished() from public;
revoke all on function cloud.task_done_agents() from public;
revoke all on function cloud.task_reflect_waiting() from public;
revoke all on function cloud.runner_job_json(cloud.runner_jobs) from public;
revoke all on function api.list_runner_jobs(uuid, uuid) from public;
revoke all on function cloud.v1_requeue_lapsed(uuid) from public;
revoke all on function api.runner_agents(uuid, uuid, text) from public;
revoke all on function api.request_agent_job(uuid, uuid, text, text, text, timestamptz, integer) from public;
grant execute on function api.list_runner_jobs(uuid, uuid) to service_role;
grant execute on function api.runner_agents(uuid, uuid, text) to service_role;
grant execute on function api.request_agent_job(uuid, uuid, text, text, text, timestamptz, integer) to service_role;
