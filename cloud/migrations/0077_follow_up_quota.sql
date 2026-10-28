-- A task that does not run takes no place in the task quota (#2063): a follow-up an agent notes
-- down is made even when the quota is full, and counts once it runs.

create or replace function cloud.v1_open_tasks(p_account uuid) returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
  where w.account_id = p_account and t.status in ('queued', 'running', 'waiting_review')
    and (t.run or t.status <> 'queued');
$$;

-- 0076's create; the quota is checked only for a task that runs.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  i cloud.triage_items;
  v_project text := p_fields ->> 'project';
  v_ws text;
begin
  if p_fields ? 'triage' then
    i := cloud.v1_triage_item(p_account, p_fields ->> 'triage');
    v_project := coalesce(v_project, i.project_id);
  end if;
  v_ws := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if i.id is not null then
    select * into i from cloud.triage_items where id = i.id for update;
    if i.workspace_id <> v_ws then perform cloud.v1_missing('triage item'); end if;
    if i.state <> 'open' then perform cloud.v1_refuse('This triage item is not waiting to be sorted.'); end if;
  end if;
  if p_max_tasks is not null and coalesce((p_fields ->> 'run')::boolean, false)
     and cloud.v1_open_tasks((select w.account_id from cloud.v1_workspaces w where w.id = v_ws)) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
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
                           source_context, run, runtime)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce((p_fields ->> 'run')::boolean, false),
          p_fields ->> 'runtime')
  returning * into t;
  if t.run then
    j := cloud.v1_dispatch_flow(t.id, 'create', t.request);
    insert into cloud.task_chats (task_id, account_id, job_id) values (t.id, p_account, j.id);
    insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
    values (cloud.v1_id('msg'), t.id, p_account, 'user', coalesce(nullif(btrim(t.request), ''), t.title));
    perform cloud.v1_chat_changed(t.id, p_account);
    select * into t from cloud.tasks where id = t.id;
  end if;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  if i.id is not null then
    update cloud.triage_items set state = 'carded', task_id = t.id, updated_at = now() where id = i.id returning * into i;
    perform cloud.v1_emit(v_ws, 'triage.updated', cloud.v1_triage_json(i));
  end if;
  return cloud.v1_task_json(t);
end;
$$;
