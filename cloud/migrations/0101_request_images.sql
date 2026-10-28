-- Pictures sent with a new idea (#2182), as a chat message's (#2133).
--
-- - **Discussion**: `images` in `POST /v1/discussions` go with its first message.
-- - **Task**: `images` in `POST /v1/tasks` are kept on the task and sent with its `create` step,
--   which puts them on the card.

alter table cloud.tasks add column images jsonb not null default '[]';

-- 0074's, its first message carrying the pictures.
create or replace function api.v1_create_discussion(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', p_fields ->> 'project');
  v_id text := cloud.v1_id('dsc');
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_default_runtime(p_account);
  insert into cloud.discussions (id, account_id, workspace_id, project_id, runtime)
  values (v_id, p_account, v_ws, p_fields ->> 'project',
          case when p_fields ? 'runtime' then (cloud.v1_own_runtime(p_account, p_fields ->> 'runtime')).id end);
  return cloud.v1_discussion_send(p_account, v_id, p_fields ->> 'body', null, p_daily_write_budget,
                                  coalesce(p_fields -> 'images', '[]'));
end;
$$;

-- 0100's, keeping the request's pictures.
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
                           source_context, context, run, runtime, skip_plan, images)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime',
          coalesce((p_fields ->> 'skip_plan')::boolean, false), coalesce(p_fields -> 'images', '[]'))
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

-- 0094's, a `create` step carrying the task's pictures.
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
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, prompt, flow,
                                 attachments)
  values (t.account_id, r.connector, r.model, t.project_id, f.path, f.machine_id, t.id,
          format('akb %s: %s', p_verb, t.title),
          jsonb_strip_nulls(jsonb_build_object('verb', p_verb, 'workflow', t.workflow ->> 'id', 'card', t.run_card,
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end,
            'skip_plan', case when p_verb = 'create' and t.skip_plan then true end,
            'metadata', case when p_verb = 'create' then nullif(t.card_metadata
              - array['phases', 'phase', 'schedule', 'parent', 'source'], '{}') end)),
          case when p_verb = 'create' then cloud.v1_image_files(t.images) else '[]' end)
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
  if t.discussion_id is not null and p_verb in ('create', 'refine', 'resolve', 'revise') then
    perform cloud.v1_carry_session(j.id, t.account_id);
    if p_verb in ('resolve', 'revise') then
      update cloud.task_chats h set job_id = j.id, failure = null, updated_at = now()
       where h.task_id = t.id and h.account_id = t.account_id and (cloud.task_chat_job(h)).id is null;
      if found then perform cloud.v1_chat_changed(t.id, t.account_id); end if;
    end if;
    select * into j from cloud.runner_jobs where id = j.id;
  end if;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', held_flow = null, failure = null, result = null, updated_at = now()
  where id = p_task;
  return j;
end;
$$;
