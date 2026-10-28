-- Runtimes (#2074): each account's list of what its tasks run on — a connector the Runner has
-- (Claude Code or Codex) and an optional model. A task names one, or runs on Global default.
--
-- - **Global default is made on first use**: by the pick tasks had before, Claude Code when the
--   Runner has it installed and signed in, else Codex. It is never renamed or deleted.
-- - **A task keeps the runtime it was started on**: every step's job carries its connector and
--   model; a deleted runtime falls back to Global default.
-- - **A test is a job**: the Runner sends one short prompt on the runtime and reports the result
--   and how long it took. It makes no task and no card.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.runtimes (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  connector text not null check (connector in ('claude-code', 'codex')),
  model text check (model is null or length(model) between 1 and 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index runtimes_one_default on cloud.runtimes (account_id) where is_default;
create unique index runtimes_name on cloud.runtimes (account_id, lower(name));
alter table cloud.runtimes enable row level security;

alter table cloud.tasks add column runtime text references cloud.runtimes (id) on delete set null;

alter table cloud.runner_jobs
  add column model text,
  -- A connection test (#2074): the prompt is sent as it is, and nothing else happens.
  add column test boolean not null default false,
  add column elapsed_ms integer;

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'model', p_job.model,
    'test', p_job.test,
    'project', p_job.project_id,
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
    'stage', p_job.stage,
    'flow', p_job.flow,
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

create function cloud.v1_runtime_json(r cloud.runtimes) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'object', 'runtime', 'name', r.name, 'connector', r.connector, 'model', r.model,
    'default', r.is_default, 'created_at', cloud.v1_ts(r.created_at), 'updated_at', cloud.v1_ts(r.updated_at));
$$;

create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'card_version', nullif(t.card_version, 0), 'runtime', t.runtime,
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'last_job', (select j.id from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null order by j.seq desc limit 1),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------

-- The account's Global default, made by the old pick the first time it is asked for.
create function cloud.v1_default_runtime(p_account uuid) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  if found then return r; end if;
  insert into cloud.runtimes (id, account_id, name, connector, is_default)
  values (cloud.v1_id('rt'), p_account, 'Global default', coalesce((
    select e ->> 'name' from cloud.runners x, jsonb_array_elements(x.runtimes) e
    where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex')
      and coalesce((e ->> 'installed')::boolean, false) and coalesce((e ->> 'loggedIn')::boolean, true)
    order by e ->> 'name' = 'claude-code' desc limit 1), 'claude-code'), true)
  on conflict (account_id) where is_default do nothing;
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  return r;
end;
$$;

-- What a task runs on: its own runtime, or its creator's Global default.
create function cloud.v1_task_runtime(t cloud.tasks) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where id = t.runtime and account_id = t.account_id;
  if found then return r; end if;
  return cloud.v1_default_runtime(t.account_id);
end;
$$;

-- The connector of Global default, for a chat that names none.
create or replace function cloud.v1_flow_runtime(p_account uuid) returns text
language sql volatile security definer set search_path = '' as $$
  select (cloud.v1_default_runtime(p_account)).connector;
$$;

create function cloud.v1_own_runtime(p_account uuid, p_id text) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('runtime'); end if;
  return r;
end;
$$;

create function cloud.v1_runtime_name_free(p_account uuid, p_name text, p_except text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from cloud.runtimes where account_id = p_account and lower(name) = lower(p_name)
             and id is distinct from p_except) then
    raise exception 'A runtime already has this name.' using errcode = 'AKB28';
  end if;
end;
$$;

-- Each connector as the Runner last reported it: `ready`, `not_installed` or `signed_out`.
create function cloud.v1_connectors(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name',
    case when not coalesce((e ->> 'installed')::boolean, false) then 'not_installed'
         when (e ->> 'loggedIn')::boolean is false then 'signed_out' else 'ready' end), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex');
$$;

create function api.v1_list_runtimes(p_account uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_default_runtime(p_account);
  return jsonb_build_object(
    'data', (select jsonb_agg(cloud.v1_runtime_json(r) order by r.is_default desc, r.created_at, r.id)
             from cloud.runtimes r where r.account_id = p_account),
    'next', null,
    'connectors', cloud.v1_connectors(p_account),
    'runner_connected', exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()));
end;
$$;

create function api.v1_create_runtime(p_account uuid, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_default_runtime(p_account);
  perform cloud.v1_runtime_name_free(p_account, p_fields ->> 'name');
  insert into cloud.runtimes (id, account_id, name, connector, model)
  values (cloud.v1_id('rt'), p_account, p_fields ->> 'name', p_fields ->> 'connector', p_fields ->> 'model')
  returning * into r;
  return cloud.v1_runtime_json(r);
end;
$$;

-- `model: null` clears it; a field left out is kept.
create function api.v1_update_runtime(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into r from cloud.runtimes where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('runtime'); end if;
  if p_fields ? 'name' then
    if r.is_default then perform cloud.v1_refuse('Global default cannot be renamed.'); end if;
    perform cloud.v1_runtime_name_free(p_account, p_fields ->> 'name', p_id);
  end if;
  update cloud.runtimes set
    name = coalesce(p_fields ->> 'name', name),
    connector = coalesce(p_fields ->> 'connector', connector),
    model = case when p_fields ? 'model' then p_fields ->> 'model' else model end,
    updated_at = now()
  where id = p_id
  returning * into r;
  return cloud.v1_runtime_json(r);
end;
$$;

create function api.v1_delete_runtime(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes := cloud.v1_own_runtime(p_account, p_id);
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if r.is_default then perform cloud.v1_refuse('Global default cannot be deleted.'); end if;
  delete from cloud.runtimes where id = p_id;
  return jsonb_build_object('id', p_id, 'object', 'runtime', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Testing one
-- ---------------------------------------------------------------------------

-- A test job for the caller's Runner; refused while it is not connected.
create function api.v1_test_runtime(p_account uuid, p_id text, p_prompt text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes := cloud.v1_own_runtime(p_account, p_id);
  j cloud.runner_jobs;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if not exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()) then
    raise exception 'Your Runner is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  insert into cloud.runner_jobs (owner_id, runtime, model, test, prompt)
  values (p_account, r.connector, r.model, true, p_prompt)
  returning * into j;
  perform cloud.hint_runner(p_account, j.id);
  return jsonb_build_object('job', j.id, 'connector', r.connector, 'model', r.model);
end;
$$;

-- How a test ended, or null while it runs. One still not done after `p_limit_seconds` is stopped
-- and reads as timed out.
create function api.v1_runtime_test(p_account uuid, p_job uuid, p_limit_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
begin
  select * into j from cloud.runner_jobs where id = p_job and owner_id = p_account and test for update;
  if not found then perform cloud.v1_missing('test'); end if;
  if j.state <> 'finished' and j.created_at < now() - make_interval(secs => p_limit_seconds) then
    update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'timeout', finished_at = now(),
      updated_at = now()
    where id = p_job returning * into j;
  end if;
  if j.state <> 'finished' then return null; end if;
  return jsonb_build_object('outcome', j.outcome, 'reason', j.reason, 'elapsed_ms', j.elapsed_ms);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks and their jobs
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_dispatch_flow(p_task text, p_verb text, p_text text default null) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  f cloud.project_folders;
  r cloud.runtimes;
begin
  select * into t from cloud.tasks where id = p_task for update;
  r := cloud.v1_task_runtime(t);
  select x.* into f from cloud.project_folders x
    left join cloud.runners rr on rr.owner_id = t.account_id and rr.machine_id = x.machine_id and rr.live_until > now()
   where x.project_id = t.project_id and x.account_id = t.account_id
   order by rr.owner_id is not null desc, x.updated_at desc limit 1;
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (t.account_id, r.connector, r.model, t.project_id, f.path, f.machine_id, t.id,
          format('akb %s: %s', p_verb, t.title),
          jsonb_strip_nulls(jsonb_build_object('verb', p_verb, 'workflow', t.workflow ->> 'id', 'card', t.run_card,
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end)))
  returning * into j;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', failure = null, result = null, updated_at = now() where id = p_task;
  return j;
end;
$$;

-- 0063's create, taking `runtime`: one of the caller's own.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_max_tasks is not null
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
  return cloud.v1_task_json(t);
end;
$$;

-- 0060's finish: a retry keeps the model, and a test keeps how long it took.
create or replace function api.finish_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_outcome text,
  p_reason text,
  p_daily_write_budget integer,
  p_report jsonb default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  v_outcome text := p_outcome;
  v_reason text := nullif(p_reason, '');
  v_retry cloud.runner_jobs;
  v_reply text := nullif(btrim(left(coalesce(p_report ->> 'reply', ''), 60000)), '');
  h cloud.task_chats;
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
  perform cloud.count_write(p_daily_write_budget);
  if v_outcome = 'conflict' and (v_job.task_id is null or v_job.attempt >= 2) then
    v_outcome := 'failed';
    v_reason := 'The card was updated elsewhere.';
  end if;
  update cloud.runner_jobs
     set state = 'finished',
         outcome = v_outcome,
         reason = v_reason,
         reply = v_reply,
         usage = case when jsonb_typeof(p_report -> 'usage') = 'object' then p_report -> 'usage' end,
         cost_usd = case when jsonb_typeof(p_report -> 'costUsd') = 'number' then (p_report ->> 'costUsd')::numeric end,
         elapsed_ms = case when jsonb_typeof(p_report -> 'ms') = 'number' then (p_report ->> 'ms')::integer end,
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, stage, flow,
                                   attempt, resume, prompt, attachments)
    values (v_job.owner_id, v_job.runtime, v_job.model, v_job.project_id, v_job.project_dir, v_job.machine_id,
            v_job.task_id, v_job.stage, v_job.flow, 2, v_job.resume, v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_job.task_id is not null and cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_outcome = 'done' and v_job.stage = 'plan' then perform cloud.v1_submit_draft(v_job.task_id); end if;
    if v_job.flow is not null then perform cloud.v1_finish_flow(v_job, p_report); end if;
  end if;

  for h in select * from cloud.task_chats where job_id = p_job loop
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
      values (cloud.v1_id('msg'), h.task_id, h.account_id, 'agent', v_reply);
    end if;
    update cloud.task_chats set
      job_id = v_retry.id,
      session = case when v_job.flow is null then coalesce(p_report ->> 'session', session) else session end,
      session_runtime = case when v_job.flow is null and p_report ->> 'session' is not null then v_job.runtime
                             else session_runtime end,
      context = case when v_job.flow is null then coalesce(p_report -> 'context', context) else context end,
      failure = case v_outcome when 'failed' then
        case when v_reason = 'The card was updated elsewhere.' then 'conflict' else 'failed' end end,
      updated_at = now()
    where task_id = h.task_id and account_id = h.account_id;
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
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
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) to service_role;
