-- The rail lists only chats the user wrote in (#113): a new task's chat starts off it, the user's own
-- message puts it on (0113), and clearing takes it off again.

alter table cloud.task_chats alter column in_rail set default false;

-- A task's request is written into its chat in the same transaction as the task, so it shares the
-- task's `created_at`; any later user message is the user's own.
update cloud.task_chats h set in_rail = exists (
  select 1 from cloud.task_chat_messages m join cloud.tasks t on t.id = m.task_id
   where m.task_id = h.task_id and m.account_id = h.account_id and m.role = 'user' and m.created_at <> t.created_at);

-- 0119's, the chat off the rail.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer
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
          cloud.v1_with_creator(p_account, coalesce(p_fields -> 'source_context', '{}')), coalesce(p_fields -> 'context', '{}'),
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

-- 0059's, off the rail.
create or replace function cloud.v1_chat_clear(p_account uuid, p_task text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
begin
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account for update;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  delete from cloud.task_chat_messages where task_id = p_task and account_id = p_account;
  update cloud.task_chats set job_id = null, session = null, session_runtime = null, context = null, failure = null,
    in_rail = false, updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;
