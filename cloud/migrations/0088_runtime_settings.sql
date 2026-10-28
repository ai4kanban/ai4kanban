-- Full runtime settings (#2135): all eight connectors, each runtime bound to one Runner, and the
-- connector's own settings beside the model.
--
-- - **A runtime names its Runner**: `runner` is the machine id. Its jobs go to that computer only
--   and wait while it is offline. A runtime whose Runner is no longer the account's is unusable
--   until it is pointed at another; one bound to none takes the first Runner that registers.
-- - **Settings are the connector's own keys**: provider, endpoint, effort, extra arguments — what
--   the Runner's harness declares. Never a key: those live on the Runner's computer.
-- - **A key goes over in one job**: it sits on that job until its Runner takes it or it times out,
--   then only whether it was set or cleared is kept. The Runner reports which keys it holds.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.runtimes drop constraint runtimes_connector_check;
alter table cloud.runtimes
  add constraint runtimes_connector_check
    check (connector in ('claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok')),
  add column runner uuid,
  add column settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object');

-- Existing runtimes go to the account's Runner; an account that never had one binds later.
update cloud.runtimes r set runner = x.machine_id from cloud.runners x where x.owner_id = r.account_id;

alter table cloud.runner_jobs drop constraint runner_jobs_runtime_check;
alter table cloud.runner_jobs
  add constraint runner_jobs_runtime_check
    check (runtime in ('claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok')),
  add column runtime_id text,
  add column settings jsonb,
  -- A key for the runtime's Runner: `{ apiKey: "…" | null }` until it is taken, then
  -- `{ apiKey: true | false }` — set or cleared.
  add column secret jsonb;

-- Which keys the Runner holds, by runtime id: `{ "rt_…": ["apiKey"] }`.
alter table cloud.runners add column secrets jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Binding
-- ---------------------------------------------------------------------------

-- The runtime a job runs on: its task's, the one it names, or the account's that matches its
-- connector and model.
create function cloud.runner_job_runtime(j cloud.runner_jobs) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
  t cloud.tasks;
begin
  if j.runtime_id is not null then
    select * into r from cloud.runtimes where id = j.runtime_id and account_id = j.owner_id;
    if found then return r; end if;
  end if;
  if j.task_id is not null then
    select * into t from cloud.tasks where id = j.task_id;
    if found then
      select * into r from cloud.runtimes where id = t.runtime and account_id = t.account_id;
      if found and r.connector = j.runtime and r.model is not distinct from j.model then return r; end if;
    end if;
  end if;
  select * into r from cloud.runtimes
  where account_id = j.owner_id and connector = j.runtime and model is not distinct from j.model
  order by is_default desc, created_at limit 1;
  if found then return r; end if;
  select * into r from cloud.runtimes where account_id = j.owner_id and is_default and connector = j.runtime;
  return r;
end;
$$;

-- Every job carries its runtime's settings and goes to its Runner, with the project's folder there.
create function cloud.runner_job_bind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes := cloud.runner_job_runtime(new);
begin
  if r.id is null then return new; end if;
  new.runtime_id := r.id;
  new.settings := r.settings;
  if r.runner is not null and new.machine_id is distinct from r.runner then
    new.machine_id := r.runner;
    if new.project_id is not null then
      new.project_dir := (select f.path from cloud.project_folders f where f.project_id = new.project_id and f.machine_id = r.runner);
    end if;
  end if;
  return new;
end;
$$;

create trigger runner_job_bind before insert on cloud.runner_jobs
for each row execute function cloud.runner_job_bind();

-- A Runner registering binds the account's runtimes that have none.
create function cloud.runner_binds_runtimes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cloud.runtimes set runner = new.machine_id, updated_at = now()
  where account_id = new.owner_id and runner is null;
  return new;
end;
$$;

create trigger runner_binds_runtimes after insert or update of machine_id on cloud.runners
for each row execute function cloud.runner_binds_runtimes();

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

-- 0079's, with the runtime's id, its settings and a key job's flag. The key itself never.
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
    'projectDir', coalesce(p_job.project_dir, case when p_job.agent is not null then
      (select f.path from cloud.project_folders f
        where f.project_id = p_job.project_id and f.machine_id = coalesce(p_job.claimed_machine, p_job.machine_id)) end),
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

-- The keys the runtime's Runner reports holding; none when it is bound elsewhere.
create function cloud.v1_runtime_secrets(r cloud.runtimes) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select x.secrets -> r.id from cloud.runners x
                   where x.owner_id = r.account_id and x.machine_id = r.runner), '[]'::jsonb);
$$;

