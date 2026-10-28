-- A task's runs and reflections stay on the computer that holds its work (#2110).
--
-- - **A step goes back to the computer of the task's last step**: its delivery and branch are
--   there. While that computer has the project's folder the job is pinned to it, offline or not.
-- - **A reflect runs where the task landed**: a landing is a commit on that computer alone. A
--   finished task queues a reflect pinned to `landed_machine`, unpinned with no landing; one is
--   open per project and computer. Claimed, it reads only the tasks landed there or nowhere;
--   finished, it queues one more per computer still holding waiting tasks.

-- 0091's dispatch, preferring the computer that claimed the task's last step.
create or replace function cloud.v1_dispatch_flow(p_task text, p_verb text, p_text text default null) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  f cloud.project_folders;
  r cloud.runtimes;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if cardinality(cloud.v1_open_blockers(t)) > 0 then
    update cloud.tasks set held_flow = jsonb_strip_nulls(jsonb_build_object('verb', p_verb,
        'text', nullif(btrim(coalesce(p_text, '')), ''))),
      status = 'queued', failure = null, result = null, updated_at = now()
    where id = p_task;
    return null;
  end if;
  r := cloud.v1_task_runtime(t);
  select x.* into f from cloud.project_folders x
    left join cloud.runners rr on rr.owner_id = t.account_id and rr.machine_id = x.machine_id and rr.live_until > now()
   where x.project_id = t.project_id and x.account_id = t.account_id
   order by rr.owner_id is not null desc, x.updated_at desc limit 1;
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (t.account_id, r.connector, r.model, t.project_id, f.path, f.machine_id, t.id,
          format('akb %s: %s', p_verb, t.title),
          jsonb_strip_nulls(jsonb_build_object('verb', p_verb, 'workflow', t.workflow ->> 'id', 'card', t.run_card,
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end,
            'metadata', case when p_verb = 'create' then nullif(t.card_metadata
              - array['phases', 'phase', 'schedule', 'parent', 'source'], '{}') end)))
  returning * into j;
  -- Past 0088's binding, as 0090's resume.
  select x.* into f from cloud.project_folders x
   where x.project_id = t.project_id and x.account_id = t.account_id
     and x.machine_id = (select y.claimed_machine from cloud.runner_jobs y
                         where y.task_id = t.id and y.flow is not null and y.claimed_machine is not null
                         order by y.seq desc limit 1);
  if found then
    update cloud.runner_jobs set machine_id = f.machine_id, project_dir = f.path where id = j.id returning * into j;
  end if;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', held_flow = null, failure = null, result = null, updated_at = now()
  where id = p_task;
  return j;
end;
$$;

-- A pinned reflect names its computer in `agent.machine`: 0088's binding moves an unpinned one.
create function cloud.reflect_job_open(p_project text, p_machine uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from cloud.runner_jobs j
    where j.project_id = p_project and j.agent ->> 'name' = 'reflect' and (j.agent ->> 'machine')::uuid is not distinct from p_machine
      and j.state <> 'finished' and not cloud.runner_job_interrupted(j));
$$;

-- 0079's, with one open reflect per computer, pinned past 0088's binding.
create or replace function cloud.queue_agent_job(p_project text, p_agent jsonb, p_machine uuid) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  v_last cloud.runner_jobs;
  v_job cloud.runner_jobs;
begin
  select * into p from cloud.projects where id = p_project;
  if p.id is null or (p_agent ->> 'name' = 'reflect' and cloud.reflect_job_open(p_project, p_machine))
     or (p_agent ->> 'name' <> 'reflect' and cloud.agent_job_open(p_project, p_agent ->> 'name', coalesce(p_agent ->> 'workflow', ''))) then
    return v_job;
  end if;
  select j.* into v_last from cloud.runner_jobs j left join cloud.tasks t on t.id = j.task_id
   where j.owner_id = p.account_id and coalesce(j.project_id, t.project_id) = p_project and not j.test
   order by j.created_at desc limit 1;
  if p_agent ->> 'name' = 'reflect' and p_machine is not null then
    p_agent := p_agent || jsonb_build_object('machine', p_machine);
  end if;
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, machine_id, prompt, agent)
  values (p.account_id, coalesce(v_last.runtime, 'claude-code'), v_last.model, p_project, p_machine,
          'Run ' || (p_agent ->> 'name') || '.', p_agent)
  returning * into v_job;
  if p_agent ? 'machine' then
    update cloud.runner_jobs set machine_id = p_machine, project_dir = null where id = v_job.id returning * into v_job;
  end if;
  perform cloud.hint_runner(p.account_id, v_job.id);
  return v_job;
end;
$$;

-- 0079's, reading the tasks landed on the claiming computer or nowhere.
create or replace function cloud.agent_job_claimed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.agent ->> 'name' = 'reflect' and not (new.agent ? 'tasks') then
    new.agent := new.agent || jsonb_build_object('tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number) order by x.closed_at, x.id)
      from (select t.id, t.number, t.closed_at from cloud.tasks t
            where t.project_id = new.project_id and t.reflect_waiting and t.number is not null
              and (t.landed_machine is null or t.landed_machine = new.claimed_machine)
            order by t.closed_at, t.id limit 10) x), '[]'::jsonb));
  end if;
  return new;
end;
$$;

-- 0079's, going on with a reflect per computer still holding waiting tasks.
create or replace function cloud.agent_job_finished() returns trigger
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
    perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', m.landed_machine)
    from (select distinct t.landed_machine from cloud.tasks t
          where t.project_id = new.project_id and t.reflect_waiting and t.number is not null) m
    where not cloud.agent_off(new.project_id, 'reflect', '');
  end if;
  return null;
end;
$$;

-- 0079's, with the reflect pinned to where the task landed.
create or replace function cloud.task_done_agents() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  r cloud.runner_jobs;
  v_owner uuid := (select p.account_id from cloud.projects p where p.id = new.project_id);
begin
  if v_owner is null then return null; end if;
  if not cloud.agent_off(new.project_id, 'reflect', '') then
    perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', new.landed_machine);
  end if;
  if not cloud.agent_off(new.project_id, 'describe-project', '')
     and not exists (select 1 from cloud.runner_jobs j where j.project_id = new.project_id
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

-- 0079's, with only the reflects this computer can do waiting.
create or replace function api.runner_agents(p_subject uuid, p_machine uuid, p_project text) returns jsonb
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
    'schedules', cloud.agent_schedules_json(p_project),
    'completedAt', (select max(t.closed_at) from cloud.tasks t where t.project_id = p_project and t.status = 'done'),
    'reflectWaiting', exists (select 1 from cloud.tasks t where t.project_id = p_project and t.reflect_waiting and t.number is not null
                              and (t.landed_machine is null or t.landed_machine = p_machine)),
    'dismissalsWaiting', exists (select 1 from cloud.tasks t where t.workspace_id = p.workspace_id and t.cancel_reviewed = false)
      or exists (select 1 from cloud.triage_items i where i.workspace_id = p.workspace_id and i.reviewed = false)
  );
end;
$$;

revoke all on function cloud.reflect_job_open(text, uuid) from public;
