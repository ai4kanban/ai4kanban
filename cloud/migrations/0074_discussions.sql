-- Ideas drafted in chat (#2073): a discussion is one person's conversation with an agent in a
-- workspace, drafting up to 10 ideas; starting one makes it a task.
--
-- - **A discussion is its creator's alone**: anyone else reads `not_found`. It is no task: it is
--   never on a board and never counts toward open tasks.
-- - **Each reply is a Runner job**: on the creator's Runner, in the discussion's project folder
--   when placed there, refused as a task chat is (`chat_busy`, `runner_offline`, `AKB30`).
-- - **A finished reply carries the ideas' whole state**: new ones are added, open ones updated,
--   dropped ones dropped; started ones are left alone. The Worker starts the ones asked to start.
-- - **A dropped idea is kept**: so the list can tell a discussion whose ideas all went.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.discussions (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  project_id text references cloud.projects (id) on delete set null,
  -- The runtime picked; a deleted one falls back to Global default.
  runtime text references cloud.runtimes (id) on delete set null,
  job_id uuid references cloud.runner_jobs (id) on delete set null,
  session text,
  session_runtime text,
  context jsonb,
  failure text check (failure in ('failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discussions_account on cloud.discussions (account_id, workspace_id);
create index discussions_job on cloud.discussions (job_id) where job_id is not null;
alter table cloud.discussions enable row level security;

create table cloud.discussion_messages (
  id text primary key,
  discussion_id text not null references cloud.discussions (id) on delete cascade,
  role text not null check (role in ('user', 'agent')),
  body text not null check (length(btrim(body)) > 0 and octet_length(body) <= 65536),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index discussion_messages_discussion on cloud.discussion_messages (discussion_id, seq);
alter table cloud.discussion_messages enable row level security;

create table cloud.discussion_ideas (
  id text primary key,
  discussion_id text not null references cloud.discussions (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  outcome text not null default '',
  acceptance jsonb not null default '[]' check (jsonb_typeof(acceptance) = 'array'),
  workflow text not null,
  state text not null default 'open' check (state in ('open', 'started', 'dropped')),
  task_id text references cloud.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index discussion_ideas_discussion on cloud.discussion_ideas (discussion_id, seq);
alter table cloud.discussion_ideas enable row level security;

alter table cloud.runner_jobs add column discussion_id text references cloud.discussions (id) on delete set null;
alter table cloud.tasks add column discussion_id text references cloud.discussions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'card_version', nullif(t.card_version, 0), 'runtime', t.runtime,
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'last_job', (select j.id from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null order by j.seq desc limit 1),
    'discussion', t.discussion_id,
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create function cloud.v1_idea_json(i cloud.discussion_ideas) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'title', i.title, 'outcome', i.outcome, 'acceptance', i.acceptance,
    'workflow', i.workflow,
    'task', (select jsonb_build_object('id', t.id, 'key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number)
             from cloud.tasks t where t.id = i.task_id));
$$;

-- A discussion's job carries its ideas, `task` the started one's id.
create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'model', p_job.model,
    'test', p_job.test,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
    'discussion', (select json_build_object('id', d.id, 'workspace', d.workspace_id,
        'ideas', coalesce((select json_agg(json_build_object('id', i.id, 'title', i.title, 'outcome', i.outcome,
            'acceptance', i.acceptance, 'workflow', i.workflow, 'task', i.task_id) order by i.seq)
          from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'::json))
      from cloud.discussions d where d.id = p_job.discussion_id),
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

-- The discussion's job still waiting or running.
create function cloud.v1_discussion_job(d cloud.discussions) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j
  where j.id = d.job_id and j.state <> 'finished' and not cloud.runner_job_interrupted(j);
$$;

-- `replying` while a job writes the reply; `waiting_you` when the agent spoke last and an idea
-- waits to be started.
create function cloud.v1_discussion_state(d cloud.discussions) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when (cloud.v1_discussion_job(d)).id is not null then 'replying'
    when (select m.role from cloud.discussion_messages m where m.discussion_id = d.id order by m.seq desc limit 1) = 'agent'
      and exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id and i.state = 'open') then 'waiting_you'
    else 'idle' end;
$$;

create function cloud.v1_discussion_title(d cloud.discussions) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select i.title from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped' order by i.seq limit 1),
    (select left(btrim(m.body), 80) from cloud.discussion_messages m where m.discussion_id = d.id order by m.seq limit 1),
    '');
$$;

-- `runtime` the pick, Global default when it was deleted; `runtimes` the creator's own, with
-- `status` read off their Runner.
create function cloud.v1_discussion_json(d cloud.discussions) returns jsonb
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
      select jsonb_agg(jsonb_build_object('id', m.id, 'role', m.role, 'body', m.body, 'created_at', cloud.v1_ts(m.created_at))
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

-- Tells its creator, and nobody else.
create function cloud.v1_discussion_changed(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions;
begin
  select * into d from cloud.discussions where id = p_id;
  if d.id is null then return; end if;
  perform cloud.v1_emit(d.workspace_id, 'discussion.updated',
    jsonb_build_object('discussion', d.id, 'state', cloud.v1_discussion_state(d)), d.account_id);
end;
$$;

-- The caller's own discussion, in a workspace they are still in.
create function cloud.v1_own_discussion(p_account uuid, p_id text) returns cloud.discussions
language plpgsql stable security definer set search_path = '' as $$
declare
  d cloud.discussions;
begin
  select * into d from cloud.discussions where id = p_id and account_id = p_account;
  if d.id is null or not cloud.v1_in(p_account, d.workspace_id) then perform cloud.v1_missing('discussion'); end if;
  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create function cloud.v1_discussion_prompt(p_id text) returns text
language sql stable security definer set search_path = '' as $$
  with recent as (
    select m.role, m.body, row_number() over (order by m.seq desc) n
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

-- One message, answered by a job on the creator's Runner. `p_runtime`: one of theirs, or null to
-- keep the pick. The caller holds the workspace's lock.
create function cloud.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer)
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
  insert into cloud.discussion_messages (id, discussion_id, role, body) values (cloud.v1_id('msg'), p_id, 'user', p_body);
  v_job := (api.dispatch_runner_job(p_account, r.connector, d.project_id, cloud.v1_discussion_prompt(p_id), '[]',
                                    p_daily_write_budget) ->> 'id')::uuid;
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

-- Applies a finished reply's ideas, the whole state; answers the ids asked to start.
create function cloud.v1_apply_ideas(p_discussion text, p_ideas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  i cloud.discussion_ideas;
  v_title text;
  v_workflow text;
  v_acceptance jsonb;
  v_start jsonb := '[]';
begin
  if jsonb_typeof(p_ideas) is distinct from 'array' then return v_start; end if;
  for e in select x from jsonb_array_elements(p_ideas) x where jsonb_typeof(x) = 'object' loop
    select * into i from cloud.discussion_ideas where id = e ->> 'id' and discussion_id = p_discussion for update;
    if i.id is not null and i.state <> 'open' then continue; end if;
    if e -> 'dropped' = 'true' then
      if i.id is not null then
        update cloud.discussion_ideas set state = 'dropped', updated_at = now() where id = i.id;
      end if;
      continue;
    end if;
    v_title := left(btrim(coalesce(e ->> 'title', '')), 200);
    if v_title = '' then continue; end if;
    v_workflow := case when e ->> 'workflow' ~ '^wf_[0-9a-z_]{1,64}$' then e ->> 'workflow' else 'wf_builtin_coding' end;
    v_acceptance := case when jsonb_typeof(e -> 'acceptance') = 'array' then
      coalesce((select jsonb_agg(a) from jsonb_array_elements(e -> 'acceptance') a
                where jsonb_typeof(a) = 'string' and btrim(a #>> '{}') <> ''), '[]') end;
    if i.id is null then
      if (select count(*) from cloud.discussion_ideas x where x.discussion_id = p_discussion and x.state <> 'dropped') >= 10 then
        continue;
      end if;
      insert into cloud.discussion_ideas (id, discussion_id, title, outcome, acceptance, workflow)
      values (cloud.v1_id('idea'), p_discussion, v_title, coalesce(e ->> 'outcome', ''), coalesce(v_acceptance, '[]'), v_workflow)
      returning * into i;
    else
      update cloud.discussion_ideas set title = v_title, outcome = coalesce(e ->> 'outcome', outcome),
        acceptance = coalesce(v_acceptance, acceptance), workflow = v_workflow, updated_at = now()
      where id = i.id returning * into i;
    end if;
    if e -> 'start' = 'true' then v_start := v_start || to_jsonb(i.id); end if;
  end loop;
  return v_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- The API
-- ---------------------------------------------------------------------------

-- Made with its first message, so a Runner not connected makes nothing.
create function api.v1_create_discussion(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
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
  return cloud.v1_discussion_send(p_account, v_id, p_fields ->> 'body', null, p_daily_write_budget);
end;
$$;

create function api.v1_discussion(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return cloud.v1_discussion_json(cloud.v1_own_discussion(p_account, p_id));
end;
$$;

create function api.v1_discussion_send(p_account uuid, p_id text, p_body text, p_runtime text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, (cloud.v1_own_discussion(p_account, p_id)).workspace_id, p_daily_write_budget);
  return cloud.v1_discussion_send(p_account, p_id, p_body, p_runtime, p_daily_write_budget);
end;
$$;

-- Clears the messages and the session; the ideas stay.
create function api.v1_discussion_clear(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_id for update;
  if (cloud.v1_discussion_job(d)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  delete from cloud.discussion_messages where discussion_id = p_id;
  update cloud.discussions set job_id = null, session = null, session_runtime = null, context = null, failure = null,
    updated_at = now()
  where id = p_id returning * into d;
  perform cloud.v1_discussion_changed(p_id);
  return cloud.v1_discussion_json(d);
end;
$$;

-- Its unstarted ideas go with it; started tasks stay, no longer naming it.
create function api.v1_delete_discussion(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_id);
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'Cancelled.', finished_at = now(),
    updated_at = now()
  where discussion_id = p_id and state = 'waiting';
  for t in update cloud.tasks set discussion_id = null, updated_at = now() where discussion_id = p_id returning * loop
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  end loop;
  delete from cloud.discussions where id = p_id;
  perform cloud.v1_emit(d.workspace_id, 'discussion.updated', jsonb_build_object('discussion', p_id, 'state', 'idle'), p_account);
  return jsonb_build_object('id', p_id, 'object', 'discussion', 'deleted', true);
end;
$$;

-- An open idea; a workflow neither installed in the workspace nor its own is `not_found`.
create function cloud.v1_open_idea(d cloud.discussions, p_idea text) returns cloud.discussion_ideas
language plpgsql security definer set search_path = '' as $$
declare
  i cloud.discussion_ideas;
begin
  select * into i from cloud.discussion_ideas where id = p_idea and discussion_id = d.id and state <> 'dropped' for update;
  if i.id is null then perform cloud.v1_missing('idea'); end if;
  if i.state = 'started' then perform cloud.v1_refuse('This idea has already been started.'); end if;
  return i;
end;
$$;

create function api.v1_update_idea(p_account uuid, p_discussion text, p_idea text, p_workflow text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  perform cloud.v1_open_idea(d, p_idea);
  if not (cloud.v1_installed(d.workspace_id, p_workflow)
          or exists (select 1 from cloud.workflows w where w.id = p_workflow and w.workspace_id = d.workspace_id)) then
    perform cloud.v1_missing('workflow');
  end if;
  update cloud.discussion_ideas set workflow = p_workflow, updated_at = now() where id = p_idea;
  update cloud.discussions set updated_at = now() where id = p_discussion returning * into d;
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_discussion_json(d);
end;
$$;

-- Discards an unstarted idea; it is kept as dropped.
create function api.v1_drop_idea(p_account uuid, p_discussion text, p_idea text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  perform cloud.v1_open_idea(d, p_idea);
  update cloud.discussion_ideas set state = 'dropped', updated_at = now() where id = p_idea;
  update cloud.discussions set updated_at = now() where id = p_discussion returning * into d;
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_discussion_json(d);
end;
$$;

-- As `POST /v1/tasks` with `run: true` on the idea, in `p_project` or the discussion's. `p_workflow`
-- is the idea's workflow as the Worker read it.
create function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
  i cloud.discussion_ideas;
  t cloud.tasks;
  v_task jsonb;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  i := cloud.v1_open_idea(d, p_idea);
  if p_workflow ->> 'id' is distinct from i.workflow then perform cloud.v1_refuse('This idea''s workflow has changed.'); end if;
  v_task := api.v1_create_task(p_account, jsonb_strip_nulls(jsonb_build_object(
      'title', i.title,
      'request', btrim(concat(i.outcome, E'\n\n## Done when\n' || (
        select string_agg('- ' || btrim(a), E'\n' order by n) from jsonb_array_elements_text(i.acceptance) with ordinality x(a, n))),
        E'\n'),
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account))),
    p_workflow, p_daily_write_budget, p_max_tasks);
  update cloud.tasks set discussion_id = p_discussion where id = v_task ->> 'id' returning * into t;
  update cloud.discussion_ideas set state = 'started', task_id = t.id, updated_at = now() where id = p_idea;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_task_json(t);
end;
$$;

-- The caller's chats in a workspace: task chats and discussions, newest message first. A
-- discussion leaves once it had ideas and none waits. `after` is the last task or discussion listed.
create or replace function api.v1_list_chats(p_account uuid, p_workspace text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
  v_limit integer := cloud.v1_limit(p_limit);
  v_at timestamptz;
begin
  if p_after is not null then
    select coalesce(
      (select max(m.created_at) from cloud.task_chat_messages m where m.task_id = p_after and m.account_id = p_account),
      (select max(m.created_at) from cloud.discussion_messages m join cloud.discussions d on d.id = m.discussion_id
        where d.id = p_after and d.account_id = p_account)) into v_at;
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.n) filter (where x.n <= v_limit), '[]'),
      'next', case when count(*) > v_limit then (array_agg(x.id order by x.n))[v_limit] end)
    from (
      select u.id, u.j, row_number() over (order by u.at desc, u.id desc) n
      from (
        select t.id, c.at,
          jsonb_build_object('task', t.id,
            'key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
            'title', t.title, 'project', t.project_id, 'last_message_at', cloud.v1_ts(c.at), 'state', cloud.v1_chat_state(h)) j
        from cloud.task_chats h
        join cloud.tasks t on t.id = h.task_id
        cross join lateral (select max(m.created_at) at from cloud.task_chat_messages m
                            where m.task_id = h.task_id and m.account_id = h.account_id) c
        where h.account_id = p_account and t.workspace_id = v_ws and c.at is not null
        union all
        select d.id, c.at,
          jsonb_build_object('discussion', d.id, 'title', cloud.v1_discussion_title(d), 'project', d.project_id,
            'last_message_at', cloud.v1_ts(c.at), 'state', cloud.v1_discussion_state(d))
        from cloud.discussions d
        cross join lateral (select max(m.created_at) at from cloud.discussion_messages m where m.discussion_id = d.id) c
        where d.account_id = p_account and d.workspace_id = v_ws and c.at is not null
          and (not exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id)
               or exists (select 1 from cloud.discussion_ideas i where i.discussion_id = d.id and i.state = 'open'))
      ) u
      where p_after is null or (u.at, u.id) < (v_at, p_after)
      order by u.at desc, u.id desc limit v_limit + 1
    ) x);
end;
$$;

-- ---------------------------------------------------------------------------
-- The Runner
-- ---------------------------------------------------------------------------

-- 0067's finish: a discussion's reply lands as its message and its ideas are applied; `start`
-- answers the ideas the Worker starts next.
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

  select * into d from cloud.discussions where id = v_job.discussion_id and job_id = p_job for update;
  if d.id is not null then
    if v_outcome = 'done' then
      if v_reply is not null then
        insert into cloud.discussion_messages (id, discussion_id, role, body) values (cloud.v1_id('msg'), d.id, 'agent', v_reply);
      end if;
      v_start := cloud.v1_apply_ideas(d.id, p_report -> 'ideas');
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
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer, jsonb) to service_role;
