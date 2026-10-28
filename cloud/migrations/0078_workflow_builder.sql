-- Workflow builder (#2004): a built-in whose task writes a workflow, or changes one of the
-- workspace's own, and saves it once the plan is approved.
--
-- - **What it changes**: `tasks.context.workflow` names the own workflow a builder task changes;
--   after the save it names the one saved, and `created` says it is new.
-- - **What gets saved**: the Runner sends the workflow's files with every job of the task, checked
--   (`tasks.built`); a change to them asks for a new review, as a card change does.
-- - **Saved on approval**: in the approving transaction, with its `workflow.created` or
--   `workflow.updated` event. A task already running keeps its own version.

insert into cloud.workflow_listings (workflow_id) values ('wf_builtin_workflow_builder');
insert into cloud.workflow_installs (workspace_id, workflow_id)
select w.id, 'wf_builtin_workflow_builder' from cloud.v1_workspaces w on conflict do nothing;

alter table cloud.tasks
  add column context jsonb not null default '{}',
  -- `{ name, description, delivers, files }`: what the approval saves.
  add column built jsonb;

-- 0076's, with `context`.
create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'context', t.context,
    'status', t.status, 'card_version', nullif(t.card_version, 0), 'runtime', t.runtime,
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'last_job', (select j.id from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null order by j.seq desc limit 1),
    'discussion', t.discussion_id,
    'cancel_reason', t.cancel_reason,
    'cancelled_by', (select a.handle from cloud.accounts a where a.id = t.cancelled_by),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

-- 0077's create, taking `context`.
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
                           source_context, context, run, runtime)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime')
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

-- The checked files a builder task's job left. Anything open for review asks again.
create function api.runner_built_workflow(p_subject uuid, p_machine uuid, p_job uuid, p_built jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  t cloud.tasks;
  v_cp text;
begin
  if v_job.id is null or v_job.task_id is null then return false; end if;
  perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id));
  select * into t from cloud.tasks where id = v_job.task_id for update;
  if t.workflow ->> 'id' is distinct from 'wf_builtin_workflow_builder' or t.status in ('done', 'failed', 'cancelled') then
    return false;
  end if;
  if t.built is not distinct from p_built then return true; end if;
  update cloud.tasks set built = p_built, updated_at = now() where id = t.id;
  for v_cp in
    select c.id from cloud.task_checkpoints c where c.task_id = t.id and c.status not in ('pending', 'approved') order by c.position
  loop
    perform cloud.v1_revise(v_cp);
  end loop;
  return true;
end;
$$;

-- The approved workflow: the one the task changes, or a new one of the workspace's.
create function cloud.v1_save_built(t cloud.tasks) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
  b jsonb := t.built;
  v_target text := t.context ->> 'workflow';
begin
  if b is null then perform cloud.v1_refuse('The workflow has not been written yet.'); end if;
  if v_target is not null then
    update cloud.workflows set name = b ->> 'name', description = coalesce(b ->> 'description', ''),
      version = version + 1, updated_at = now()
    where id = v_target and workspace_id = t.workspace_id returning * into w;
    if w.id is null then perform cloud.v1_refuse('The workflow this task changes was deleted.'); end if;
  else
    insert into cloud.workflows (id, account_id, workspace_id, name, description)
    values (cloud.v1_id('wf'), t.account_id, t.workspace_id, b ->> 'name', coalesce(b ->> 'description', ''))
    returning * into w;
  end if;
  perform cloud.v1_add_workflow_version(w, b);
  update cloud.tasks set context = context || jsonb_build_object('workflow', w.id)
    || case when v_target is null then '{"created": true}'::jsonb else '{}' end where id = t.id;
  perform cloud.v1_emit(t.workspace_id, case when v_target is null then 'workflow.created' else 'workflow.updated' end,
    cloud.v1_workflow_json(w));
end;
$$;

-- 0066's, saving a builder task's workflow as it ends.
create or replace function cloud.v1_after_approval(c cloud.task_checkpoints) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_phases jsonb;
  v_more boolean;
  v_status text;
begin
  select * into t from cloud.tasks where id = c.task_id for update;
  if t.workflow_version is null then return; end if;
  v_phases := cloud.v1_card_phases(t.card_metadata);
  v_more := v_phases is not null and jsonb_array_length(v_phases) > c.position;
  if v_more then
    update cloud.tasks set card_metadata = card_metadata || jsonb_build_object('phase', c.position + 1)
    where id = c.task_id returning * into t;
    v_status := 'queued';
  elsif exists (select 1 from cloud.task_checkpoints e where e.task_id = c.task_id and e.status <> 'approved') then
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
  end if;
  if t.run and v_status = 'queued' then
    perform cloud.v1_dispatch_flow(c.task_id, case when v_more then 'approve' else 'implement' end);
    select * into t from cloud.tasks where id = c.task_id;
  else
    if v_status = 'done' and t.workflow ->> 'id' = 'wf_builtin_workflow_builder' then perform cloud.v1_save_built(t); end if;
    update cloud.tasks set status = v_status, updated_at = now(),
      result = case when t.run and v_status = 'done' then (
        select j.reply from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null and j.state = 'finished'
        order by j.seq desc limit 1) else result end
    where id = c.task_id returning * into t;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

revoke all on function cloud.v1_save_built(cloud.tasks) from public;
revoke all on function api.runner_built_workflow(uuid, uuid, uuid, jsonb) from public;
grant execute on function api.runner_built_workflow(uuid, uuid, uuid, jsonb) to service_role;
