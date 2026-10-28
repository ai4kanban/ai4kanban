-- Rejection reasons, triage and dismissals kept in Cloud (#2067), for the rejection review a
-- Runner runs before planning a task.
--
-- - **A rejection is a cancel with a reason**: only those are learned from.
-- - **A triage item belongs to a project**: the workspace's inbox without one. The same title
--   from the same task in the same project is kept once.
-- - **`reviewed`**: null has nothing to learn; false waits for the review — a dismissal, or a
--   restore that withdraws one; true was learned.

alter table cloud.tasks
  add column cancel_reason text check (length(cancel_reason) between 1 and 2000),
  add column cancelled_by uuid references cloud.accounts (id) on delete set null,
  add column cancel_reviewed boolean;
create index tasks_rejections on cloud.tasks (workspace_id) where cancel_reviewed = false;

create table cloud.triage_items (
  id text primary key,
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  project_id text not null references cloud.projects (id) on delete cascade,
  created_by uuid references cloud.accounts (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  body text not null default '' check (octet_length(body) <= 65536),
  -- The task that proposed it; not a reference, so a task deleted later leaves it as it was.
  source_task text,
  state text not null default 'open' check (state in ('open', 'dismissed', 'carded')),
  dismissed_reason text check (length(dismissed_reason) between 1 and 2000),
  dismissed_by uuid references cloud.accounts (id) on delete set null,
  dismissed_at timestamptz,
  task_id text references cloud.tasks (id) on delete set null,
  reviewed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index triage_items_once on cloud.triage_items (project_id, coalesce(source_task, ''), title);
create index triage_items_workspace on cloud.triage_items (workspace_id, id);
create index triage_items_rejections on cloud.triage_items (workspace_id) where reviewed = false;
alter table cloud.triage_items enable row level security;

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
    'cancel_reason', t.cancel_reason,
    'cancelled_by', (select a.handle from cloud.accounts a where a.id = t.cancelled_by),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create function cloud.v1_triage_json(i cloud.triage_items) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'object', 'triage', 'workspace', i.workspace_id, 'project', i.project_id,
    'title', i.title, 'text', i.body, 'source_task', i.source_task, 'state', i.state,
    'dismissed_reason', i.dismissed_reason,
    'dismissed_by', (select a.handle from cloud.accounts a where a.id = i.dismissed_by),
    'dismissed_at', cloud.v1_ts(i.dismissed_at),
    'task', i.task_id,
    'created_by', (select a.handle from cloud.accounts a where a.id = i.created_by),
    'created_at', cloud.v1_ts(i.created_at), 'updated_at', cloud.v1_ts(i.updated_at));
$$;

-- An item in a workspace the caller is in, held for the write.
create function cloud.v1_triage_item(p_account uuid, p_id text) returns cloud.triage_items
language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
begin
  select * into i from cloud.triage_items where id = p_id;
  if i.id is null or not cloud.v1_in(p_account, i.workspace_id) then perform cloud.v1_missing('triage item'); end if;
  return i;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- 0059's cancel, with the reason a rejection is learned from.
drop function api.v1_cancel_task(uuid, text, integer);
create function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  if (cloud.v1_flow_job(p_id)).state = 'claimed' then
    raise exception 'A running task cannot be cancelled.' using errcode = 'AKB26', detail = 'task_running';
  end if;
  update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'Cancelled.', finished_at = now(),
    updated_at = now()
  where task_id = p_id and state = 'waiting';
  for h in
    update cloud.task_chats c set job_id = null, failure = 'failed', updated_at = now()
     where c.task_id = p_id and c.job_id in (select j.id from cloud.runner_jobs j where j.task_id = p_id and j.reason = 'Cancelled.')
    returning c.*
  loop
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
  update cloud.tasks set status = 'cancelled', cancel_reason = v_reason, cancelled_by = p_account,
    cancel_reviewed = case when v_reason is not null then false end, updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.cancelled', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- 0065's create; `triage` names an open item it is made of, which also gives the project.
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
  if i.id is not null then
    update cloud.triage_items set state = 'carded', task_id = t.id, updated_at = now() where id = i.id returning * into i;
    perform cloud.v1_emit(v_ws, 'triage.updated', cloud.v1_triage_json(i));
  end if;
  return cloud.v1_task_json(t);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triage
-- ---------------------------------------------------------------------------

create function api.v1_list_triage(p_account uuid, p_workspace text, p_project text, p_state text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select i.id, cloud.v1_triage_json(i) j, row_number() over (order by i.id) n
    from cloud.triage_items i
    where i.workspace_id = cloud.v1_target(p_account, p_workspace, p_project) and (p_after is null or i.id > p_after)
      and (p_project is null or i.project_id = p_project) and (p_state is null or i.state = p_state)
    order by i.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

-- One proposal; the same title from the same task in the same project answers the one kept.
create function api.v1_create_triage(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  v_source text := p_fields ->> 'source_task';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if v_source is not null then perform cloud.v1_workspace_of(p_account, 'task', v_source); end if;
  v_project := coalesce(v_project, cloud.v1_inbox(v_ws));
  insert into cloud.triage_items (id, workspace_id, project_id, created_by, title, body, source_task)
  values (cloud.v1_id('tri'), v_ws, v_project, p_account, p_fields ->> 'title', coalesce(p_fields ->> 'text', ''), v_source)
  on conflict (project_id, (coalesce(source_task, '')), title) do nothing
  returning * into i;
  if i.id is null then
    select * into i from cloud.triage_items x
     where x.project_id = v_project and coalesce(x.source_task, '') = coalesce(v_source, '') and x.title = p_fields ->> 'title';
    return cloud.v1_triage_json(i);
  end if;
  perform cloud.v1_emit(v_ws, 'triage.created', cloud.v1_triage_json(i));
  return cloud.v1_triage_json(i);
end;
$$;

-- Dismissing a dismissed item again rewrites its reason, to be learned afresh.
create function api.v1_dismiss_triage(p_account uuid, p_id text, p_reason text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items := cloud.v1_triage_item(p_account, p_id);
begin
  perform cloud.v1_write(p_account, i.workspace_id, p_daily_write_budget);
  select * into i from cloud.triage_items where id = p_id for update;
  if i.state = 'carded' then perform cloud.v1_refuse('A task was already made of this triage item.'); end if;
  update cloud.triage_items set state = 'dismissed', dismissed_reason = nullif(btrim(p_reason), ''),
    dismissed_by = p_account, dismissed_at = now(), reviewed = false, updated_at = now()
  where id = p_id returning * into i;
  perform cloud.v1_emit(i.workspace_id, 'triage.updated', cloud.v1_triage_json(i));
  return cloud.v1_triage_json(i);
end;
$$;

-- Back to open; a dismissal already learned is withdrawn at the next review.
create function api.v1_restore_triage(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items := cloud.v1_triage_item(p_account, p_id);
begin
  perform cloud.v1_write(p_account, i.workspace_id, p_daily_write_budget);
  select * into i from cloud.triage_items where id = p_id for update;
  if i.state <> 'dismissed' then perform cloud.v1_refuse('This triage item is not dismissed.'); end if;
  update cloud.triage_items set state = 'open', dismissed_reason = null, dismissed_by = null, dismissed_at = null,
    reviewed = false, updated_at = now()
  where id = p_id returning * into i;
  perform cloud.v1_emit(i.workspace_id, 'triage.updated', cloud.v1_triage_json(i));
  return cloud.v1_triage_json(i);
end;
$$;

-- ---------------------------------------------------------------------------
-- The rejection review
-- ---------------------------------------------------------------------------

-- What the review has not learned yet, oldest first: rejected tasks, and triage items
-- dismissed or restored since.
create function api.v1_list_rejections(p_account uuid, p_workspace text)
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
      order by t.updated_at, t.id limit 100) x), '[]'),
    'triage', coalesce((select jsonb_agg(x.j order by x.at, x.id) from (
      select i.id, i.updated_at at, cloud.v1_triage_json(i) j
      from cloud.triage_items i where i.workspace_id = v_ws and i.reviewed = false
      order by i.updated_at, i.id limit 100) x), '[]'));
end;
$$;

-- Learned: these leave the list until rejected, dismissed or restored again.
create function api.v1_rejections_reviewed(p_account uuid, p_tasks text[], p_triage text[], p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text;
  v_tasks integer;
  v_triage integer;
begin
  perform cloud.count_write(p_daily_write_budget);
  for v_ws in
    select distinct x.ws from (
      select t.workspace_id ws from cloud.tasks t where t.id = any(coalesce(p_tasks, '{}'))
      union select i.workspace_id from cloud.triage_items i where i.id = any(coalesce(p_triage, '{}'))
    ) x where cloud.v1_in(p_account, x.ws) order by 1
  loop
    perform cloud.v1_lock(v_ws);
  end loop;
  update cloud.tasks t set cancel_reviewed = true
   where t.id = any(coalesce(p_tasks, '{}')) and t.cancel_reviewed = false and cloud.v1_in(p_account, t.workspace_id);
  get diagnostics v_tasks = row_count;
  update cloud.triage_items i set reviewed = true
   where i.id = any(coalesce(p_triage, '{}')) and i.reviewed = false and cloud.v1_in(p_account, i.workspace_id);
  get diagnostics v_triage = row_count;
  return jsonb_build_object('tasks', v_tasks, 'triage', v_triage);
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
