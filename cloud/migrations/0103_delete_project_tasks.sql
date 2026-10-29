-- Deleting a project deletes its tasks with it, in every workspace, and only an owner may (#2192).

-- 0058's read, with `counts`: what deleting it takes along, for the web's confirmation to list.
-- The Worker adds `triage`, which lives on the board.
create or replace function api.v1_project(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_id);
  select * into p from cloud.projects where id = p_id;
  return cloud.v1_project_json(p) || jsonb_build_object('counts', jsonb_build_object(
    'tasks', (select count(*) from cloud.tasks t where t.project_id = p_id),
    'others_tasks', (select count(*) from cloud.tasks t where t.project_id = p_id and t.account_id is distinct from p_account),
    'others', (select count(distinct t.account_id) from cloud.tasks t
                where t.project_id = p_id and t.account_id is distinct from p_account),
    'scheduled_agents', (select count(*) from cloud.project_agents a
                          where a.project_id = p_id and not cloud.agent_off(a.project_id, a.agent, a.workflow)),
    'folders', (select count(*) from cloud.project_folders f where f.project_id = p_id)));
end;
$$;

-- 0092's delete. `stop` lists the jobs still running, whose Runners the Worker tells now; a
-- Runner that misses it loses the job's lease on its next renewal.
create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_stop jsonb;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  select * into p from cloud.projects where id = p_id for update;
  if p.general then perform cloud.v1_refuse('This project cannot be deleted.'); end if;
  select coalesce(jsonb_agg(j.id), '[]') into v_stop
    from cloud.runner_jobs j join cloud.tasks x on x.id = j.task_id
   where x.project_id = p_id and j.state = 'claimed';
  for t in select * from cloud.tasks where project_id = p_id order by number for update loop
    perform cloud.v1_emit(v_ws, 'task.deleted', cloud.v1_task_json(t));
    delete from cloud.tasks where id = t.id;
  end loop;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true, 'stop', v_stop);
end;
$$;
