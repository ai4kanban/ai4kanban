-- The agents page (#2106): each periodic agent's newest run on a project, a write the page makes
-- on the project's board, and Run now. The rules and schedules themselves are board files.

-- Per agent and workflow: the newest job, and when the last pass that passed began.
create function api.v1_agent_runs(p_account uuid, p_project text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_project);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'agent', x.name, 'workflow', nullif(x.workflow, ''), 'at', cloud.v1_ts(x.created_at),
      'status', case when x.state <> 'finished' and not x.lapsed then 'running' when x.outcome = 'done' then 'done' else 'failed' end,
      'last_success', (select cloud.v1_ts(a.last_success) from cloud.project_agents a
                        where a.project_id = p_project and a.agent = x.name and a.workflow = x.workflow)))
    from (select distinct on (j.agent ->> 'name', coalesce(j.agent ->> 'workflow', ''))
            j.agent ->> 'name' as name, coalesce(j.agent ->> 'workflow', '') as workflow, j.created_at, j.state, j.outcome,
            cloud.runner_job_interrupted(j) as lapsed
          from cloud.runner_jobs j
          where j.project_id = p_project and j.agent is not null
          order by j.agent ->> 'name', coalesce(j.agent ->> 'workflow', ''), j.created_at desc) x), '[]');
end;
$$;

-- A member's write to the project's board, counted like any other.
create function api.v1_project_write(p_account uuid, p_project text, p_daily_write_budget integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'project', p_project), p_daily_write_budget);
end;
$$;

-- Run now: a job for the agent on the project's Runner. False while one already waits or runs.
create function api.v1_run_agent(p_account uuid, p_project text, p_agent text, p_workflow text, p_daily_write_budget integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'project', p_project), p_daily_write_budget);
  if p_agent !~ '^[a-z0-9][a-z0-9-]{0,63}$' then perform cloud.v1_missing('agent'); end if;
  return (cloud.queue_agent_job(p_project, jsonb_strip_nulls(jsonb_build_object('name', p_agent, 'workflow', p_workflow)), null)).id is not null;
end;
$$;

revoke all on function api.v1_agent_runs(uuid, text) from public;
revoke all on function api.v1_project_write(uuid, text, integer) from public;
revoke all on function api.v1_run_agent(uuid, text, text, text, integer) from public;
grant execute on function api.v1_agent_runs(uuid, text) to service_role;
grant execute on function api.v1_project_write(uuid, text, integer) to service_role;
grant execute on function api.v1_run_agent(uuid, text, text, text, integer) to service_role;
