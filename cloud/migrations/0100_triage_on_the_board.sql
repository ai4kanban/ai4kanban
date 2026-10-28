-- Triage items move onto the workspace's board (#2107): each project's `triage/` files, synced
-- with the rest of the board, are the record. Postgres keeps who may write and the events.
--
-- - **Parked**: the items become `cloud.triage_moves` until scripts/triage-move.mjs has the
--   Worker write them as files; a later migration drops the table.
-- - **No triage in the rows**: a task made of an item, the rejection review's dismissals and
--   the waiting reviews read the board instead.

drop function api.v1_list_triage(uuid, text, text, text[], boolean, text, integer);
drop function api.v1_create_triage(uuid, jsonb, integer);
drop function api.v1_dismiss_triage(uuid, text, text, integer);
drop function api.v1_restore_triage(uuid, text, integer);
drop function api.v1_triage_unjudged(integer);
drop function api.v1_triage_to_sort(text);
drop function api.v1_sort_triage(text, timestamptz, text, text, jsonb, jsonb, integer, integer);
drop function api.v1_rejections_reviewed(uuid, text[], text[], integer);
drop function cloud.v1_triage_item(uuid, text);
drop function cloud.v1_triage_json(cloud.triage_items);

alter table cloud.triage_items rename to triage_moves;

-- 0093's, with no triage: the Worker checks and moves the item (#2107).
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
                           source_context, context, run, runtime, skip_plan)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime',
          coalesce((p_fields ->> 'skip_plan')::boolean, false))
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
    insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
    values (cloud.v1_id('msg'), t.id, p_account, 'user', coalesce(nullif(btrim(t.request), ''), t.title));
    perform cloud.v1_chat_changed(t.id, p_account);
    select * into t from cloud.tasks where id = t.id;
  end if;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;


-- 0092's, its dismissals read off the board by the Worker.
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
  );
end;
$$;


