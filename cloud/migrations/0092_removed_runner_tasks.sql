-- Tasks on a Runner removed from their workspace (#2143).
--
-- - **Asked by hand, refused**: creating a run task, resuming one, and a task or discussion chat
--   whose new job goes to a computer removed from that workspace are `runner_removed`, keeping
--   nothing. A step dispatched by a trigger queues as before.
-- - **A queued step says so**: `run.runner_removed`.
-- - **Placed again, it starts**: a task job dispatched while removed has no folder; it reads the
--   computer's folder once one is placed there again.

create function cloud.v1_refuse_removed(p_job uuid, p_workspace text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from cloud.runner_jobs j join cloud.removed_runners x on x.machine_id = j.machine_id
             where j.id = p_job and x.workspace_id = p_workspace) then
    raise exception 'This runtime''s Runner was removed from this workspace.' using errcode = 'AKB26', detail = 'runner_removed';
  end if;
end;
$$;

-- Removing or placing again moves the workspace's queued steps on that computer in and out of `runner_removed`.
create function cloud.runner_removal_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  x cloud.removed_runners := coalesce(new, old);
  t cloud.tasks;
begin
  if not exists (select 1 from cloud.v1_workspaces w where w.id = x.workspace_id) then return null; end if;
  for t in select k.* from cloud.tasks k
    where k.workspace_id = x.workspace_id
      and exists (select 1 from cloud.runner_jobs j where j.task_id = k.id and j.flow is not null
                    and j.state = 'waiting' and j.machine_id = x.machine_id)
  loop
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  end loop;
  return null;
end;
$$;
revoke all on function cloud.runner_removal_changed() from public;

create trigger runner_removal_changed after insert or delete on cloud.removed_runners
for each row execute function cloud.runner_removal_changed();

-- 0090's, with `runner_removed`.
create or replace function cloud.v1_run_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when j.id is not null then jsonb_build_object(
    'state', case j.state when 'claimed' then 'running' else 'queued' end,
    'runner_connected', exists (select 1 from cloud.runners r where r.owner_id = t.account_id and r.live_until > now()
                                  and r.machine_id = coalesce(j.claimed_machine, j.machine_id, r.machine_id)),
    'machine', (select r.machine_name from cloud.runners r
                 where r.owner_id = t.account_id and r.machine_id = coalesce(j.claimed_machine, j.machine_id)),
    'stopping', j.stop_requested,
    'runner_removed', j.state = 'waiting' and exists (select 1 from cloud.removed_runners x
      where x.workspace_id = t.workspace_id and x.machine_id = j.machine_id),
    'job', j.id) end
  from cloud.v1_flow_job(t.id) j;
$$;

-- 0088's, a task job falling back to its computer's folder too.
create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'runtimeId', p_job.runtime_id,
    'model', p_job.model,
    'settings', coalesce(p_job.settings, '{}'::jsonb),
    'test', p_job.test,
    'secret', p_job.secret is not null,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', coalesce(p_job.project_dir, case when p_job.agent is not null or p_job.task_id is not null then
      (select f.path from cloud.project_folders f
        where f.project_id = coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id))
          and f.machine_id = coalesce(p_job.claimed_machine, p_job.machine_id) limit 1) end),
    'task', p_job.task_id,
    'discussion', (select json_build_object('id', d.id, 'workspace', d.workspace_id,
        'ideas', coalesce((select json_agg(json_build_object('id', i.id, 'title', i.title, 'outcome', i.outcome,
            'acceptance', i.acceptance, 'workflow', i.workflow, 'task', i.task_id) order by i.seq)
          from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'::json))
      from cloud.discussions d where d.id = p_job.discussion_id),
    'chat', (select json_build_object('message', m.id, 'body', m.body)
      from cloud.task_chats h
      cross join lateral (select m.id, m.body from cloud.task_chat_messages m
                          where m.task_id = h.task_id and m.account_id = h.account_id and m.role = 'user'
                          order by m.seq desc limit 1) m
      where h.job_id = p_job.id limit 1),
    'review', p_job.review,
    'agent', p_job.agent,
    'stage', p_job.stage,
    'flow', p_job.flow,
    'number', (select t.number from cloud.tasks t where t.id = p_job.task_id),
    'workflow', (select v.workflow_id from cloud.tasks t join cloud.workflow_versions v on v.id = t.workflow_version
                 where t.id = p_job.task_id),
    'attempt', p_job.attempt,
    'resume', p_job.resume,
    'prompt', p_job.prompt,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;

-- 0091's, refusing a first step on a removed computer.
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

-- 0090's, refusing a removed computer.
create or replace function api.v1_resume_task(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  l cloud.runner_jobs;
  j cloud.runner_jobs;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  if cloud.v1_resume_json(t) is null then perform cloud.v1_refuse('This task cannot be resumed.'); end if;
  l := cloud.v1_last_flow(p_id);
  insert into cloud.runner_jobs (owner_id, runtime, model, runtime_id, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (l.owner_id, l.runtime, l.model, l.runtime_id, l.project_id, l.project_dir, l.claimed_machine, l.task_id, l.prompt,
          l.flow || jsonb_strip_nulls(jsonb_build_object('card', t.run_card, 'resume', true)))
  returning * into j;
  -- 0088's binding follows the runtime's Runner; the work is on this computer.
  update cloud.runner_jobs set machine_id = l.claimed_machine,
    project_dir = coalesce((select f.path from cloud.project_folders f
                             where f.project_id = l.project_id and f.machine_id = l.claimed_machine and f.account_id = l.owner_id), l.project_dir)
   where id = j.id;
  perform cloud.v1_refuse_removed(j.id, v_ws);
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', failure = null, result = null, updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- 0087's, refusing a removed computer.
create or replace function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
                                   p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  r cloud.runtimes;
  v_pick text;
  v_ready text;
  v_key text;
  v_job uuid;
begin
  select * into t from cloud.tasks where id = p_task for update;
  insert into cloud.task_chats (task_id, account_id) values (p_task, p_account) on conflict do nothing;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  v_pick := case when p_runtime is null then h.runtime when p_runtime = 'task' then null
                 else (cloud.v1_own_runtime(p_account, p_runtime)).id end;
  if v_pick is null then r := cloud.v1_task_runtime(t);
  else select * into r from cloud.runtimes where id = v_pick;
  end if;
  if not exists (select 1 from cloud.runners x where x.owner_id = t.account_id and x.live_until > now()) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_ready := cloud.v1_connectors(t.account_id) ->> r.connector;
  if v_ready in ('not_installed', 'signed_out') then
    raise exception '% is not ready on the computer running this task.', r.connector
      using errcode = 'AKB30', detail = r.connector, hint = v_ready;
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', coalesce(p_body, ''), cloud.v1_image_names(p_images));
  v_job := (api.dispatch_runner_job(t.account_id, r.connector, null, cloud.task_chat_prompt(p_task, p_account),
                                    cloud.v1_image_files(p_images), p_daily_write_budget, p_task) ->> 'id')::uuid;
  perform cloud.v1_refuse_removed(v_job, t.workspace_id);
  v_key := cloud.v1_session_key(r.connector, r.model);
  update cloud.runner_jobs set model = r.model,
    resume = case when h.session_runtime is not distinct from v_key then h.session end
  where id = v_job;
  update cloud.task_chats set runtime = v_pick, job_id = v_job, failure = null,
    session = case when session_runtime is distinct from v_key then null else session end,
    context = case when session_runtime is distinct from v_key then null else context end,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

-- 0087's, refusing a removed computer.
create or replace function cloud.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer,
                                         p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions;
  r cloud.runtimes;
  v_ready text;
  v_key text;
  v_job uuid;
begin
  select * into d from cloud.discussions where id = p_id for update;
  if (cloud.v1_discussion_job(d)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if p_runtime is not null then r := cloud.v1_own_runtime(p_account, p_runtime);
  else select * into r from cloud.runtimes where id = d.runtime and account_id = p_account;
  end if;
  if r.id is null then r := cloud.v1_default_runtime(p_account); end if;
  if not exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()) then
    raise exception 'Your Runner is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_ready := cloud.v1_connectors(p_account) ->> r.connector;
  if v_ready in ('not_installed', 'signed_out') then
    raise exception '% is not ready on your Runner''s computer.', r.connector
      using errcode = 'AKB30', detail = r.connector, hint = v_ready;
  end if;
  insert into cloud.discussion_messages (id, discussion_id, role, body, image_names)
  values (cloud.v1_id('msg'), p_id, 'user', coalesce(p_body, ''), cloud.v1_image_names(p_images));
  v_job := (api.dispatch_runner_job(p_account, r.connector, d.project_id, cloud.v1_discussion_prompt(p_id),
                                    cloud.v1_image_files(p_images), p_daily_write_budget) ->> 'id')::uuid;
  perform cloud.v1_refuse_removed(v_job, d.workspace_id);
  v_key := cloud.v1_session_key(r.connector, r.model);
  update cloud.runner_jobs set model = r.model, discussion_id = p_id,
    resume = case when d.session_runtime is not distinct from v_key then d.session end
  where id = v_job;
  update cloud.discussions set runtime = r.id, job_id = v_job, failure = null,
    session = case when session_runtime is distinct from v_key then null else session end,
    context = case when session_runtime is distinct from v_key then null else context end,
    updated_at = now()
  where id = p_id returning * into d;
  perform cloud.v1_discussion_changed(p_id);
  return cloud.v1_discussion_json(d);
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
