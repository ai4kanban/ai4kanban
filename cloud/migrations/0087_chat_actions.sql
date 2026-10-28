-- Everyday chat actions (#2133): pictures sent with a message, a reply stopped part way, and
-- each reply's time, tokens and cost.
--
-- - **Pictures reach the Runner only**: they ride the reply's job as attachments, dropped once
--   the job ends however it ends; the message keeps their names alone.
-- - **Stop**: a job still waiting ends with no reply; a running one is asked to stop, over its
--   log and on its next renewal. A Runner before protocol 8 knows no stop: that renewal ends it.
-- - **A reply names its job**: its usage, cost and time are read off the job.

alter table cloud.runner_jobs add column stop_requested boolean not null default false;

alter table cloud.task_chat_messages
  add column image_names text[] not null default '{}',
  add column stopped boolean not null default false,
  add column job_id uuid references cloud.runner_jobs (id) on delete set null,
  drop constraint task_chat_messages_body_check,
  add constraint task_chat_messages_body_check
    check ((length(btrim(body)) > 0 or cardinality(image_names) > 0) and octet_length(body) <= 65536);

alter table cloud.discussion_messages
  add column image_names text[] not null default '{}',
  add column stopped boolean not null default false,
  add column job_id uuid references cloud.runner_jobs (id) on delete set null,
  drop constraint discussion_messages_body_check,
  add constraint discussion_messages_body_check
    check ((length(btrim(body)) > 0 or cardinality(image_names) > 0) and octet_length(body) <= 65536);

-- A job's attachments go as it ends.
create function cloud.drop_job_attachments() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.attachments := '[]';
  return new;
end;
$$;

create trigger runner_jobs_drop_attachments before update of state on cloud.runner_jobs
  for each row when (new.state = 'finished' and old.attachments <> '[]'::jsonb)
  execute function cloud.drop_job_attachments();

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

-- `usage`, `cost_usd` and `duration_ms` from the job that wrote a reply; null without one.
create function cloud.v1_message_json(p_id text, p_role text, p_body text, p_at timestamptz, p_images text[],
                                      p_stopped boolean, p_job uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p_id, 'role', p_role, 'body', p_body, 'created_at', cloud.v1_ts(p_at),
    'image_names', to_jsonb(p_images), 'stopped', p_stopped, 'usage', j.usage, 'cost_usd', j.cost_usd,
    'duration_ms', (extract(epoch from j.finished_at - j.created_at) * 1000)::bigint)
  from (select 1) one left join cloud.runner_jobs j on j.id = p_job;
$$;

create or replace function cloud.v1_chat_message_json(m cloud.task_chat_messages) returns jsonb
language sql stable set search_path = '' as $$
  select cloud.v1_message_json(m.id, m.role, m.body, m.created_at, m.image_names, m.stopped, m.job_id);
$$;

-- 0074's, its messages as a task chat's.
create or replace function cloud.v1_discussion_json(d cloud.discussions) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  v_ready jsonb := cloud.v1_connectors(d.account_id);
  v_status text := 'idle';
begin
  if d.job_id is not null then
    j := cloud.v1_discussion_job(d);
    v_status := case when j.id is null then 'failed' else 'replying' end;
  elsif d.failure is not null then
    v_status := d.failure;
  end if;
  return jsonb_build_object(
    'object', 'discussion', 'id', d.id, 'workspace', d.workspace_id, 'project', d.project_id,
    'title', cloud.v1_discussion_title(d),
    'messages', coalesce((
      select jsonb_agg(cloud.v1_message_json(m.id, m.role, m.body, m.created_at, m.image_names, m.stopped, m.job_id)
        order by m.seq)
      from cloud.discussion_messages m where m.discussion_id = d.id), '[]'),
    'status', v_status,
    'runtime', coalesce(d.runtime, (select x.id from cloud.runtimes x where x.account_id = d.account_id and x.is_default)),
    'runtimes', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'default', x.is_default,
        'connector', x.connector, 'model', x.model, 'status', coalesce(v_ready ->> x.connector, 'ready'))
        order by x.is_default desc, x.created_at, x.id)
      from cloud.runtimes x where x.account_id = d.account_id), '[]'),
    'runner', jsonb_build_object('connected', exists (
      select 1 from cloud.runners r where r.owner_id = d.account_id and r.live_until > now())),
    'context', case when d.session is not null and (d.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (d.context ->> 'used')::integer, 'limit', (d.context ->> 'limit')::integer) end,
    'ideas', coalesce((
      select jsonb_agg(cloud.v1_idea_json(i) order by i.seq)
      from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'),
    'created_at', cloud.v1_ts(d.created_at), 'updated_at', cloud.v1_ts(d.updated_at));
end;
$$;

-- ---------------------------------------------------------------------------
-- Pictures
-- ---------------------------------------------------------------------------

-- A message as the agent reads it: the pictures it carried named after its words.
create function cloud.v1_said(p_body text, p_images text[]) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(E'\n\n', nullif(p_body, ''),
    case when cardinality(p_images) > 0 then '[Pictures: ' || array_to_string(p_images, ', ') || ']' end);
$$;

create function cloud.v1_image_names(p_images jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(e ->> 'name' order by n), '{}') from jsonb_array_elements(coalesce(p_images, '[]')) with ordinality x(e, n);
$$;

create function cloud.v1_image_files(p_images jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', e ->> 'name', 'content', e ->> 'content') order by n), '[]')
  from jsonb_array_elements(coalesce(p_images, '[]')) with ordinality x(e, n);
$$;

create or replace function cloud.task_chat_prompt(p_task text, p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  with recent as (
    select m.role, cloud.v1_said(m.body, m.image_names) body, row_number() over (order by m.seq desc) n
    from cloud.task_chat_messages m where m.task_id = p_task and m.account_id = p_account order by m.seq desc limit 30
  )
  select concat_ws(E'\n\n',
    'Answer the newest message in this task card''s review-page chat, following `akb guide card-chat`.',
    case when count(*) filter (where n > 1) > 0 then E'The conversation so far, oldest first:\n\n' || string_agg(
      case when role = 'user' then 'User: ' else 'Agent: ' end || body, E'\n\n' order by n desc) filter (where n > 1) end,
    E'The newest message:\n\n' || max(body) filter (where n = 1))
  from recent;
$$;

create or replace function cloud.v1_discussion_prompt(p_id text) returns text
language sql stable security definer set search_path = '' as $$
  with recent as (
    select m.role, cloud.v1_said(m.body, m.image_names) body, row_number() over (order by m.seq desc) n
    from cloud.discussion_messages m where m.discussion_id = p_id order by m.seq desc limit 30
  ), ideas as (
    select i.id || ' · ' || i.title || ' · ' || i.workflow || ' · ' || case when i.state = 'started' then
      'started as ' || coalesce((select p.prefix || '-' || t.number from cloud.tasks t join cloud.projects p on p.id = t.project_id
                                 where t.id = i.task_id), 'a task') else 'not started' end line, i.seq
    from cloud.discussion_ideas i where i.discussion_id = p_id and i.state <> 'dropped' order by i.seq limit 10
  )
  select concat_ws(E'\n\n',
    'Answer the newest message in this idea conversation, following `akb guide discuss-idea`.',
    coalesce(E'The ideas so far:\n\n' || (select string_agg('- ' || line, E'\n' order by seq) from ideas), 'No ideas yet.'),
    case when count(*) filter (where n > 1) > 0 then E'The conversation so far, oldest first:\n\n' || string_agg(
      case when role = 'user' then 'User: ' else 'Agent: ' end || body, E'\n\n' order by n desc) filter (where n > 1) end,
    E'The newest message:\n\n' || max(body) filter (where n = 1))
  from recent;
$$;

-- 0067's, with `p_images` `[{ name, type, content }]` sent to the reply's job.
drop function api.v1_task_chat_send(uuid, text, text, text, integer);
drop function api.v1_shared_chat_send(text, uuid, text, text, text, integer);
drop function cloud.v1_chat_send(uuid, text, text, text, integer);
create function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
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

create function api.v1_task_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
                                      p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  return cloud.v1_chat_send(p_account, p_task, p_body, p_runtime, p_daily_write_budget, p_images);
end;
$$;

create function api.v1_shared_chat_send(
  p_hash text, p_subject uuid, p_email text, p_body text, p_runtime text, p_daily_write_budget integer,
  p_images jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
begin
  perform cloud.v1_write((v ->> 'account')::uuid, v ->> 'workspace', p_daily_write_budget);
  return jsonb_build_object('workspace', v -> 'workspace',
    'result', cloud.v1_chat_send((v ->> 'account')::uuid, v ->> 'task', p_body, p_runtime, p_daily_write_budget, p_images));
end;
$$;

-- 0074's, with `p_images`.
drop function api.v1_discussion_send(uuid, text, text, text, integer);
drop function cloud.v1_discussion_send(uuid, text, text, text, integer);
create function cloud.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer,
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

create function api.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer,
                                       p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, (cloud.v1_own_discussion(p_account, p_id)).workspace_id, p_daily_write_budget);
  return cloud.v1_discussion_send(p_account, p_id, p_body, p_runtime, p_daily_write_budget, p_images);
end;
$$;

-- ---------------------------------------------------------------------------
-- Stop
-- ---------------------------------------------------------------------------

-- A reply ended unwritten: its job finished as stopped, its chat free again with no failure.
create function cloud.v1_end_stopped(p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  v_discussion text;
begin
  update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'Stopped.', finished_at = now(), updated_at = now()
   where id = p_job
  returning discussion_id into v_discussion;
  for h in select * from cloud.task_chats where job_id = p_job loop
    update cloud.task_chats set job_id = null, failure = null, updated_at = now()
     where task_id = h.task_id and account_id = h.account_id;
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
  if exists (select 1 from cloud.discussions where id = v_discussion and job_id = p_job) then
    update cloud.discussions set job_id = null, failure = null, updated_at = now() where id = v_discussion;
    perform cloud.v1_discussion_changed(v_discussion);
  end if;
end;
$$;

-- A waiting reply ends at once; a running one is asked to stop, and answered here so the Worker
-- tells its Runner. Null when there was nothing to ask. A task's step answering its chat is no
-- reply to stop: cancelling the task stops that.
create function cloud.v1_stop_reply(p_job uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
begin
  select * into j from cloud.runner_jobs where id = p_job for update;
  if j.id is null or j.state = 'finished' or cloud.runner_job_interrupted(j) or j.flow is not null then return null; end if;
  if j.state = 'waiting' then
    perform cloud.v1_end_stopped(j.id);
    return null;
  end if;
  update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = j.id;
  return j.id;
end;
$$;

create function api.v1_task_chat_stop(p_account uuid, p_task text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  v_job uuid;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account for update;
  v_job := cloud.v1_stop_reply(h.job_id);
  return jsonb_build_object('job', v_job, 'result', cloud.task_chat_json(p_account, p_task));
end;
$$;

create function api.v1_shared_chat_stop(p_hash text, p_subject uuid, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
  v_account uuid := (v ->> 'account')::uuid;
  h cloud.task_chats;
  v_job uuid;
begin
  perform cloud.v1_write(v_account, v ->> 'workspace', p_daily_write_budget);
  select * into h from cloud.task_chats where task_id = v ->> 'task' and account_id = v_account for update;
  v_job := cloud.v1_stop_reply(h.job_id);
  return jsonb_build_object('workspace', v -> 'workspace', 'job', v_job,
    'result', cloud.task_chat_json(v_account, v ->> 'task'));
end;
$$;

create function api.v1_discussion_stop(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
  v_job uuid;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_id for update;
  v_job := cloud.v1_stop_reply(d.job_id);
  select * into d from cloud.discussions where id = p_id;
  return jsonb_build_object('job', v_job, 'result', cloud.v1_discussion_json(d));
end;
$$;

-- 0048's: a job asked to stop says so; an older Runner's ends here, with no reply.
create or replace function api.renew_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
begin
  if v_job.id is null then
    return json_build_object('renewed', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  if v_job.stop_requested and coalesce((select r.protocol from cloud.runners r
                                         where r.owner_id = v_job.owner_id and r.machine_id = p_machine), 0) < 8 then
    if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
    perform cloud.v1_end_stopped(v_job.id);
    return json_build_object('renewed', false);
  end if;
  update cloud.runner_jobs
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job;
  return json_build_object('renewed', true, 'stop', v_job.stop_requested);
end;
$$;

-- 0074's: a reply names its job and whether it was stopped; a stopped discussion reply leaves
-- the ideas as they were. The attachments a retry needs are read before the job ends.
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
  v_files jsonb := v_job.attachments;
  v_outcome text := p_outcome;
  v_reason text := nullif(p_reason, '');
  v_retry cloud.runner_jobs;
  v_reply text := nullif(btrim(left(coalesce(p_report ->> 'reply', ''), 60000)), '');
  v_stopped boolean := coalesce(p_report -> 'stopped' = 'true'::jsonb, false);
  h cloud.task_chats;
  d cloud.discussions;
  v_start jsonb := '[]';
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
  if v_job.discussion_id is not null then
    perform cloud.v1_lock((select x.workspace_id from cloud.discussions x where x.id = v_job.discussion_id));
  end if;
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
            v_job.task_id, v_job.stage, v_job.flow, 2, v_job.resume, v_job.prompt, v_files)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_job.task_id is not null and cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_outcome = 'done' and v_job.stage = 'plan' then perform cloud.v1_submit_draft(v_job.task_id); end if;
    if v_job.flow is not null then perform cloud.v1_finish_flow(v_job, p_report); end if;
  end if;

  for h in select * from cloud.task_chats where job_id = p_job loop
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body, stopped, job_id)
      values (cloud.v1_id('msg'), h.task_id, h.account_id, 'agent', v_reply, v_stopped, p_job);
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

  select * into d from cloud.discussions where id = v_job.discussion_id and job_id = p_job for update;
  if d.id is not null then
    if v_outcome = 'done' then
      if v_reply is not null then
        insert into cloud.discussion_messages (id, discussion_id, role, body, stopped, job_id)
        values (cloud.v1_id('msg'), d.id, 'agent', v_reply, v_stopped, p_job);
      end if;
      if not v_stopped then v_start := cloud.v1_apply_ideas(d.id, p_report -> 'ideas'); end if;
    end if;
    update cloud.discussions set
      job_id = null,
      session = coalesce(p_report ->> 'session', session),
      session_runtime = case when p_report ->> 'session' is not null
                             then cloud.v1_session_key(v_job.runtime, v_job.model) else session_runtime end,
      context = coalesce(p_report -> 'context', context),
      failure = case when v_outcome = 'failed' then 'failed' end,
      updated_at = now()
    where id = d.id;
    perform cloud.v1_discussion_changed(d.id);
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end,
    'discussion', d.id, 'start', v_start);
end;
$$;

-- 0075's, and the pictures of jobs whose Runner went away: once a lapsed task job can no longer
-- be run again, or a day after.
create or replace function api.sweep_task_chats(p_days integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_messages integer;
  v_chats integer;
  v_files integer;
begin
  delete from cloud.task_chat_messages where created_at < now() - make_interval(days => p_days);
  get diagnostics v_messages = row_count;
  delete from cloud.task_chats h
   where h.job_id is null and h.updated_at < now() - make_interval(days => p_days)
     and not exists (select 1 from cloud.task_chat_messages m where m.task_id = h.task_id and m.account_id = h.account_id);
  get diagnostics v_chats = row_count;
  update cloud.runner_jobs j set attachments = '[]'
   where j.state <> 'finished' and j.attachments <> '[]'::jsonb and cloud.runner_job_interrupted(j)
     and (j.task_id is null or j.attempt >= 2 or j.lease_expires_at < now() - interval '1 day');
  get diagnostics v_files = row_count;
  return jsonb_build_object('messages', v_messages, 'chats', v_chats, 'attachments', v_files);
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
revoke all on function cloud.drop_job_attachments() from public;
revoke all on function cloud.task_chat_prompt(text, uuid) from public;
revoke all on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) to service_role;
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) to service_role;
revoke all on function api.sweep_task_chats(integer) from public;
grant execute on function api.sweep_task_chats(integer) to service_role;