-- What the review has not learned of the workspace's tasks; its dismissals are on the board.
create or replace function api.v1_list_rejections(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
begin
  return jsonb_build_object('object', 'rejections', 'workspace', v_ws,
    'tasks', coalesce((select jsonb_agg(x.j order by x.at, x.id) from (
      select t.id, t.updated_at at, jsonb_build_object('id', t.id,
        'key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
        'number', t.number, 'project', t.project_id, 'title', t.title, 'request', t.request, 'reason', t.cancel_reason,
        'cancelled_by', (select a.handle from cloud.accounts a where a.id = t.cancelled_by),
        'cancelled_at', cloud.v1_ts(t.updated_at)) j
      from cloud.tasks t where t.workspace_id = v_ws and t.cancel_reviewed = false
      order by t.updated_at, t.id limit 100) x), '[]'));
end;
$$;

-- Learned: these leave the list until rejected again. How many.
create function api.v1_rejections_reviewed(p_account uuid, p_tasks text[], p_daily_write_budget integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_ws text;
  v_tasks integer;
begin
  perform cloud.count_write(p_daily_write_budget);
  for v_ws in
    select distinct t.workspace_id from cloud.tasks t
     where t.id = any(coalesce(p_tasks, '{}')) and cloud.v1_in(p_account, t.workspace_id) order by 1
  loop
    perform cloud.v1_lock(v_ws);
  end loop;
  update cloud.tasks t set cancel_reviewed = true
   where t.id = any(coalesce(p_tasks, '{}')) and t.cancel_reviewed = false and cloud.v1_in(p_account, t.workspace_id);
  get diagnostics v_tasks = row_count;
  return v_tasks;
end;
$$;

-- Which workspace a triage list reads: the project's, the one named, or the caller's own.
create function api.v1_triage_scope(p_account uuid, p_workspace text, p_project text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('workspace', cloud.v1_target(p_account, p_workspace, p_project));
$$;

-- A triage write, counted: the workspace, and the project an item goes to — the general one
-- when none is named. A new item's workflow must be the workspace's, its task one it can see.
create function api.v1_triage_write(p_account uuid, p_workspace text, p_project text, p_source_task text, p_workflow text,
                                    p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, p_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_workflow is not null and not (cloud.v1_installed(v_ws, p_workflow)
     or exists (select 1 from cloud.workflows w where w.id = p_workflow and w.workspace_id = v_ws)) then
    raise exception 'That is not a workflow of this workspace.' using errcode = 'AKB28';
  end if;
  if p_source_task is not null then perform cloud.v1_workspace_of(p_account, 'task', p_source_task); end if;
  return jsonb_build_object('workspace', v_ws, 'project', coalesce(p_project, cloud.v1_general(v_ws)));
end;
$$;

-- An item's change, told to the workspace.
create function api.v1_triage_emit(p_workspace text, p_type text, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_type not in ('triage.created', 'triage.updated') then perform cloud.v1_refuse('That is not a triage event.'); end if;
  perform cloud.v1_emit(p_workspace, p_type, p_data);
end;
$$;

-- Whom the sort judges a workspace's items for, and the workflows they may become.
create function api.v1_sort_context(p_workspace text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('owner', w.account_id,
    'installed', coalesce((select jsonb_agg(x.workflow_id order by x.workflow_id) from cloud.workflow_installs x
                            where x.workspace_id = w.id), '[]'),
    'workflows', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'description', f.description) order by f.id)
                            from cloud.workflows f where f.workspace_id = w.id), '[]'))
  from cloud.v1_workspaces w where w.id = p_workspace;
$$;

-- Where the hourly sort looks: workspaces a job finished in during the last day, latest first.
create function api.v1_sort_workspaces(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.ws order by x.at desc), '[]') from (
    select p.workspace_id ws, max(j.finished_at) at from cloud.runner_jobs j join cloud.projects p on p.id = j.project_id
     where j.state = 'finished' and j.finished_at > now() - interval '1 day'
     group by p.workspace_id order by 2 desc limit p_limit
  ) x;
$$;

-- The workspaces an account's plan keeps.
create function api.v1_account_workspaces(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(w.id order by w.id), '[]') from cloud.v1_workspaces w where w.account_id = p_account;
$$;

-- The tasks behind cards named by project and number.
create function api.v1_card_tasks(p_cards jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('project', t.project_id, 'number', t.number, 'task', t.id)), '[]')
  from jsonb_array_elements(coalesce(p_cards, '[]')) e
  join cloud.tasks t on t.project_id = e ->> 'project' and t.number = (e ->> 'number')::integer;
$$;

-- The parked items of one workspace, for the move.
create function api.v1_triage_move(p_workspace text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'project', i.project_id, 'title', i.title, 'body', i.body,
      'source_task', i.source_task, 'workflow', i.workflow, 'state', i.state, 'dismissed_reason', i.dismissed_reason,
      'dismissed_by', i.dismissed_by, 'dismissed_at', i.dismissed_at, 'task', i.task_id,
      'task_number', (select t.number from cloud.tasks t where t.id = i.task_id), 'reviewed', i.reviewed,
      'judged_at', i.judged_at, 'created_at', i.created_at, 'updated_at', i.updated_at) order by i.id), '[]')
  from cloud.triage_moves i where i.workspace_id = p_workspace;
$$;

-- Moved: their rows go.
create function api.v1_triage_moved(p_workspace text, p_ids text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from cloud.triage_moves where workspace_id = p_workspace and id = any(coalesce(p_ids, '{}'));
  get diagnostics n = row_count;
  return n;
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  foreach f in array array[
    'api.v1_rejections_reviewed(uuid, text[], integer)'::regprocedure,
    'api.v1_triage_scope(uuid, text, text)'::regprocedure,
    'api.v1_triage_write(uuid, text, text, text, text, integer)'::regprocedure,
    'api.v1_triage_emit(text, text, jsonb)'::regprocedure,
    'api.v1_sort_context(text)'::regprocedure,
    'api.v1_sort_workspaces(integer)'::regprocedure,
    'api.v1_account_workspaces(uuid)'::regprocedure,
    'api.v1_card_tasks(jsonb)'::regprocedure,
    'api.v1_triage_move(text)'::regprocedure,
    'api.v1_triage_moved(text, text[])'::regprocedure
  ]
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$grants$;
