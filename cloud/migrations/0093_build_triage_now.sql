-- Start a triage item without planning (#2139).
--
-- - **An item names its workflow**: `v1_create_triage` refuses one with no workflow, or one this
--   workspace has not got; the sort uses it instead of picking one.
-- - **`skip_plan`**: a task made with it builds straight after its card is written. Kept on the
--   task, so a create held behind a blocker keeps it when it is dispatched again.

alter table cloud.triage_items add column workflow text;
alter table cloud.tasks add column skip_plan boolean not null default false;

create or replace function cloud.v1_triage_json(i cloud.triage_items) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'object', 'triage', 'workspace', i.workspace_id, 'project', i.project_id,
    'title', i.title, 'text', i.body, 'source_task', i.source_task, 'workflow', i.workflow, 'state', i.state,
    'dismissed_reason', i.dismissed_reason,
    'dismissed_by', (select a.handle from cloud.accounts a where a.id = i.dismissed_by),
    'dismissed_at', cloud.v1_ts(i.dismissed_at),
    'task', i.task_id,
    'created_by', (select a.handle from cloud.accounts a where a.id = i.created_by),
    'created_at', cloud.v1_ts(i.created_at), 'updated_at', cloud.v1_ts(i.updated_at));
$$;

-- 0083's, with the item's workflow.
create or replace function api.v1_triage_to_sort(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'workspace', i.workspace_id, 'project', i.project_id, 'owner', w.account_id,
    'title', i.title, 'text', i.body, 'source_task', i.source_task, 'workflow', i.workflow, 'seen', i.updated_at,
    'installed', coalesce((select jsonb_agg(x.workflow_id order by x.workflow_id) from cloud.workflow_installs x
                            where x.workspace_id = i.workspace_id), '[]'),
    'workflows', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'description', f.description) order by f.id)
                            from cloud.workflows f where f.workspace_id = i.workspace_id), '[]'))
  from cloud.triage_items i join cloud.v1_workspaces w on w.id = i.workspace_id
  where i.id = p_id and i.state = 'open' and i.judged_at is null;
$$;

-- 0092's, with the item's workflow.
create or replace function api.v1_create_triage(p_account uuid, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  v_source text := p_fields ->> 'source_task';
  v_workflow text := p_fields ->> 'workflow';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if v_workflow is null or not (cloud.v1_installed(v_ws, v_workflow)
     or exists (select 1 from cloud.workflows w where w.id = v_workflow and w.workspace_id = v_ws)) then
    raise exception 'That is not a workflow of this workspace.' using errcode = 'AKB28';
  end if;
  if v_source is not null then perform cloud.v1_workspace_of(p_account, 'task', v_source); end if;
  v_project := coalesce(v_project, cloud.v1_general(v_ws));
  insert into cloud.triage_items (id, workspace_id, project_id, created_by, title, body, source_task, workflow)
  values (cloud.v1_id('tri'), v_ws, v_project, p_account, p_fields ->> 'title', coalesce(p_fields ->> 'text', ''), v_source, v_workflow)
  on conflict (project_id, (coalesce(source_task, '')), title) do nothing
  returning * into i;
  if i.id is null then
    select * into i from cloud.triage_items x
     where x.project_id = v_project and coalesce(x.source_task, '') = coalesce(v_source, '') and x.title = p_fields ->> 'title';
    return cloud.v1_triage_json(i);
  end if;
  perform cloud.v1_emit(v_ws, 'triage.created', cloud.v1_triage_json(i));
  return cloud.v1_triage_json(i) || '{"created": true}';
end;
$$;

-- 0092's, taking skip_plan.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  i cloud.triage_items;
  m jsonb := p_fields -> 'metadata';
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
  if i.id is not null then
    update cloud.triage_items set state = 'carded', task_id = t.id, updated_at = now() where id = i.id returning * into i;
    perform cloud.v1_emit(v_ws, 'triage.updated', cloud.v1_triage_json(i));
  end if;
  return cloud.v1_task_json(t);
end;
$$;

-- 0092's, carrying skip_plan on a create.
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
            'skip_plan', case when p_verb = 'create' and t.skip_plan then true end,
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
-- 0090's, ending an unplanned create as a build.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if t.status in ('done', 'failed', 'cancelled') or j.outcome = 'conflict' then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'stopped' then
    update cloud.tasks set status = 'stopped', updated_at = now() where id = t.id returning * into t;
  elsif j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif (j.flow ->> 'verb' = 'implement' or (j.flow ->> 'verb' = 'create' and (j.flow ->> 'skip_plan')::boolean))
        and jsonb_typeof(r) is distinct from 'object' then
    update cloud.tasks set status = 'done', result = j.reply, updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = j.owner_id and x.machine_id = j.claimed_machine), '')) end,
      landed_owner = case when jsonb_typeof(l) = 'object' then j.owner_id end,
      landed_machine = case when jsonb_typeof(l) = 'object' then j.claimed_machine end
     where id = t.id returning * into t;
  else
    perform cloud.v1_submit_draft(t.id, case
      when jsonb_typeof(r) = 'object' then jsonb_build_object('question', r ->> 'question',
        'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'approve', false) order by o.n)
                    from jsonb_array_elements_text(r -> 'options') with ordinality o(label, n)),
        'card_question', (r ->> 'position')::integer)
      when concat(t.request, t.title) ~ '[一-鿿]' then
        '{"question": "批准这份方案？", "options": [{"label": "确认", "approve": true}, {"label": "需要修改", "approve": false}]}'
      else '{"question": "Approve this plan?", "options": [{"label": "Approve", "approve": true},
             {"label": "Request changes", "approve": false}]}' end);
    return;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname like 'v1\_%') or (n.nspname = 'cloud' and p.proname like 'v1\_%')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