create or replace function cloud.v1_runtime_json(r cloud.runtimes) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'object', 'runtime', 'name', r.name, 'connector', r.connector, 'model', r.model,
    'runner', r.runner, 'settings', r.settings, 'secretsSet', cloud.v1_runtime_secrets(r),
    'default', r.is_default, 'created_at', cloud.v1_ts(r.created_at), 'updated_at', cloud.v1_ts(r.updated_at));
$$;

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------

-- 0067's, bound to the account's Runner.
create or replace function cloud.v1_default_runtime(p_account uuid) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  if found then return r; end if;
  insert into cloud.runtimes (id, account_id, name, connector, is_default, runner)
  values (cloud.v1_id('rt'), p_account, 'Global default', cloud.v1_default_connector(p_account), true,
          (select x.machine_id from cloud.runners x where x.owner_id = p_account))
  on conflict (account_id) where is_default do nothing;
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  return r;
end;
$$;

create or replace function cloud.v1_connectors(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name',
    case when not coalesce((e ->> 'installed')::boolean, false) then 'not_installed'
         when (e ->> 'loggedIn')::boolean is false then 'signed_out' else 'ready' end), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account;
$$;

create or replace function cloud.v1_connector_models(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name', e -> 'models'), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and jsonb_typeof(e -> 'models') = 'array' and coalesce((e ->> 'installed')::boolean, false);
$$;

-- What each connector takes on the Runner, as its harness declares it.
create function cloud.v1_connector_settings(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(e ->> 'name', e -> 'settings'), '{}')
  from cloud.runners x, jsonb_array_elements(x.runtimes) e
  where x.owner_id = p_account and jsonb_typeof(e -> 'settings') = 'array';
$$;

create or replace function api.v1_list_runtimes(p_account uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_default_runtime(p_account);
  return jsonb_build_object(
    'data', (select jsonb_agg(cloud.v1_runtime_json(r) order by r.is_default desc, r.created_at, r.id)
             from cloud.runtimes r where r.account_id = p_account),
    'next', null,
    'connectors', cloud.v1_connectors(p_account),
    'models', cloud.v1_connector_models(p_account),
    'connector_settings', cloud.v1_connector_settings(p_account),
    'runners', coalesce((select jsonb_agg(jsonb_build_object('id', x.machine_id, 'name', x.machine_name,
                 'online', x.live_until > now())) from cloud.runners x where x.owner_id = p_account), '[]'::jsonb),
    'runner_connected', exists (select 1 from cloud.runners x where x.owner_id = p_account and x.live_until > now()));
end;
$$;

-- A runtime's Runner is the account's.
create function cloud.v1_runtime_runner(p_account uuid, p_runner uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_runner is not null and not exists (select 1 from cloud.runners x where x.owner_id = p_account and x.machine_id = p_runner) then
    raise exception 'That Runner is not connected to this account.' using errcode = 'AKB28';
  end if;
  return p_runner;
end;
$$;

create or replace function api.v1_create_runtime(p_account uuid, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_default_runtime(p_account);
  perform cloud.v1_runtime_name_free(p_account, p_fields ->> 'name');
  insert into cloud.runtimes (id, account_id, name, connector, model, runner, settings)
  values (cloud.v1_id('rt'), p_account, p_fields ->> 'name', p_fields ->> 'connector', p_fields ->> 'model',
          cloud.v1_runtime_runner(p_account, (p_fields ->> 'runner')::uuid), coalesce(p_fields -> 'settings', '{}'::jsonb))
  returning * into r;
  return cloud.v1_runtime_json(r);
end;
$$;

-- 0065's, with `runner` and `settings`; a field left out is kept.
create or replace function api.v1_update_runtime(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer) returns jsonb
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
    runner = case when p_fields ? 'runner' then cloud.v1_runtime_runner(p_account, (p_fields ->> 'runner')::uuid) else runner end,
    settings = coalesce(p_fields -> 'settings', settings),
    updated_at = now()
  where id = p_id
  returning * into r;
  return cloud.v1_runtime_json(r);
end;
$$;

-- ---------------------------------------------------------------------------
-- Testing one, and handing it a key
-- ---------------------------------------------------------------------------

create function cloud.v1_runtime_online(r cloud.runtimes) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.runners x where x.owner_id = r.account_id and x.live_until > now()
                 and (r.runner is null or x.machine_id = r.runner)) then
    raise exception 'The Runner this runtime runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
end;
$$;

-- 0065's, on the runtime's own Runner.
create or replace function api.v1_test_runtime(p_account uuid, p_id text, p_prompt text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes := cloud.v1_own_runtime(p_account, p_id);
  j cloud.runner_jobs;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_runtime_online(r);
  insert into cloud.runner_jobs (owner_id, runtime, runtime_id, model, test, prompt)
  values (p_account, r.connector, r.id, r.model, true, p_prompt)
  returning * into j;
  perform cloud.hint_runner(p_account, j.id);
  return jsonb_build_object('job', j.id, 'connector', r.connector, 'model', r.model);
end;
$$;

-- A job that hands the runtime's Runner its keys: `{ apiKey: "…" }` sets one, `null` clears it.
create function api.v1_set_runtime_secrets(p_account uuid, p_id text, p_secrets jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes := cloud.v1_own_runtime(p_account, p_id);
  j cloud.runner_jobs;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  perform cloud.v1_runtime_online(r);
  -- A Runner before protocol 9 would run the job as a test and drop the key.
  if exists (select 1 from cloud.runners x where x.owner_id = p_account and x.protocol < 9) then
    raise exception 'This Runner is out of date.' using errcode = 'AKB26', detail = 'runner_outdated';
  end if;
  insert into cloud.runner_jobs (owner_id, runtime, runtime_id, model, test, prompt, secret)
  values (p_account, r.connector, r.id, r.model, true, 'Keep the runtime''s keys.', p_secrets)
  returning * into j;
  perform cloud.hint_runner(p_account, j.id);
  return jsonb_build_object('job', j.id);
end;
$$;

-- The keys a claimed job carries, once: what stays is whether each was set or cleared.
create function api.take_runner_secrets(p_subject uuid, p_machine uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_secret jsonb;
begin
  select secret into v_secret from cloud.runner_jobs
  where id = p_job and owner_id = p_subject and claimed_machine = p_machine and state = 'claimed' for update;
  if v_secret is null or exists (select 1 from jsonb_each(v_secret) e where jsonb_typeof(e.value) = 'boolean') then
    return null;
  end if;
  update cloud.runner_jobs
     set secret = (select jsonb_object_agg(e.key, jsonb_typeof(e.value) = 'string') from jsonb_each(v_secret) e),
         updated_at = now()
   where id = p_job;
  return v_secret;
end;
$$;

-- How a test or a key job ended, or null while it runs. One not done after `p_limit_seconds` is
-- stopped, reads as timed out, and its keys are dropped; a key job done says so in the list.
create or replace function api.v1_runtime_test(p_account uuid, p_job uuid, p_limit_seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
begin
  select * into j from cloud.runner_jobs where id = p_job and owner_id = p_account and test for update;
  if not found then perform cloud.v1_missing('test'); end if;
  if j.state <> 'finished' and j.created_at < now() - make_interval(secs => p_limit_seconds) then
    update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'timeout', finished_at = now(),
      secret = case when secret is null then null else '{}'::jsonb end, updated_at = now()
    where id = p_job returning * into j;
  end if;
  if j.state <> 'finished' then return null; end if;
  if j.secret is not null then
    update cloud.runner_jobs set secret = '{}'::jsonb where id = p_job and secret <> '{}'::jsonb
      and exists (select 1 from jsonb_each(secret) e where jsonb_typeof(e.value) = 'string');
    if j.outcome = 'done' then
      update cloud.runners x set secrets = jsonb_set(x.secrets, array[j.runtime_id], coalesce((
          select jsonb_agg(k) from (
            select k from jsonb_array_elements_text(coalesce(x.secrets -> j.runtime_id, '[]'::jsonb)) k
            where not j.secret ? k
            union select e.key from jsonb_each(j.secret) e where e.value = 'true'::jsonb) s), '[]'::jsonb))
      where x.owner_id = p_account and x.machine_id = j.machine_id;
    end if;
  end if;
  return jsonb_build_object('outcome', j.outcome, 'reason', j.reason, 'elapsed_ms', j.elapsed_ms);
end;
$$;

-- What keys the Runner holds, as it reports them on every register.
create function api.report_runner_secrets(p_subject uuid, p_machine uuid, p_secrets jsonb) returns void
language sql security definer set search_path = '' as $$
  update cloud.runners set secrets = coalesce(p_secrets, '{}'::jsonb)
  where owner_id = p_subject and machine_id = p_machine and secrets is distinct from coalesce(p_secrets, '{}'::jsonb);
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
revoke all on function cloud.runner_job_json(cloud.runner_jobs) from public;
revoke all on function cloud.runner_job_runtime(cloud.runner_jobs) from public;
revoke all on function cloud.runner_job_bind() from public;
revoke all on function cloud.runner_binds_runtimes() from public;
revoke all on function api.take_runner_secrets(uuid, uuid, uuid) from public;
revoke all on function api.report_runner_secrets(uuid, uuid, jsonb) from public;
grant execute on function api.take_runner_secrets(uuid, uuid, uuid) to service_role;
grant execute on function api.report_runner_secrets(uuid, uuid, jsonb) to service_role;
