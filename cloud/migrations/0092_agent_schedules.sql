-- What the agents page sets for a scheduled agent (#2138), kept here rather than on the board's
-- `schedules.md` so a finished task can see it.
--
-- - **A row per agent off its default**: switched off, or on another cadence; keyed like
--   `project_agents`, by the job it runs.
-- - **Switched off, a finished task queues nothing for it**: no reflect and none of what it would
--   read, no describe-project. Run now still queues one.
-- - **Switching one off drops its jobs still waiting.**

create table cloud.agent_schedules (
  project_id text not null references cloud.projects (id) on delete cascade,
  agent text not null check (agent ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  workflow text not null default '',
  enabled boolean not null,
  -- Null: its default.
  cadence text check (cadence is null or length(cadence) between 1 and 64),
  primary key (project_id, agent, workflow)
);
alter table cloud.agent_schedules enable row level security;

create function cloud.agent_off(p_project text, p_agent text, p_workflow text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from cloud.agent_schedules s
    where s.project_id = p_project and s.agent = p_agent and s.workflow = p_workflow and not s.enabled);
$$;

create function cloud.agent_schedules_json(p_project text) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('agent', s.agent, 'workflow', nullif(s.workflow, ''), 'on', s.enabled, 'cadence', s.cadence)
                            order by s.agent, s.workflow), '[]')
  from cloud.agent_schedules s where s.project_id = p_project;
$$;

-- Each `{ agent, workflow, on, cadence }`: on at its default drops the row.
create function cloud.set_agent_schedules(p_project text, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_workflow text;
begin
  for r in select jsonb_array_elements(p_rows) loop
    v_workflow := coalesce(r ->> 'workflow', '');
    if (r ->> 'on')::boolean and r ->> 'cadence' is null then
      delete from cloud.agent_schedules where project_id = p_project and agent = r ->> 'agent' and workflow = v_workflow;
    else
      insert into cloud.agent_schedules (project_id, agent, workflow, enabled, cadence)
      values (p_project, r ->> 'agent', v_workflow, (r ->> 'on')::boolean, r ->> 'cadence')
      on conflict (project_id, agent, workflow) do update set enabled = excluded.enabled, cadence = excluded.cadence;
    end if;
    if not (r ->> 'on')::boolean then
      delete from cloud.runner_jobs j
       where j.project_id = p_project and j.agent ->> 'name' = r ->> 'agent'
         and coalesce(j.agent ->> 'workflow', '') = v_workflow and j.state = 'waiting';
    end if;
  end loop;
end;
$$;

create function api.v1_agent_schedules(p_account uuid, p_project text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_project);
  return cloud.agent_schedules_json(p_project);
end;
$$;

create function api.v1_set_agent_schedules(p_account uuid, p_project text, p_rows jsonb, p_daily_write_budget integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'project', p_project), p_daily_write_budget);
  perform cloud.set_agent_schedules(p_project, p_rows);
end;
$$;

-- The one-off move of a project's `schedules.md` (cloud/scripts/schedules-move.mjs).
create function api.move_agent_schedules(p_project text, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.projects where id = p_project) then perform cloud.v1_missing('project'); end if;
  perform cloud.set_agent_schedules(p_project, p_rows);
end;
$$;

-- 0079's, leaving a task finished while reflect is off already read.
create or replace function cloud.task_reflect_waiting() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.reflect_waiting := not cloud.agent_off(new.project_id, 'reflect', '');
  return new;
end;
$$;

-- 0079's, a reflect going on only while reflect is on.
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
    if not cloud.agent_off(new.project_id, 'reflect', '')
       and exists (select 1 from cloud.tasks t where t.project_id = new.project_id and t.reflect_waiting and t.number is not null) then
      perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', null);
    end if;
  end if;
  return null;
end;
$$;

-- 0079's, queuing reflect and describe-project only while each is on.
create or replace function cloud.task_done_agents() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  r cloud.runner_jobs;
  v_owner uuid := (select p.account_id from cloud.projects p where p.id = new.project_id);
begin
  if v_owner is null then return null; end if;
  if not cloud.agent_off(new.project_id, 'reflect', '') then
    perform cloud.queue_agent_job(new.project_id, '{"name": "reflect"}', null);
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

-- 0079's, with what the agents page set.
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
    'reflectWaiting', exists (select 1 from cloud.tasks t where t.project_id = p_project and t.reflect_waiting and t.number is not null),
    'dismissalsWaiting', exists (select 1 from cloud.tasks t where t.workspace_id = p.workspace_id and t.cancel_reviewed = false)
      or exists (select 1 from cloud.triage_items i where i.workspace_id = p.workspace_id and i.reviewed = false)
  );
end;
$$;

revoke all on function cloud.agent_off(text, text, text) from public;
revoke all on function cloud.agent_schedules_json(text) from public;
revoke all on function cloud.set_agent_schedules(text, jsonb) from public;
revoke all on function api.v1_agent_schedules(uuid, text) from public;
revoke all on function api.v1_set_agent_schedules(uuid, text, jsonb, integer) from public;
revoke all on function api.move_agent_schedules(text, jsonb) from public;
grant execute on function api.v1_agent_schedules(uuid, text) to service_role;
grant execute on function api.v1_set_agent_schedules(uuid, text, jsonb, integer) to service_role;
grant execute on function api.move_agent_schedules(text, jsonb) to service_role;
