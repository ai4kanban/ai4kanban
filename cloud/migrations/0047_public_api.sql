-- The public API (#2000): projects, workflows, tasks, checkpoints, artifacts, decisions,
-- memory, and the event feed every one of them writes to. Workspace tables are untouched.
--
-- - **Ids carry their type**: `prj_`, `wf_`, `task_`, `cp_`, `art_`, `dec_`, `mem_`, `key_`,
--   `upl_`; time-ordered, so `id > after` pages a list. An event's id is `evt_<seq>`.
-- - **Everything is the account's**: every function takes the caller's account and reads
--   nothing outside it, so another account's row answers "not found" (AKB20).
-- - **One writer per account at a time**: `cloud.v1_write` takes an advisory lock, so an
--   account's events commit in `seq` order and a reader paging `after` never skips one.
-- - **A state rule broken is AKB21**: a skipped checkpoint, a decision on nothing, a write to
--   a finished task, a name already taken.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.api_keys (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  -- What a list shows of the key; the key itself is never stored.
  prefix text not null,
  hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index api_keys_account on cloud.api_keys (account_id, id);
alter table cloud.api_keys enable row level security;

create table cloud.projects (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  path text not null default '' check (length(path) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_account on cloud.projects (account_id, id);
alter table cloud.projects enable row level security;

-- A user's own workflows. Built-in ones live in the Worker (src/v1/workflows.ts).
create table cloud.workflows (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text not null default '',
  expertise text not null default '',
  checkpoints jsonb not null default '[]',
  memory jsonb not null default '{"project": [], "user": []}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workflows_account on cloud.workflows (account_id, id);
alter table cloud.workflows enable row level security;

-- `workflow` is the definition as it stood when the task was created.
create table cloud.tasks (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  project_id text references cloud.projects (id) on delete set null,
  workflow jsonb not null,
  title text not null check (length(title) between 1 and 200),
  request text not null default '',
  source text not null check (source in ('web', 'slack', 'codex', 'api')),
  source_context jsonb not null default '{}',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'waiting_review', 'done', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_account on cloud.tasks (account_id, id);
create index tasks_project on cloud.tasks (project_id);
alter table cloud.tasks enable row level security;

create table cloud.task_checkpoints (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  task_id text not null references cloud.tasks (id) on delete cascade,
  position integer not null,
  key text not null,
  title text not null,
  definition jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'approved', 'changes_requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, position),
  unique (task_id, key)
);
alter table cloud.task_checkpoints enable row level security;

create table cloud.artifacts (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  task_id text not null references cloud.tasks (id) on delete cascade,
  checkpoint_id text references cloud.task_checkpoints (id) on delete cascade,
  type text not null check (type ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(type) <= 64),
  name text not null default '' check (length(name) <= 200),
  latest_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artifacts_task on cloud.artifacts (task_id, id);
create index artifacts_checkpoint on cloud.artifacts (checkpoint_id);
alter table cloud.artifacts enable row level security;

-- Exactly one of `content` (inline JSON) and `file` (`{ key, size, content_type }` in R2).
create table cloud.artifact_versions (
  artifact_id text not null references cloud.artifacts (id) on delete cascade,
  version integer not null,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  content jsonb,
  file jsonb,
  created_at timestamptz not null default now(),
  primary key (artifact_id, version),
  check ((content is null) <> (file is null))
);
alter table cloud.artifact_versions enable row level security;

-- A file on its way into R2. Usable once, by one version, before it expires.
create table cloud.artifact_uploads (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  artifact_id text not null references cloud.artifacts (id) on delete cascade,
  object_key text not null,
  content_type text not null,
  size bigint,
  uploaded_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table cloud.artifact_uploads enable row level security;

create table cloud.decisions (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  checkpoint_id text not null references cloud.task_checkpoints (id) on delete cascade,
  artifact_id text not null,
  artifact_version integer not null,
  decision text not null check (decision in ('approve', 'request_changes')),
  comment text not null default '',
  decided_by jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (artifact_id, artifact_version)
    references cloud.artifact_versions (artifact_id, version) on delete cascade
);
create index decisions_checkpoint on cloud.decisions (checkpoint_id, id);
alter table cloud.decisions enable row level security;

create table cloud.memories (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  scope text not null check (scope in ('project', 'user')),
  project_id text references cloud.projects (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  body text not null default '' check (octet_length(body) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'project') = (project_id is not null))
);
create unique index memories_name on cloud.memories (account_id, scope, coalesce(project_id, ''), name);
alter table cloud.memories enable row level security;

create table cloud.api_events (
  seq bigint generated always as identity primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  type text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index api_events_account on cloud.api_events (account_id, seq);
create index api_events_created on cloud.api_events (created_at);
alter table cloud.api_events enable row level security;

-- `Idempotency-Key` replays. A claim with no response is a request still running.
create table cloud.api_idempotency (
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  key text not null,
  request_hash text not null,
  status integer,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (account_id, key)
);
alter table cloud.api_idempotency enable row level security;

create function cloud.v1_immutable() returns trigger language plpgsql as $$
begin
  raise exception '% cannot be changed once written.', tg_table_name using errcode = 'AKB21';
end;
$$;
create trigger artifact_versions_immutable before update on cloud.artifact_versions
  for each row execute function cloud.v1_immutable();
create trigger decisions_immutable before update on cloud.decisions
  for each row execute function cloud.v1_immutable();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function cloud.v1_id(p_prefix text) returns text language sql volatile set search_path = '' as $$
  select p_prefix || '_' || lpad(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0')
         || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;

create function cloud.v1_ts(p timestamptz) returns text language sql stable set search_path = '' as $$
  select to_char(p at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

create function cloud.v1_limit(p_limit integer) returns integer language sql immutable set search_path = '' as $$
  select least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create function cloud.v1_missing(p_what text) returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'No % has this id.', p_what using errcode = 'AKB20';
end;
$$;

create function cloud.v1_refuse(p_message text) returns void language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_message using errcode = 'AKB21';
end;
$$;

-- Every write: one writer per account, counted against the day's budget.
create function cloud.v1_write(p_account uuid, p_daily_write_budget integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('cloud.v1:' || p_account::text, 0));
  perform cloud.count_write(p_daily_write_budget);
end;
$$;

create function cloud.v1_emit(p_account uuid, p_type text, p_data jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into cloud.api_events (account_id, type, data) values (p_account, p_type, p_data);
$$;

create function cloud.v1_task_open(p_task text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from cloud.tasks t where t.id = p_task and t.status in ('done', 'failed', 'cancelled')) then
    perform cloud.v1_refuse('This task has finished.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- What each resource reads as
-- ---------------------------------------------------------------------------

create function cloud.v1_api_key_json(k cloud.api_keys) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', k.id, 'object', 'api_key', 'name', k.name, 'prefix', k.prefix,
    'created_at', cloud.v1_ts(k.created_at));
$$;

create function cloud.v1_project_json(p cloud.projects) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'object', 'project', 'name', p.name, 'path', p.path,
    'created_at', cloud.v1_ts(p.created_at), 'updated_at', cloud.v1_ts(p.updated_at));
$$;

create function cloud.v1_workflow_json(w cloud.workflows) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', w.id, 'object', 'workflow', 'builtin', false, 'name', w.name,
    'description', w.description, 'expertise', w.expertise, 'checkpoints', w.checkpoints,
    'memory', w.memory, 'created_at', cloud.v1_ts(w.created_at), 'updated_at', cloud.v1_ts(w.updated_at));
$$;

create function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'project', t.project_id, 'workflow', t.workflow,
    'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create function cloud.v1_checkpoint_json(c cloud.task_checkpoints) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'object', 'checkpoint', 'task', c.task_id, 'position', c.position,
    'key', c.key, 'title', c.title, 'artifact_type', c.definition -> 'artifact_type',
    'question', coalesce(c.definition ->> 'question', ''), 'acceptance', coalesce(c.definition ->> 'acceptance', ''),
    'status', c.status, 'created_at', cloud.v1_ts(c.created_at), 'updated_at', cloud.v1_ts(c.updated_at));
$$;

create function cloud.v1_artifact_json(a cloud.artifacts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'artifact', 'task', a.task_id, 'checkpoint', a.checkpoint_id,
    'type', a.type, 'name', a.name, 'latest_version', nullif(a.latest_version, 0),
    'created_at', cloud.v1_ts(a.created_at), 'updated_at', cloud.v1_ts(a.updated_at));
$$;

create function cloud.v1_version_json(v cloud.artifact_versions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'artifact_version', 'artifact', v.artifact_id, 'version', v.version,
    'content', v.content,
    'file', case when v.file is null then null else jsonb_build_object(
      'size', v.file -> 'size', 'content_type', v.file -> 'content_type',
      'url', '/v1/artifacts/' || v.artifact_id || '/versions/' || v.version || '/file') end,
    'created_at', cloud.v1_ts(v.created_at));
$$;

create function cloud.v1_decision_json(d cloud.decisions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'object', 'decision', 'checkpoint', d.checkpoint_id,
    'artifact', d.artifact_id, 'artifact_version', d.artifact_version, 'decision', d.decision,
    'comment', d.comment, 'decided_by', d.decided_by, 'created_at', cloud.v1_ts(d.created_at));
$$;

create function cloud.v1_memory_json(m cloud.memories) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'object', 'memory', 'scope', m.scope, 'project', m.project_id,
    'name', m.name, 'body', m.body, 'created_at', cloud.v1_ts(m.created_at), 'updated_at', cloud.v1_ts(m.updated_at));
$$;

create function cloud.v1_event_json(e cloud.api_events) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', 'evt_' || e.seq, 'object', 'event', 'type', e.type,
    'created_at', cloud.v1_ts(e.created_at), 'data', e.data);
$$;

-- ---------------------------------------------------------------------------
-- API keys
-- ---------------------------------------------------------------------------

-- Who a key belongs to, or null for an unknown or revoked key, or an account no longer admitted.
create function api.v1_account_for_key(p_hash text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('account_id', a.id, 'handle', a.handle, 'key_id', k.id, 'key_name', k.name)
  from cloud.api_keys k
  join cloud.accounts a on a.id = k.account_id
  join cloud.admitted_accounts ad on lower(ad.handle) = lower(a.handle)
  where k.hash = p_hash and k.revoked_at is null;
$$;

create function api.v1_create_api_key(p_account uuid, p_name text, p_prefix text, p_hash text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k cloud.api_keys;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  insert into cloud.api_keys (id, account_id, name, prefix, hash)
  values (cloud.v1_id('key'), p_account, p_name, p_prefix, p_hash) returning * into k;
  return cloud.v1_api_key_json(k);
end;
$$;

create function api.v1_list_api_keys(p_account uuid, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select k.id, cloud.v1_api_key_json(k) j, row_number() over (order by k.id) n
    from cloud.api_keys k
    where k.account_id = p_account and k.revoked_at is null and (p_after is null or k.id > p_after)
    order by k.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create function api.v1_revoke_api_key(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k cloud.api_keys;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.api_keys set revoked_at = now()
  where id = p_id and account_id = p_account and revoked_at is null returning * into k;
  if not found then perform cloud.v1_missing('API key'); end if;
  return cloud.v1_api_key_json(k) || jsonb_build_object('revoked', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create function api.v1_list_projects(p_account uuid, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select p.id, cloud.v1_project_json(p) j, row_number() over (order by p.id) n
    from cloud.projects p
    where p.account_id = p_account and (p_after is null or p.id > p_after)
    order by p.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create function api.v1_project(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  select * into p from cloud.projects where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('project'); end if;
  return cloud.v1_project_json(p);
end;
$$;

create function api.v1_create_project(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  insert into cloud.projects (id, account_id, name, path)
  values (cloud.v1_id('prj'), p_account, p_fields ->> 'name', coalesce(p_fields ->> 'path', ''))
  returning * into p;
  perform cloud.v1_emit(p_account, 'project.created', cloud.v1_project_json(p));
  return cloud.v1_project_json(p);
end;
$$;

create function api.v1_update_project(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.projects set
    name = coalesce(p_fields ->> 'name', name),
    path = coalesce(p_fields ->> 'path', path),
    updated_at = now()
  where id = p_id and account_id = p_account returning * into p;
  if not found then perform cloud.v1_missing('project'); end if;
  perform cloud.v1_emit(p_account, 'project.updated', cloud.v1_project_json(p));
  return cloud.v1_project_json(p);
end;
$$;

-- Its memory goes with it; its tasks stay, belonging to no project.
create function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  m cloud.memories;
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('project'); end if;
  for m in delete from cloud.memories where project_id = p_id returning * loop
    perform cloud.v1_emit(p_account, 'memory.deleted', cloud.v1_memory_json(m));
  end loop;
  for t in update cloud.tasks set project_id = null, updated_at = now() where project_id = p_id returning * loop
    perform cloud.v1_emit(p_account, 'task.updated', cloud.v1_task_json(t));
  end loop;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(p_account, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

create function api.v1_list_workflows(p_account uuid, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select w.id, cloud.v1_workflow_json(w) j, row_number() over (order by w.id) n
    from cloud.workflows w
    where w.account_id = p_account and (p_after is null or w.id > p_after)
    order by w.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create function api.v1_workflow(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  select * into w from cloud.workflows where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('workflow'); end if;
  return cloud.v1_workflow_json(w);
end;
$$;

create function api.v1_create_workflow(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  insert into cloud.workflows (id, account_id, name, description, expertise, checkpoints, memory)
  values (cloud.v1_id('wf'), p_account, p_fields ->> 'name', coalesce(p_fields ->> 'description', ''),
          coalesce(p_fields ->> 'expertise', ''), coalesce(p_fields -> 'checkpoints', '[]'),
          coalesce(p_fields -> 'memory', '{"project": [], "user": []}'))
  returning * into w;
  perform cloud.v1_emit(p_account, 'workflow.created', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create function api.v1_update_workflow(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.workflows set
    name = coalesce(p_fields ->> 'name', name),
    description = coalesce(p_fields ->> 'description', description),
    expertise = coalesce(p_fields ->> 'expertise', expertise),
    checkpoints = coalesce(p_fields -> 'checkpoints', checkpoints),
    memory = coalesce(p_fields -> 'memory', memory),
    updated_at = now()
  where id = p_id and account_id = p_account returning * into w;
  if not found then perform cloud.v1_missing('workflow'); end if;
  perform cloud.v1_emit(p_account, 'workflow.updated', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create function api.v1_delete_workflow(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  delete from cloud.workflows where id = p_id and account_id = p_account returning * into w;
  if not found then perform cloud.v1_missing('workflow'); end if;
  perform cloud.v1_emit(p_account, 'workflow.deleted', cloud.v1_workflow_json(w));
  return jsonb_build_object('id', w.id, 'object', 'workflow', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks and checkpoints
-- ---------------------------------------------------------------------------

-- `p_workflow` is the definition the Worker resolved, built-in or the account's own.
create function api.v1_create_task(p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_project text := p_fields ->> 'project';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if v_project is not null and not exists (
    select 1 from cloud.projects where id = v_project and account_id = p_account
  ) then
    perform cloud.v1_missing('project');
  end if;
  insert into cloud.tasks (id, account_id, project_id, workflow, title, request, source, source_context)
  values (cloud.v1_id('task'), p_account, v_project, p_workflow, p_fields ->> 'title',
          coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'))
  returning * into t;
  insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition)
  select cloud.v1_id('cp'), p_account, t.id, c.n::integer, c.def ->> 'key', c.def ->> 'title', c.def
  from jsonb_array_elements(coalesce(p_workflow -> 'checkpoints', '[]')) with ordinality as c(def, n);
  perform cloud.v1_emit(p_account, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

create function api.v1_list_tasks(p_account uuid, p_project text, p_status text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select t.id, cloud.v1_task_json(t) j, row_number() over (order by t.id) n
    from cloud.tasks t
    where t.account_id = p_account and (p_after is null or t.id > p_after)
      and (p_project is null or t.project_id = p_project) and (p_status is null or t.status = p_status)
    order by t.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create function api.v1_task(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('task'); end if;
  return cloud.v1_task_json(t);
end;
$$;

-- Status and title only. A finished task stays finished; `done` needs every checkpoint approved.
create function api.v1_update_task(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_status text := p_fields ->> 'status';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_id);
  if v_status = 'done' and exists (
    select 1 from cloud.task_checkpoints where task_id = p_id and status <> 'approved'
  ) then
    perform cloud.v1_refuse('Every checkpoint must be approved before the task is done.');
  end if;
  update cloud.tasks set
    title = coalesce(p_fields ->> 'title', title),
    status = coalesce(v_status, status),
    updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(p_account, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

create function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_id);
  update cloud.tasks set status = 'cancelled', updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(p_account, 'task.cancelled', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

create function api.v1_list_checkpoints(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.tasks where id = p_task and account_id = p_account) then
    perform cloud.v1_missing('task');
  end if;
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_checkpoint_json(c) order by c.position)
    from cloud.task_checkpoints c where c.task_id = p_task), '[]'), 'next', null);
end;
$$;

create function api.v1_checkpoint(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
begin
  select * into c from cloud.task_checkpoints where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  return cloud.v1_checkpoint_json(c);
end;
$$;

-- ---------------------------------------------------------------------------
-- Artifacts
-- ---------------------------------------------------------------------------

create function api.v1_create_artifact(p_account uuid, p_task text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  v_checkpoint text := p_fields ->> 'checkpoint';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if not exists (select 1 from cloud.tasks where id = p_task and account_id = p_account) then
    perform cloud.v1_missing('task');
  end if;
  perform cloud.v1_task_open(p_task);
  if v_checkpoint is not null and not exists (
    select 1 from cloud.task_checkpoints where id = v_checkpoint and task_id = p_task
  ) then
    perform cloud.v1_missing('checkpoint');
  end if;
  insert into cloud.artifacts (id, account_id, task_id, checkpoint_id, type, name)
  values (cloud.v1_id('art'), p_account, p_task, v_checkpoint, p_fields ->> 'type', coalesce(p_fields ->> 'name', ''))
  returning * into a;
  perform cloud.v1_emit(p_account, 'artifact.created', cloud.v1_artifact_json(a));
  return cloud.v1_artifact_json(a);
end;
$$;

create function api.v1_list_artifacts(p_account uuid, p_task text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.tasks where id = p_task and account_id = p_account) then
    perform cloud.v1_missing('task');
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select a.id, cloud.v1_artifact_json(a) j, row_number() over (order by a.id) n
      from cloud.artifacts a
      where a.task_id = p_task and (p_after is null or a.id > p_after)
      order by a.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

create function api.v1_artifact(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a cloud.artifacts;
begin
  select * into a from cloud.artifacts where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('artifact'); end if;
  return cloud.v1_artifact_json(a);
end;
$$;

-- A new version. On a checkpoint it must be the task's current one, and it becomes `ready`.
create function api.v1_create_artifact_version(
  p_account uuid, p_artifact text, p_content jsonb, p_upload text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  c cloud.task_checkpoints;
  u cloud.artifact_uploads;
  v cloud.artifact_versions;
  v_file jsonb;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact and account_id = p_account for update;
  if not found then perform cloud.v1_missing('artifact'); end if;
  perform cloud.v1_task_open(a.task_id);

  if a.checkpoint_id is not null then
    select * into c from cloud.task_checkpoints where id = a.checkpoint_id for update;
    if c.status = 'approved' then
      perform cloud.v1_refuse('This checkpoint is already approved.');
    end if;
    if exists (
      select 1 from cloud.task_checkpoints e
      where e.task_id = c.task_id and e.position < c.position and e.status <> 'approved'
    ) then
      perform cloud.v1_refuse('An earlier checkpoint is not approved yet.');
    end if;
  end if;

  if p_upload is not null then
    update cloud.artifact_uploads set used_at = now()
    where id = p_upload and artifact_id = p_artifact and uploaded_at is not null and used_at is null
    returning * into u;
    if not found then perform cloud.v1_refuse('That upload is unfinished, or already used.'); end if;
    v_file := jsonb_build_object('key', u.object_key, 'size', u.size, 'content_type', u.content_type);
  end if;

  insert into cloud.artifact_versions (artifact_id, version, account_id, content, file)
  values (a.id, a.latest_version + 1, p_account, case when v_file is null then p_content end, v_file)
  returning * into v;
  update cloud.artifacts set latest_version = v.version, updated_at = now() where id = a.id;
  perform cloud.v1_emit(p_account, 'artifact.version_created', cloud.v1_version_json(v));

  if c.id is not null and c.status <> 'ready' then
    update cloud.task_checkpoints set status = 'ready', updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(p_account, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_version_json(v);
end;
$$;

create function api.v1_artifact_version(p_account uuid, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.artifact_versions;
begin
  select * into v from cloud.artifact_versions
  where artifact_id = p_artifact and version = p_version and account_id = p_account;
  if not found then perform cloud.v1_missing('artifact version'); end if;
  -- `stored` is the Worker's alone: where the file sits in R2.
  return cloud.v1_version_json(v) || jsonb_build_object('stored', v.file);
end;
$$;

create function api.v1_create_upload(
  p_account uuid, p_artifact text, p_content_type text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  u cloud.artifact_uploads;
  v_id text := cloud.v1_id('upl');
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact and account_id = p_account;
  if not found then perform cloud.v1_missing('artifact'); end if;
  perform cloud.v1_task_open(a.task_id);
  insert into cloud.artifact_uploads (id, account_id, artifact_id, object_key, content_type, expires_at)
  values (v_id, p_account, a.id, 'artifacts/' || p_account || '/' || a.id || '/' || v_id, p_content_type,
          now() + interval '1 hour')
  returning * into u;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'method', 'PUT',
    'url', '/v1/uploads/' || u.id, 'content_type', u.content_type, 'expires_at', cloud.v1_ts(u.expires_at));
end;
$$;

-- Where an upload goes, while it can still be sent; null otherwise.
create function api.v1_upload_target(p_account uuid, p_upload text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('key', u.object_key, 'content_type', u.content_type)
  from cloud.artifact_uploads u
  where u.id = p_upload and u.account_id = p_account and u.uploaded_at is null and u.expires_at > now();
$$;

create function api.v1_finish_upload(p_account uuid, p_upload text, p_size bigint, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u cloud.artifact_uploads;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.artifact_uploads set size = p_size, uploaded_at = now()
  where id = p_upload and account_id = p_account and uploaded_at is null and expires_at > now()
  returning * into u;
  if not found then perform cloud.v1_missing('upload'); end if;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'size', u.size,
    'content_type', u.content_type, 'uploaded', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------

-- The latest decision sets the checkpoint's status. One on a checkpoint nothing was
-- submitted to, or behind a later checkpoint that has moved on, is refused.
create function api.v1_create_decision(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_status text;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account for update;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  perform cloud.v1_task_open(c.task_id);
  if c.status = 'pending' then
    perform cloud.v1_refuse('Nothing has been submitted to this checkpoint yet.');
  end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position > c.position and e.status <> 'pending'
  ) then
    perform cloud.v1_refuse('A later checkpoint has already moved on.');
  end if;

  if v_artifact is null then
    select v.artifact_id, v.version into v_artifact, v_version
    from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where a.checkpoint_id = c.id order by v.created_at desc, v.version desc limit 1;
  elsif v_version is null then
    select a.latest_version into v_version from cloud.artifacts a where a.id = v_artifact and a.checkpoint_id = c.id;
  end if;
  if not exists (
    select 1 from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where v.artifact_id = v_artifact and v.version = v_version and a.checkpoint_id = c.id
  ) then
    perform cloud.v1_missing('artifact version on this checkpoint');
  end if;

  insert into cloud.decisions (id, account_id, checkpoint_id, artifact_id, artifact_version, decision, comment, decided_by)
  values (cloud.v1_id('dec'), p_account, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor)
  returning * into d;
  perform cloud.v1_emit(p_account, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(p_account, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

create function api.v1_list_decisions(p_account uuid, p_checkpoint text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account) then
    perform cloud.v1_missing('checkpoint');
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select d.id, cloud.v1_decision_json(d) j, row_number() over (order by d.id) n
      from cloud.decisions d
      where d.checkpoint_id = p_checkpoint and (p_after is null or d.id > p_after)
      order by d.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

-- ---------------------------------------------------------------------------
-- Memory
-- ---------------------------------------------------------------------------

-- `p_task` narrows to what that task may read: user memory, and its own project's.
create function api.v1_list_memories(
  p_account uuid, p_scope text, p_project text, p_task text, p_after text, p_limit integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_task_project text;
begin
  if p_task is not null then
    select project_id into v_task_project from cloud.tasks where id = p_task and account_id = p_account;
    if not found then perform cloud.v1_missing('task'); end if;
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select m.id, cloud.v1_memory_json(m) j, row_number() over (order by m.id) n
      from cloud.memories m
      where m.account_id = p_account and (p_after is null or m.id > p_after)
        and (p_scope is null or m.scope = p_scope)
        and (p_project is null or m.project_id = p_project)
        and (p_task is null or m.scope = 'user' or m.project_id = v_task_project)
      order by m.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

create function api.v1_memory(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m cloud.memories;
begin
  select * into m from cloud.memories where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('memory'); end if;
  return cloud.v1_memory_json(m);
end;
$$;

create function api.v1_create_memory(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
  v_project text := case when p_fields ->> 'scope' = 'project' then p_fields ->> 'project' end;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if v_project is not null and not exists (
    select 1 from cloud.projects where id = v_project and account_id = p_account
  ) then
    perform cloud.v1_missing('project');
  end if;
  begin
    insert into cloud.memories (id, account_id, scope, project_id, name, body)
    values (cloud.v1_id('mem'), p_account, p_fields ->> 'scope', v_project, p_fields ->> 'name',
            coalesce(p_fields ->> 'body', ''))
    returning * into m;
  exception when unique_violation then
    perform cloud.v1_refuse('A memory with this name already exists here.');
  end;
  perform cloud.v1_emit(p_account, 'memory.updated', cloud.v1_memory_json(m));
  return cloud.v1_memory_json(m);
end;
$$;

create function api.v1_update_memory(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  begin
    update cloud.memories set
      name = coalesce(p_fields ->> 'name', name),
      body = coalesce(p_fields ->> 'body', body),
      updated_at = now()
    where id = p_id and account_id = p_account returning * into m;
  exception when unique_violation then
    perform cloud.v1_refuse('A memory with this name already exists here.');
  end;
  if m.id is null then perform cloud.v1_missing('memory'); end if;
  perform cloud.v1_emit(p_account, 'memory.updated', cloud.v1_memory_json(m));
  return cloud.v1_memory_json(m);
end;
$$;

create function api.v1_delete_memory(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  delete from cloud.memories where id = p_id and account_id = p_account returning * into m;
  if not found then perform cloud.v1_missing('memory'); end if;
  perform cloud.v1_emit(p_account, 'memory.deleted', cloud.v1_memory_json(m));
  return jsonb_build_object('id', m.id, 'object', 'memory', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create function api.v1_list_events(p_account uuid, p_after bigint, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.seq) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit)
      then 'evt_' || max(x.seq) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select e.seq, cloud.v1_event_json(e) j, row_number() over (order by e.seq) n
    from cloud.api_events e
    where e.account_id = p_account and e.seq > coalesce(p_after, 0)
    order by e.seq limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

-- The hourly run: events past 30 days, replays past a day, uploads never finished.
create function api.v1_sweep() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_events integer;
  v_replays integer;
  v_uploads integer;
begin
  delete from cloud.api_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from cloud.api_idempotency where created_at < now() - interval '1 day';
  get diagnostics v_replays = row_count;
  delete from cloud.artifact_uploads where used_at is null and expires_at < now() - interval '1 day';
  get diagnostics v_uploads = row_count;
  return jsonb_build_object('events', v_events, 'replays', v_replays, 'uploads', v_uploads);
end;
$$;

-- ---------------------------------------------------------------------------
-- Idempotency-Key
-- ---------------------------------------------------------------------------

-- Claims the key for this request, or answers what holds it. A claim left by a request
-- that never finished is taken over after a minute.
create function api.v1_claim_idempotency(p_account uuid, p_key text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r cloud.api_idempotency;
begin
  insert into cloud.api_idempotency (account_id, key, request_hash) values (p_account, p_key, p_hash)
  on conflict (account_id, key) do update set request_hash = excluded.request_hash, created_at = now()
    where cloud.api_idempotency.status is null and cloud.api_idempotency.created_at < now() - interval '1 minute'
  returning * into r;
  if found then return jsonb_build_object('claimed', true); end if;
  select * into r from cloud.api_idempotency where account_id = p_account and key = p_key;
  return jsonb_build_object('claimed', false, 'request_hash', r.request_hash, 'status', r.status, 'response', r.response);
end;
$$;

create function api.v1_finish_idempotency(p_account uuid, p_key text, p_status integer, p_response jsonb)
returns void language sql security definer set search_path = '' as $$
  update cloud.api_idempotency set status = p_status, response = p_response
  where account_id = p_account and key = p_key;
$$;

create function api.v1_release_idempotency(p_account uuid, p_key text)
returns void language sql security definer set search_path = '' as $$
  delete from cloud.api_idempotency where account_id = p_account and key = p_key and status is null;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

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
