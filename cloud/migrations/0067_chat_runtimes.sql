-- Chats run on a runtime (#2083): the task's by default, or one of the person's own.
--
-- - **`task_chats.runtime` is a runtime id**: null follows the task. Old connector names are
--   cleared, and a deleted runtime falls back to the task's.
-- - **`session_runtime` is connector and model**: changing either starts a new session.
-- - **A connector not ready is refused**: when the creator's Runner reports it not installed or
--   signed out, nothing is sent and the message is not kept (`AKB30`, `detail` the connector,
--   `hint` the reason).

update cloud.task_chats set runtime = null;
alter table cloud.task_chats
  drop constraint task_chats_runtime_check,
  add constraint task_chats_runtime_fkey foreign key (runtime) references cloud.runtimes (id) on delete set null;

drop function cloud.v1_flow_runtime(uuid);

-- What `session_runtime` holds for a job or a runtime.
create function cloud.v1_session_key(p_connector text, p_model text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(' ', p_connector, p_model);
$$;

-- The connector Global default is made with: Claude Code when the Runner has it ready, else Codex.
create function cloud.v1_default_connector(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e ->> 'name' from cloud.runners x, jsonb_array_elements(x.runtimes) e
    where x.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex')
      and coalesce((e ->> 'installed')::boolean, false) and coalesce((e ->> 'loggedIn')::boolean, true)
    order by e ->> 'name' = 'claude-code' desc limit 1), 'claude-code');
$$;

create or replace function cloud.v1_default_runtime(p_account uuid) returns cloud.runtimes
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  if found then return r; end if;
  insert into cloud.runtimes (id, account_id, name, connector, is_default)
  values (cloud.v1_id('rt'), p_account, 'Global default', cloud.v1_default_connector(p_account), true)
  on conflict (account_id) where is_default do nothing;
  select * into r from cloud.runtimes where account_id = p_account and is_default;
  return r;
end;
$$;

-- `v1_task_runtime` for a read: Global default not made yet reads as it would be made.
create function cloud.v1_task_runtime_read(t cloud.tasks) returns cloud.runtimes
language plpgsql stable security definer set search_path = '' as $$
declare
  r cloud.runtimes;
begin
  select * into r from cloud.runtimes where id = t.runtime and account_id = t.account_id;
  if found then return r; end if;
  select * into r from cloud.runtimes where account_id = t.account_id and is_default;
  if found then return r; end if;
  r.account_id := t.account_id;
  r.name := 'Global default';
  r.connector := cloud.v1_default_connector(t.account_id);
  r.is_default := true;
  return r;
end;
$$;

-- `status`: `idle`, `queued` behind the task's other jobs, `replying`, or how the last reply
-- failed. `runtime`: the pick, `task` when following the task. `runtimes`: the task's runtime
-- first, named only for its creator, then the caller's own others.
create or replace function cloud.task_chat_json(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  j cloud.runner_jobs;
  r cloud.runners;
  t cloud.tasks;
  tr cloud.runtimes;
  v_ready jsonb;
  v_status text := 'idle';
begin
  select * into t from cloud.tasks where id = p_task;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  select * into r from cloud.runners where owner_id = t.account_id;
  tr := cloud.v1_task_runtime_read(t);
  v_ready := cloud.v1_connectors(t.account_id);
  if h.job_id is not null then
    j := cloud.task_chat_job(h);
    if j.id is null then v_status := 'failed';
    elsif j.state = 'waiting' and cloud.runner_job_queued(j) then v_status := 'queued';
    else v_status := 'replying';
    end if;
  elsif h.failure is not null then
    v_status := h.failure;
  end if;
  return jsonb_build_object(
    'object', 'task_chat',
    'messages', coalesce((
      select jsonb_agg(cloud.v1_chat_message_json(m) order by m.seq)
      from cloud.task_chat_messages m where m.task_id = p_task and m.account_id = p_account), '[]'),
    'status', v_status,
    'runtime', coalesce(h.runtime, 'task'),
    'runtimes', jsonb_build_array(jsonb_build_object('id', 'task',
        'name', case when p_account = t.account_id then tr.name end,
        'default', p_account = t.account_id and tr.is_default,
        'connector', tr.connector, 'model', tr.model,
        'status', coalesce(v_ready ->> tr.connector, 'ready')))
      || coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'default', x.is_default,
          'connector', x.connector, 'model', x.model, 'status', coalesce(v_ready ->> x.connector, 'ready'))
          order by x.is_default desc, x.created_at, x.id)
        from cloud.runtimes x
        where x.account_id = p_account and (p_account <> t.account_id or x.id is distinct from tr.id)), '[]'),
    'runner', jsonb_build_object('connected', coalesce(r.live_until > now(), false)),
    'context', case when h.session is not null and (h.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (h.context ->> 'used')::integer, 'limit', (h.context ->> 'limit')::integer) end);
end;
$$;

-- One message, answered by a job of the task on its creator's Runner. `p_runtime`: one of the
-- caller's runtimes, `task`, or null to keep the last pick. The caller holds the workspace's lock.
create or replace function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer)
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
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', p_body);
  v_job := (api.dispatch_runner_job(t.account_id, r.connector, null, cloud.task_chat_prompt(p_task, p_account), '[]',
                                    p_daily_write_budget, p_task) ->> 'id')::uuid;
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

-- 0065's finish: a chat's session is kept with its job's connector and model.
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
      session_runtime = case when v_job.flow is null and p_report ->> 'session' is not null
                             then cloud.v1_session_key(v_job.runtime, v_job.model) else session_runtime end,
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
revoke all on function cloud.task_chat_json(uuid, text) from public;
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) to service_role;
