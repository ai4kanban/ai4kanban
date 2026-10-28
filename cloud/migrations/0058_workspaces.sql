-- Workspaces (#2045): projects, workflows, tasks and memory belong to a workspace, and a
-- workspace's members are its Owners and Members. The board-sharing tables of #314 are older
-- and unrelated; these are `cloud.v1_workspaces` and `cloud.v1_workspace_members`.
--
-- - **Everyone has a personal workspace**: made with the account, holding what the account
--   had before. It takes no other members, cannot be left or deleted, and alone has an inbox.
-- - **Access is membership**: a resource in a workspace the caller is not in answers "not
--   found" (AKB20), the moment they leave. Owner-only moves raise AKB14.
-- - **The creator pays**: a workspace's usage counts against `v1_workspaces.account_id`'s plan.
--   The creator stays an Owner and cannot leave; deleting is how it ends.
-- - **A task runs on its creator's Runner**: `tasks.account_id` is who started it, and alerts
--   go to them alone.
-- - **One writer per workspace**: a write locks its workspace, then every member's account in
--   order, so each account's events commit in `seq` order across all its workspaces.
-- - **Memory is the workspace's or a project's**: scope `user` becomes `workspace`.
-- - **A task's files**: what was `v1_commit_workspace` is `v1_commit_files`.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.v1_workspaces (
  id text primary key,
  -- The creator, whose plan the workspace's usage counts against.
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index v1_workspaces_personal on cloud.v1_workspaces (account_id) where personal;
alter table cloud.v1_workspaces enable row level security;

create table cloud.v1_workspace_members (
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, account_id)
);
create index v1_workspace_members_account on cloud.v1_workspace_members (account_id);
alter table cloud.v1_workspace_members enable row level security;

create function cloud.v1_add_personal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := cloud.v1_id('ws');
begin
  insert into cloud.v1_workspaces (id, account_id, name, personal)
  values (v_id, new.id, coalesce(nullif(btrim(new.name), ''), new.handle), true);
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_id, new.id, 'owner');
  return null;
end;
$$;
create trigger accounts_personal after insert on cloud.accounts
  for each row execute function cloud.v1_add_personal();

do $backfill$
declare
  a cloud.accounts;
  v_id text;
begin
  for a in select * from cloud.accounts loop
    v_id := cloud.v1_id('ws');
    insert into cloud.v1_workspaces (id, account_id, name, personal)
    values (v_id, a.id, coalesce(nullif(btrim(a.name), ''), a.handle), true);
    insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_id, a.id, 'owner');
  end loop;
end
$backfill$;

-- Everything the account had moves into its personal workspace.
alter table cloud.projects add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.workflows add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.workflow_versions add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.tasks add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.memories add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.task_aliases add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;
alter table cloud.api_events add column workspace_id text references cloud.v1_workspaces (id) on delete cascade;

update cloud.projects x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.workflows x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.workflow_versions x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.tasks x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.memories x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.task_aliases x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;
update cloud.api_events x set workspace_id = w.id from cloud.v1_workspaces w where w.personal and w.account_id = x.account_id;

alter table cloud.projects alter column workspace_id set not null;
alter table cloud.workflows alter column workspace_id set not null;
alter table cloud.tasks alter column workspace_id set not null;
alter table cloud.memories alter column workspace_id set not null;
alter table cloud.task_aliases alter column workspace_id set not null;
alter table cloud.api_events alter column workspace_id set not null;
alter table cloud.workflow_versions add check ((account_id is null) = (workspace_id is null));

create index projects_workspace on cloud.projects (workspace_id, id);
create index workflows_workspace on cloud.workflows (workspace_id, id);
create index tasks_workspace on cloud.tasks (workspace_id, id);
create index memories_workspace on cloud.memories (workspace_id, id);

drop index cloud.projects_prefix_unique;
drop index cloud.projects_one_inbox;
create unique index projects_prefix_unique on cloud.projects (workspace_id, prefix);
create unique index projects_one_inbox on cloud.projects (workspace_id) where inbox;

alter table cloud.task_aliases drop constraint task_aliases_pkey, add primary key (workspace_id, prefix, number);

-- `user` memory is the personal workspace's.
alter table cloud.memories drop constraint memories_scope_check;
update cloud.memories set scope = 'workspace' where scope = 'user';
alter table cloud.memories add constraint memories_scope_check check (scope in ('workspace', 'project'));
drop index cloud.memories_name;
create unique index memories_name on cloud.memories (workspace_id, scope, coalesce(project_id, ''), name);

-- An event is the workspace's; one with `account_id` is that member's alone (an alert).
alter table cloud.api_events alter column account_id drop not null;
update cloud.api_events set account_id = null where type not like 'alert.%';
create index api_events_workspace on cloud.api_events (workspace_id, seq);

-- ---------------------------------------------------------------------------
-- Membership, locks and events
-- ---------------------------------------------------------------------------

create function cloud.v1_role(p_account uuid, p_workspace text) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from cloud.v1_workspace_members m where m.workspace_id = p_workspace and m.account_id = p_account;
$$;

create function cloud.v1_in(p_account uuid, p_workspace text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cloud.v1_workspace_members m where m.workspace_id = p_workspace and m.account_id = p_account);
$$;

create function cloud.v1_personal(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select w.id from cloud.v1_workspaces w where w.account_id = p_account and w.personal;
$$;

create function cloud.v1_require_owner(p_account uuid, p_workspace text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if cloud.v1_role(p_account, p_workspace) is distinct from 'owner' then
    raise exception 'Only an owner of this workspace can do this.' using errcode = 'AKB14';
  end if;
end;
$$;

create function cloud.v1_payer_of(p_workspace text) returns uuid
language sql stable security definer set search_path = '' as $$
  select w.account_id from cloud.v1_workspaces w where w.id = p_workspace;
$$;

create function cloud.v1_task_workspace(p_task text) returns text
language sql stable security definer set search_path = '' as $$
  select t.workspace_id from cloud.tasks t where t.id = p_task;
$$;

-- The workspace a resource is in, when the caller is a member of it; "not found" otherwise.
create function cloud.v1_workspace_of(p_account uuid, p_kind text, p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  v := case p_kind
    when 'workspace' then (select w.id from cloud.v1_workspaces w where w.id = p_id)
    when 'project' then (select p.workspace_id from cloud.projects p where p.id = p_id)
    when 'workflow' then (select w.workspace_id from cloud.workflows w where w.id = p_id)
    when 'task' then cloud.v1_task_workspace(p_id)
    when 'memory' then (select m.workspace_id from cloud.memories m where m.id = p_id)
    when 'checkpoint' then (select cloud.v1_task_workspace(c.task_id) from cloud.task_checkpoints c where c.id = p_id)
    when 'artifact' then (select cloud.v1_task_workspace(a.task_id) from cloud.artifacts a where a.id = p_id)
    when 'upload' then (select cloud.v1_task_workspace(a.task_id)
                          from cloud.artifact_uploads u join cloud.artifacts a on a.id = u.artifact_id where u.id = p_id)
    when 'share link' then (select cloud.v1_task_workspace(c.task_id)
                              from cloud.share_links l join cloud.task_checkpoints c on c.id = l.checkpoint_id where l.id = p_id)
  end;
  if v is null or not cloud.v1_in(p_account, v) then perform cloud.v1_missing(p_kind); end if;
  return v;
end;
$$;

-- The workspace a list or a create is about: the one named, else the project's, else the
-- caller's personal one.
create function cloud.v1_target(p_account uuid, p_workspace text, p_project text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  if p_project is not null then
    v := cloud.v1_workspace_of(p_account, 'project', p_project);
    if p_workspace is not null and p_workspace <> v then perform cloud.v1_missing('project'); end if;
    return v;
  end if;
  if p_workspace is not null then return cloud.v1_workspace_of(p_account, 'workspace', p_workspace); end if;
  return cloud.v1_personal(p_account);
end;
$$;

-- Holds the workspace and every member's account (and one joining) until commit.
create function cloud.v1_lock(p_workspace text, p_joining uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('cloud.v1.ws:' || p_workspace, 0));
  for a in
    select m.account_id from cloud.v1_workspace_members m where m.workspace_id = p_workspace
    union select p_joining where p_joining is not null
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('cloud.v1:' || a::text, 0));
  end loop;
end;
$$;

-- A write in a workspace: locked, still a member once locked, counted.
create function cloud.v1_write(p_account uuid, p_workspace text, p_daily_write_budget integer, p_joining uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_lock(p_workspace, p_joining);
  if not cloud.v1_in(p_account, p_workspace) then perform cloud.v1_missing('workspace'); end if;
  perform cloud.count_write(p_daily_write_budget);
end;
$$;

drop function cloud.v1_emit(uuid, text, jsonb);
create function cloud.v1_emit(p_workspace text, p_type text, p_data jsonb, p_to uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into cloud.api_events (workspace_id, account_id, type, data) values (p_workspace, p_to, p_type, p_data);
$$;

-- Whose streams a write wakes: the workspace's members, or everyone sharing one with the account.
create function api.v1_audience(p_account uuid, p_workspace text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct m.account_id), '[]')
  from cloud.v1_workspace_members m
  where m.workspace_id = p_workspace
     or (p_workspace is null and m.workspace_id in (
       select x.workspace_id from cloud.v1_workspace_members x where x.account_id = p_account));
$$;

-- The account whose plan a resource's usage counts against.
create function api.v1_payer(p_account uuid, p_kind text, p_id text) returns uuid
language sql stable security definer set search_path = '' as $$
  select cloud.v1_payer_of(case when p_kind = 'target' then cloud.v1_target(p_account, p_id, null)
                               else cloud.v1_workspace_of(p_account, p_kind, p_id) end);
$$;

-- ---------------------------------------------------------------------------
-- What each resource reads as
-- ---------------------------------------------------------------------------

create function cloud.v1_workspace_json(w cloud.v1_workspaces, p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', w.id, 'object', 'workspace', 'name', w.name, 'personal', w.personal,
    'role', cloud.v1_role(p_account, w.id), 'created_at', cloud.v1_ts(w.created_at), 'updated_at', cloud.v1_ts(w.updated_at));
$$;

-- The address an account signs in with, whichever provider it came through.
create function cloud.v1_email(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select lower(i.identity_data ->> 'email') from auth.identities i
  where i.user_id = p_account and nullif(i.identity_data ->> 'email', '') is not null
  order by i.last_sign_in_at desc nulls last limit 1;
$$;

create function cloud.v1_member_json(m cloud.v1_workspace_members) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('object', 'workspace_member', 'workspace', m.workspace_id, 'account', m.account_id,
    'handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url, 'email', cloud.v1_email(m.account_id),
    'role', m.role, 'created_at', cloud.v1_ts(m.created_at))
  from cloud.accounts a where a.id = m.account_id;
$$;

create or replace function cloud.v1_project_json(p cloud.projects) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'object', 'project', 'workspace', p.workspace_id, 'name', p.name, 'path', p.path,
    'prefix', p.prefix, 'inbox', p.inbox,
    'created_at', cloud.v1_ts(p.created_at), 'updated_at', cloud.v1_ts(p.updated_at));
$$;

create or replace function cloud.v1_workflow_json(w cloud.workflows) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', w.id, 'object', 'workflow', 'builtin', false, 'workspace', w.workspace_id, 'name', w.name,
    'description', w.description, 'version', w.version,
    'created_at', cloud.v1_ts(w.created_at), 'updated_at', cloud.v1_ts(w.updated_at));
$$;

create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'card_version', nullif(t.card_version, 0),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create or replace function cloud.v1_memory_json(m cloud.memories) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'object', 'memory', 'workspace', m.workspace_id, 'scope', m.scope,
    'project', m.project_id, 'name', m.name, 'body', m.body, 'version', m.version,
    'created_at', cloud.v1_ts(m.created_at), 'updated_at', cloud.v1_ts(m.updated_at));
$$;

-- ---------------------------------------------------------------------------
-- Workspaces and members
-- ---------------------------------------------------------------------------

create function api.v1_list_workspaces(p_account uuid, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select w.id, cloud.v1_workspace_json(w, p_account) j, row_number() over (order by w.id) n
    from cloud.v1_workspaces w join cloud.v1_workspace_members m on m.workspace_id = w.id and m.account_id = p_account
    where p_after is null or w.id > p_after
    order by w.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create function api.v1_workspace(p_account uuid, p_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select cloud.v1_workspace_json(w, p_account) from cloud.v1_workspaces w
  where w.id = cloud.v1_workspace_of(p_account, 'workspace', p_id);
$$;

create function api.v1_create_workspace(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  insert into cloud.v1_workspaces (id, account_id, name) values (cloud.v1_id('ws'), p_account, p_fields ->> 'name')
  returning * into w;
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (w.id, p_account, 'owner');
  perform cloud.v1_emit(w.id, 'workspace.created', cloud.v1_workspace_json(w, null) - 'role');
  return cloud.v1_workspace_json(w, p_account);
end;
$$;

create function api.v1_update_workspace(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'workspace', p_id), p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, p_id);
  update cloud.v1_workspaces set name = coalesce(p_fields ->> 'name', name), updated_at = now()
  where id = p_id returning * into w;
  perform cloud.v1_emit(w.id, 'workspace.updated', cloud.v1_workspace_json(w, null) - 'role');
  return cloud.v1_workspace_json(w, p_account);
end;
$$;

-- Where the workspace's files are in R2, for the Worker to delete before the rows go.
create function api.v1_workspace_files(p_account uuid, p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_id);
begin
  perform cloud.v1_require_owner(p_account, v_ws);
  return (
    with a as (select a.id from cloud.artifacts a join cloud.tasks t on t.id = a.task_id where t.workspace_id = v_ws)
    select jsonb_build_object(
      'files', coalesce((select jsonb_agg(k) from (
          select v.file ->> 'key' k from cloud.artifact_versions v where v.artifact_id in (select id from a) and v.file is not null
          union
          select u.object_key from cloud.artifact_uploads u
           where u.artifact_id in (select id from a) and u.uploaded_at is not null and u.used_at is null) f), '[]'),
      'multipart', coalesce((select jsonb_agg(jsonb_build_object('key', u.object_key, 'id', u.multipart_id))
          from cloud.artifact_uploads u
         where u.artifact_id in (select id from a) and u.uploaded_at is null and u.multipart_id is not null), '[]')));
end;
$$;

-- Its projects, tasks, memory, workflows and events go with it.
create function api.v1_delete_workspace(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'workspace', p_id), p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, p_id);
  select * into w from cloud.v1_workspaces where id = p_id for update;
  if w.personal then perform cloud.v1_refuse('A personal workspace cannot be deleted.'); end if;
  delete from cloud.v1_workspaces where id = p_id;
  return jsonb_build_object('id', w.id, 'object', 'workspace', 'deleted', true);
end;
$$;

create function api.v1_list_members(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
begin
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_member_json(m) order by m.created_at, m.account_id)
    from cloud.v1_workspace_members m where m.workspace_id = v_ws), '[]'), 'next', null);
end;
$$;

-- An account that has signed in, found by its address. It joins as a Member.
create function api.v1_add_member(p_account uuid, p_workspace text, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  v_joining uuid;
  m cloud.v1_workspace_members;
begin
  select i.user_id into v_joining from auth.identities i join cloud.accounts a on a.id = i.user_id
  where lower(i.identity_data ->> 'email') = lower(btrim(p_email))
  order by i.last_sign_in_at desc nulls last limit 1;
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget, v_joining);
  perform cloud.v1_require_owner(p_account, v_ws);
  if (select personal from cloud.v1_workspaces where id = v_ws) then
    perform cloud.v1_refuse('A personal workspace takes no other members. Create a workspace to invite people.');
  end if;
  if v_joining is null then perform cloud.v1_refuse('No account signs in with this email.'); end if;
  select * into m from cloud.v1_workspace_members where workspace_id = v_ws and account_id = v_joining;
  if found then return cloud.v1_member_json(m); end if;
  insert into cloud.v1_workspace_members (workspace_id, account_id, role) values (v_ws, v_joining, 'member')
  returning * into m;
  perform cloud.v1_emit(v_ws, 'member.added', cloud.v1_member_json(m));
  return cloud.v1_member_json(m);
end;
$$;

create function api.v1_update_member(p_account uuid, p_workspace text, p_member uuid, p_role text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  m cloud.v1_workspace_members;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  select * into m from cloud.v1_workspace_members where workspace_id = v_ws and account_id = p_member for update;
  if not found then perform cloud.v1_missing('member'); end if;
  if p_role <> 'owner' and exists (select 1 from cloud.v1_workspaces w where w.id = v_ws and w.account_id = p_member) then
    raise exception 'The workspace''s creator stays an owner.' using errcode = 'AKB16';
  end if;
  update cloud.v1_workspace_members set role = p_role where workspace_id = v_ws and account_id = p_member returning * into m;
  perform cloud.v1_emit(v_ws, 'member.updated', cloud.v1_member_json(m));
  return cloud.v1_member_json(m);
end;
$$;

-- An Owner removes a member; anyone removes themself, which is leaving.
create function api.v1_remove_member(p_account uuid, p_workspace text, p_member uuid, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
  w cloud.v1_workspaces;
  m cloud.v1_workspace_members;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_member <> p_account then perform cloud.v1_require_owner(p_account, v_ws); end if;
  select * into w from cloud.v1_workspaces where id = v_ws;
  if w.account_id = p_member then
    if w.personal then perform cloud.v1_refuse('A personal workspace cannot be left.'); end if;
    raise exception 'The workspace''s creator stays an owner. Delete the workspace instead.' using errcode = 'AKB16';
  end if;
  delete from cloud.v1_workspace_members where workspace_id = v_ws and account_id = p_member returning * into m;
  if not found then perform cloud.v1_missing('member'); end if;
  perform cloud.v1_emit(v_ws, 'member.removed', jsonb_build_object('object', 'workspace_member', 'workspace', v_ws,
    'account', p_member, 'role', m.role));
  return jsonb_build_object('object', 'workspace_member', 'workspace', v_ws, 'account', p_member, 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects and task keys
-- ---------------------------------------------------------------------------

drop function cloud.v1_default_prefix(uuid, text);
create function cloud.v1_default_prefix(p_workspace text, p_name text) returns text
language plpgsql stable set search_path = '' as $$
declare
  v_base text;
  v_prefix text;
  n integer := 1;
begin
  select left(upper(string_agg(left(w, 1), '' order by i)), 4) into v_base
  from regexp_split_to_table(regexp_replace(p_name, '([a-z0-9])([A-Z])', '\1 \2', 'g'), '[^A-Za-z0-9]+')
       with ordinality s(w, i)
  where w ~ '^[A-Za-z]';
  v_base := coalesce(v_base, 'P');
  v_prefix := v_base;
  while exists (select 1 from cloud.projects where workspace_id = p_workspace and prefix = v_prefix) loop
    n := n + 1;
    v_prefix := v_base || n;
  end loop;
  return v_prefix;
end;
$$;

create or replace function cloud.v1_project_prefix() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.prefix := coalesce(new.prefix, cloud.v1_default_prefix(new.workspace_id, new.name));
  return new;
end;
$$;

create or replace function cloud.v1_project_aliases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.task_aliases (workspace_id, account_id, prefix, number, task_id)
  select new.workspace_id, t.account_id, old.prefix, t.number, t.id from cloud.tasks t where t.project_id = new.id
  on conflict (workspace_id, prefix, number) do update set task_id = excluded.task_id;
  return null;
end;
$$;

-- The personal workspace's inbox, made the first time a task needs it. No other workspace has one.
drop function cloud.v1_inbox(uuid);
create function cloud.v1_inbox(p_workspace text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
  p cloud.projects;
begin
  select * into w from cloud.v1_workspaces where id = p_workspace;
  if not w.personal then perform cloud.v1_refuse('Name a project: only a personal workspace has an inbox.'); end if;
  select * into p from cloud.projects where workspace_id = p_workspace and inbox;
  if found then return p.id; end if;
  insert into cloud.projects (id, account_id, workspace_id, name, prefix, inbox)
  values (cloud.v1_id('prj'), w.account_id, p_workspace, 'Inbox', 'INBOX', true)
  on conflict (workspace_id) where inbox do nothing
  returning * into p;
  if not found then
    select * into p from cloud.projects where workspace_id = p_workspace and inbox;
    return p.id;
  end if;
  perform cloud.v1_emit(p_workspace, 'project.created', cloud.v1_project_json(p));
  return p.id;
end;
$$;

create or replace function cloud.v1_task_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is not distinct from old.project_id then return new; end if;
    insert into cloud.task_aliases (workspace_id, account_id, prefix, number, task_id)
    select old.workspace_id, old.account_id, p.prefix, old.number, old.id from cloud.projects p where p.id = old.project_id
    on conflict (workspace_id, prefix, number) do update set task_id = excluded.task_id;
  end if;
  new.project_id := coalesce(new.project_id, cloud.v1_inbox(new.workspace_id));
  update cloud.projects set next_number = next_number + 1 where id = new.project_id
  returning next_number - 1 into new.number;
  return new;
end;
$$;

-- The task a key names in the caller's workspaces: a current key before an old one, the
-- personal workspace's before another's.
create or replace function api.v1_task_id(p_account uuid, p_prefix text, p_number integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id text;
begin
  select x.id into v_id from (
    select t.id, 0 old, p.workspace_id from cloud.projects p join cloud.tasks t on t.project_id = p.id
     where p.prefix = p_prefix and t.number = p_number
    union all
    select a.task_id, 1, a.workspace_id from cloud.task_aliases a where a.prefix = p_prefix and a.number = p_number
  ) x join cloud.v1_workspaces w on w.id = x.workspace_id
  where cloud.v1_in(p_account, x.workspace_id)
  order by x.old, w.personal desc, w.id limit 1;
  if v_id is null then perform cloud.v1_missing('task'); end if;
  return v_id;
end;
$$;

drop function cloud.v1_prefix_free(uuid, text, text);
create function cloud.v1_prefix_free(p_workspace text, p_prefix text, p_project text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from cloud.projects where workspace_id = p_workspace and prefix = p_prefix and id is distinct from p_project
  ) or (p_prefix = 'INBOX' and not exists (select 1 from cloud.projects where id = p_project and inbox)) then
    perform cloud.v1_refuse('Another project already uses this prefix.');
  end if;
end;
$$;

drop function api.v1_list_projects(uuid, text, integer);
create function api.v1_list_projects(p_account uuid, p_workspace text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select p.id, cloud.v1_project_json(p) j, row_number() over (order by p.id) n
    from cloud.projects p
    where p.workspace_id = cloud.v1_target(p_account, p_workspace, null) and (p_after is null or p.id > p_after)
    order by p.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create or replace function api.v1_project(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_id);
  select * into p from cloud.projects where id = p_id;
  return cloud.v1_project_json(p);
end;
$$;

create or replace function api.v1_create_project(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', null);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_fields ? 'prefix' then perform cloud.v1_prefix_free(v_ws, p_fields ->> 'prefix', null); end if;
  insert into cloud.projects (id, account_id, workspace_id, name, path, prefix)
  values (cloud.v1_id('prj'), p_account, v_ws, p_fields ->> 'name', coalesce(p_fields ->> 'path', ''), p_fields ->> 'prefix')
  returning * into p;
  perform cloud.v1_emit(v_ws, 'project.created', cloud.v1_project_json(p));
  return cloud.v1_project_json(p);
end;
$$;

create or replace function api.v1_update_project(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p_fields ? 'prefix' then perform cloud.v1_prefix_free(v_ws, p_fields ->> 'prefix', p_id); end if;
  update cloud.projects set
    name = coalesce(p_fields ->> 'name', name),
    path = coalesce(p_fields ->> 'path', path),
    prefix = coalesce(p_fields ->> 'prefix', prefix),
    updated_at = now()
  where id = p_id returning * into p;
  perform cloud.v1_emit(v_ws, 'project.updated', cloud.v1_project_json(p));
  if p_fields ? 'prefix' then
    for t in select * from cloud.tasks where project_id = p_id loop
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    end loop;
  end if;
  return cloud.v1_project_json(p);
end;
$$;

-- In a personal workspace its tasks move to the inbox; elsewhere they are moved first.
create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  m cloud.memories;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_inbox text;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p.inbox then perform cloud.v1_refuse('The inbox cannot be deleted.'); end if;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    if not (select personal from cloud.v1_workspaces where id = v_ws) then
      perform cloud.v1_refuse('This project still has tasks. Move them to another project first.');
    end if;
    v_inbox := cloud.v1_inbox(v_ws);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_inbox, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    end loop;
  end if;
  for m in delete from cloud.memories where project_id = p_id returning * loop
    perform cloud.v1_emit(v_ws, 'memory.deleted', cloud.v1_memory_json(m));
  end loop;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

drop function api.v1_list_workflows(uuid, text, integer);
create function api.v1_list_workflows(p_account uuid, p_workspace text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select w.id, cloud.v1_workflow_json(w) j, row_number() over (order by w.id) n
    from cloud.workflows w
    where w.workspace_id = cloud.v1_target(p_account, p_workspace, null) and (p_after is null or w.id > p_after)
    order by w.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create or replace function api.v1_workflow(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_workspace_of(p_account, 'workflow', p_id);
  select * into w from cloud.workflows where id = p_id;
  return cloud.v1_workflow_json(w) || jsonb_build_object('files',
    (select v.files from cloud.workflow_versions v where v.workflow_id = w.id and v.version = w.version));
end;
$$;

create or replace function cloud.v1_add_workflow_version(w cloud.workflows, p_fields jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.workflow_versions (id, workflow_id, account_id, workspace_id, version, name, description, delivers, files)
  values (cloud.v1_id('wfv'), w.id, w.account_id, w.workspace_id, w.version, w.name, w.description,
          p_fields ->> 'delivers', p_fields -> 'files');
  delete from cloud.workflow_versions v
   where v.workflow_id = w.id and v.version < w.version
     and not exists (select 1 from cloud.tasks t where t.workflow_version = v.id);
end;
$$;

create or replace function api.v1_create_workflow(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', null);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  insert into cloud.workflows (id, account_id, workspace_id, name, description)
  values (cloud.v1_id('wf'), p_account, v_ws, p_fields ->> 'name', coalesce(p_fields ->> 'description', ''))
  returning * into w;
  perform cloud.v1_add_workflow_version(w, p_fields);
  perform cloud.v1_emit(v_ws, 'workflow.created', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create or replace function api.v1_update_workflow(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
  v_ws text := cloud.v1_workspace_of(p_account, 'workflow', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  update cloud.workflows set
    name = p_fields ->> 'name',
    description = coalesce(p_fields ->> 'description', ''),
    version = version + 1,
    updated_at = now()
  where id = p_id returning * into w;
  perform cloud.v1_add_workflow_version(w, p_fields);
  perform cloud.v1_emit(v_ws, 'workflow.updated', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create or replace function api.v1_delete_workflow(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
  v_ws text := cloud.v1_workspace_of(p_account, 'workflow', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  delete from cloud.workflows where id = p_id returning * into w;
  delete from cloud.workflow_versions v
   where v.workflow_id = w.id and not exists (select 1 from cloud.tasks t where t.workflow_version = v.id);
  perform cloud.v1_emit(v_ws, 'workflow.deleted', cloud.v1_workflow_json(w));
  return jsonb_build_object('id', w.id, 'object', 'workflow', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage: every member's, counted against the creator's plan
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_open_tasks(p_account uuid) returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
  where w.account_id = p_account and t.status in ('queued', 'running', 'waiting_review');
$$;

create or replace function cloud.v1_storage_used(p_account uuid, p_except text default null) returns bigint
language sql stable set search_path = '' as $$
  with a as (
    select a.id from cloud.artifacts a join cloud.tasks t on t.id = a.task_id
    join cloud.v1_workspaces w on w.id = t.workspace_id where w.account_id = p_account
  )
  select coalesce((select sum((v.file ->> 'size')::bigint) from cloud.artifact_versions v
                    where v.artifact_id in (select id from a) and v.file is not null), 0)
       + coalesce((select sum(coalesce(u.size, u.declared_size, 0)) from cloud.artifact_uploads u
                    where u.artifact_id in (select id from a) and u.used_at is null
                      and u.id is distinct from p_except), 0);
$$;

-- ---------------------------------------------------------------------------
-- Tasks and checkpoints
-- ---------------------------------------------------------------------------

-- `p_max_tasks` is the plan of the workspace's creator.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_max_tasks is not null
     and cloud.v1_open_tasks((select w.account_id from cloud.v1_workspaces w where w.id = v_ws)) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
  end if;
  if (p_workflow ->> 'builtin')::boolean then
    v := cloud.v1_builtin_version(p_workflow);
  else
    select v2.* into v from cloud.workflows w
      join cloud.workflow_versions v2 on v2.workflow_id = w.id and v2.version = w.version
     where w.id = p_workflow ->> 'id' and w.workspace_id = v_ws;
    if not found then perform cloud.v1_missing('workflow'); end if;
  end if;
  insert into cloud.tasks (id, account_id, workspace_id, project_id, workflow, workflow_version, title, request, source, source_context)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'))
  returning * into t;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

drop function api.v1_list_tasks(uuid, text, text, text, integer);
create function api.v1_list_tasks(p_account uuid, p_workspace text, p_project text, p_status text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select t.id, cloud.v1_task_json(t) j, row_number() over (order by t.id) n
    from cloud.tasks t
    where t.workspace_id = cloud.v1_target(p_account, p_workspace, p_project) and (p_after is null or t.id > p_after)
      and (p_project is null or t.project_id = p_project) and (p_status is null or t.status = p_status)
    order by t.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create or replace function api.v1_task(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_id);
  select * into t from cloud.tasks where id = p_id;
  return cloud.v1_task_json(t);
end;
$$;

-- A task moves between projects of its own workspace only.
create or replace function api.v1_update_task(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_status text := p_fields ->> 'status';
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  if v_project is not null and not exists (select 1 from cloud.projects where id = v_project and workspace_id = v_ws) then
    perform cloud.v1_missing('project');
  end if;
  if v_status = 'done' and exists (
    select 1 from cloud.task_checkpoints where task_id = p_id and status <> 'approved'
  ) then
    perform cloud.v1_refuse('Every checkpoint must be approved before the task is done.');
  end if;
  update cloud.tasks set
    title = coalesce(p_fields ->> 'title', title),
    status = coalesce(v_status, status),
    project_id = coalesce(v_project, project_id),
    updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

create or replace function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  update cloud.tasks set status = 'cancelled', updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.cancelled', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

create or replace function api.v1_list_checkpoints(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_checkpoint_json(c) order by c.position)
    from cloud.task_checkpoints c where c.task_id = p_task), '[]'), 'next', null);
end;
$$;

create or replace function api.v1_checkpoint(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
begin
  perform cloud.v1_workspace_of(p_account, 'checkpoint', p_id);
  select * into c from cloud.task_checkpoints where id = p_id;
  return cloud.v1_checkpoint_json(c);
end;
$$;

create or replace function cloud.v1_revise(p_checkpoint text) returns cloud.task_checkpoints
language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
begin
  update cloud.task_checkpoints set review_revision = review_revision + 1, updated_at = now()
  where id = p_checkpoint returning * into c;
  insert into cloud.checkpoint_revisions (checkpoint_id, revision, account_id, artifacts)
  values (c.id, c.review_revision, c.account_id, coalesce((
    select jsonb_agg(jsonb_build_object('artifact', a.id, 'version', a.latest_version) order by a.id)
    from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));
  perform cloud.v1_emit(cloud.v1_task_workspace(c.task_id), 'checkpoint.updated', cloud.v1_checkpoint_json(c));
  return c;
end;
$$;

create or replace function api.v1_update_checkpoint(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  v_review jsonb;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_id for update;
  perform cloud.v1_task_open(c.task_id);
  if c.status = 'approved' then perform cloud.v1_refuse('This checkpoint is already approved.'); end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position < c.position and e.status <> 'approved'
  ) then
    perform cloud.v1_refuse('An earlier checkpoint is not approved yet.');
  end if;
  v_review := case when p_fields ? 'question' or p_fields ? 'options'
    then jsonb_strip_nulls(jsonb_build_object('question', p_fields -> 'question', 'options', p_fields -> 'options'))
    else c.review end;

  if v_review is distinct from c.review then
    update cloud.task_checkpoints set review = v_review where id = c.id;
    c := cloud.v1_revise(c.id);
  end if;
  if c.status <> 'ready' and exists (
    select 1 from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0
  ) then
    update cloud.task_checkpoints set status = 'ready', updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(v_ws, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_checkpoint_json(c);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cards, the task's files, and its workflow
-- ---------------------------------------------------------------------------

drop function cloud.v1_write_card(uuid, text, jsonb);
create function cloud.v1_write_card(p_task text, p_fields jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_bad text;
  v_cp text;
begin
  select e.key into v_bad from jsonb_each(coalesce(p_fields -> 'assets', '{}')) e
  where not exists (
    select 1 from cloud.artifacts a
    where a.id = e.value ->> 'artifact' and a.task_id = p_task
      and (e.value -> 'version' is null or (e.value ->> 'version')::integer between 1 and a.latest_version))
  limit 1;
  if v_bad is not null then
    raise exception 'The asset % names no artifact version on this task.', v_bad using errcode = 'AKB20';
  end if;
  insert into cloud.task_cards (task_id, account_id, body, metadata, assets)
  select p_task, x.account_id, p_fields ->> 'body', coalesce(p_fields -> 'metadata', '{}'), coalesce(p_fields -> 'assets', '{}')
  from cloud.tasks x where x.id = p_task
  on conflict (task_id) do update set body = excluded.body, metadata = excluded.metadata, assets = excluded.assets,
    updated_at = now()
  returning * into k;
  update cloud.tasks set card_version = card_version + 1, updated_at = now() where id = p_task returning * into t;
  for v_cp in
    select c.id from cloud.task_checkpoints c
    where c.task_id = p_task and c.status not in ('pending', 'approved') order by c.position
  loop
    perform cloud.v1_revise(v_cp);
  end loop;
  perform cloud.v1_emit(t.workspace_id, 'card.updated', cloud.v1_card_json(k, t.card_version) - 'body');
  return cloud.v1_card_json(k, t.card_version);
end;
$$;

create or replace function api.v1_save_card(
  p_account uuid, p_task text, p_fields jsonb, p_base integer, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task for update;
  perform cloud.v1_task_open(p_task);
  if t.card_version <> p_base then
    perform cloud.v1_refuse(format('The card is at version %s now; read it and write against that.', t.card_version));
  end if;
  return cloud.v1_write_card(p_task, p_fields);
end;
$$;

create or replace function api.v1_card(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  k cloud.task_cards;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select * into k from cloud.task_cards where task_id = p_task;
  if not found then perform cloud.v1_missing('card'); end if;
  return cloud.v1_card_json(k, (select t.card_version from cloud.tasks t where t.id = p_task));
end;
$$;

-- The card and memory a job changed in the task's folder, saved together. An inbox task's
-- memory is its workspace's; any other task's is its project's.
drop function api.v1_commit_workspace(uuid, text, jsonb, jsonb, integer);
create function api.v1_commit_files(
  p_account uuid, p_task text, p_card jsonb, p_memories jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  m cloud.memories;
  e jsonb;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
  v_scope text;
  v_project text;
  v_card jsonb;
  v_out jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task for update;
  perform cloud.v1_task_open(p_task);
  select p.id into v_project from cloud.projects p where p.id = t.project_id and not p.inbox;
  v_scope := case when v_project is null then 'workspace' else 'project' end;

  if p_card is not null and t.card_version <> (p_card ->> 'base_version')::integer then
    perform cloud.v1_outdated('The card');
  end if;

  select * into k from cloud.task_cards where task_id = p_task;
  if p_card is null or (k.task_id is not null and k.body = p_card ->> 'body'
      and k.metadata = coalesce(p_card -> 'metadata', '{}') and k.assets = coalesce(p_card -> 'assets', '{}')) then
    v_card := case when k.task_id is null then null else cloud.v1_card_json(k, t.card_version) end;
  else
    v_card := cloud.v1_write_card(p_task, p_card - 'base_version');
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_memories, '[]')) loop
    m := null;
    if e -> 'body' is null or jsonb_typeof(e -> 'body') = 'null' then
      delete from cloud.memories
       where workspace_id = v_ws and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      if m.id is not null then
        perform cloud.v1_emit(v_ws, 'memory.deleted', cloud.v1_memory_json(m));
        v_out := v_out || jsonb_build_object('id', m.id, 'object', 'memory', 'name', m.name, 'deleted', true);
      else
        v_out := v_out || jsonb_build_object('object', 'memory', 'name', e ->> 'name', 'deleted', true);
      end if;
    else
      update cloud.memories set body = e ->> 'body', version = version + 1, updated_at = now()
       where workspace_id = v_ws and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      if m.id is null then
        insert into cloud.memories (id, account_id, workspace_id, scope, project_id, name, body)
        values (cloud.v1_id('mem'), p_account, v_ws, v_scope, v_project, e ->> 'name', e ->> 'body')
        returning * into m;
      end if;
      perform cloud.v1_emit(v_ws, 'memory.updated', cloud.v1_memory_json(m));
      v_out := v_out || cloud.v1_memory_json(m);
    end if;
  end loop;
  return jsonb_build_object('object', 'task_files', 'card', v_card, 'memories', v_out);
end;
$$;

create or replace function api.v1_task_workflow(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.workflow_versions;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select v2.* into v from cloud.tasks t join cloud.workflow_versions v2 on v2.id = t.workflow_version where t.id = p_task;
  if not found then perform cloud.v1_missing('workflow version for this task'); end if;
  return jsonb_build_object('object', 'workflow_version', 'workflow', v.workflow_id, 'builtin', v.account_id is null,
    'version', v.version, 'name', v.name, 'description', v.description, 'delivers', v.delivers, 'files', v.files);
end;
$$;

create or replace function cloud.v1_submit_draft(p_task text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  c cloud.task_checkpoints;
  v_phases jsonb;
  v_n integer := 1;
  v_key text := 'plan';
  v_title text;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.status in ('done', 'failed', 'cancelled') then return; end if;
  select * into k from cloud.task_cards where task_id = p_task;
  v_phases := cloud.v1_card_phases(k);
  v_title := t.title;
  if v_phases is not null then
    v_n := least(greatest(coalesce((k.metadata ->> 'phase')::integer, 1), 1), jsonb_array_length(v_phases));
    v_key := 'phase-' || v_n;
    v_title := v_phases ->> (v_n - 1);
  end if;

  delete from cloud.task_checkpoints where task_id = p_task and position > v_n;
  select * into c from cloud.task_checkpoints where task_id = p_task and position = v_n for update;
  if found then
    update cloud.task_checkpoints set key = v_key, title = v_title, status = 'ready', updated_at = now() where id = c.id;
  else
    insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition, status)
    values (cloud.v1_id('cp'), t.account_id, p_task, v_n, v_key, v_title, '{}', 'ready')
    returning * into c;
  end if;
  c := cloud.v1_revise(c.id);
  perform cloud.v1_emit(t.workspace_id, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  update cloud.tasks set status = 'waiting_review', updated_at = now() where id = p_task returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

create or replace function cloud.v1_after_approval(c cloud.task_checkpoints) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_phases jsonb;
  v_status text;
begin
  select * into t from cloud.tasks where id = c.task_id for update;
  if t.workflow_version is null then return; end if;
  select * into k from cloud.task_cards where task_id = c.task_id;
  v_phases := cloud.v1_card_phases(k);
  if v_phases is not null and jsonb_array_length(v_phases) > c.position then
    perform cloud.v1_write_card(c.task_id, jsonb_build_object('body', k.body,
      'metadata', k.metadata || jsonb_build_object('phase', c.position + 1), 'assets', k.assets));
    v_status := 'queued';
  elsif exists (select 1 from cloud.task_checkpoints e where e.task_id = c.task_id and e.status <> 'approved') then
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
  end if;
  update cloud.tasks set status = v_status, updated_at = now() where id = c.task_id returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- ---------------------------------------------------------------------------
-- Artifacts and uploads
-- ---------------------------------------------------------------------------

create or replace function api.v1_create_artifact(p_account uuid, p_task text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  v_checkpoint text := p_fields ->> 'checkpoint';
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_task_open(p_task);
  if v_checkpoint is not null and not exists (
    select 1 from cloud.task_checkpoints where id = v_checkpoint and task_id = p_task
  ) then
    perform cloud.v1_missing('checkpoint');
  end if;
  insert into cloud.artifacts (id, account_id, task_id, checkpoint_id, type, name)
  select cloud.v1_id('art'), t.account_id, p_task, v_checkpoint, p_fields ->> 'type', coalesce(p_fields ->> 'name', '')
  from cloud.tasks t where t.id = p_task
  returning * into a;
  perform cloud.v1_emit(v_ws, 'artifact.created', cloud.v1_artifact_json(a));
  return cloud.v1_artifact_json(a);
end;
$$;

create or replace function api.v1_list_artifacts(p_account uuid, p_task text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
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

create or replace function api.v1_artifact(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a cloud.artifacts;
begin
  perform cloud.v1_workspace_of(p_account, 'artifact', p_id);
  select * into a from cloud.artifacts where id = p_id;
  return cloud.v1_artifact_json(a);
end;
$$;

create or replace function api.v1_create_artifact_version(
  p_account uuid, p_artifact text, p_content jsonb, p_upload text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  c cloud.task_checkpoints;
  u cloud.artifact_uploads;
  v cloud.artifact_versions;
  v_file jsonb;
  v_ws text := cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact for update;
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
  values (a.id, a.latest_version + 1, a.account_id, case when v_file is null then p_content end, v_file)
  returning * into v;
  update cloud.artifacts set latest_version = v.version, updated_at = now() where id = a.id;
  perform cloud.v1_emit(v_ws, 'artifact.version_created', cloud.v1_version_json(v));

  if c.id is not null and c.status <> 'ready' then
    update cloud.task_checkpoints set status = 'ready', updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(v_ws, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_version_json(v);
end;
$$;

create or replace function api.v1_artifact_version(p_account uuid, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.artifact_versions;
begin
  perform cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
  select * into v from cloud.artifact_versions where artifact_id = p_artifact and version = p_version;
  if not found then perform cloud.v1_missing('artifact version'); end if;
  -- `stored` is the Worker's alone: where the file sits in R2.
  return cloud.v1_version_json(v) || jsonb_build_object('stored', v.file);
end;
$$;

-- `p_storage_limit` is the plan of the workspace's creator.
create or replace function api.v1_create_upload(
  p_account uuid, p_artifact text, p_content_type text, p_daily_write_budget integer,
  p_size bigint default null, p_multipart_id text default null, p_storage_limit bigint default null,
  p_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  u cloud.artifact_uploads;
  v_id text := coalesce(p_id, cloud.v1_id('upl'));
  v_ws text := cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact;
  perform cloud.v1_task_open(a.task_id);
  if p_storage_limit is not null and cloud.v1_storage_used(cloud.v1_payer_of(v_ws)) + coalesce(p_size, 1) > p_storage_limit then
    perform cloud.v1_over_quota('storage', p_storage_limit);
  end if;
  insert into cloud.artifact_uploads
    (id, account_id, artifact_id, object_key, content_type, declared_size, multipart_id, expires_at)
  values (v_id, a.account_id, a.id, cloud.v1_upload_key(a.account_id, a.id, v_id), p_content_type, p_size, p_multipart_id,
          now() + case when p_multipart_id is null then interval '1 hour' else interval '1 day' end)
  returning * into u;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'method', 'PUT',
    'url', '/v1/uploads/' || u.id, 'content_type', u.content_type, 'expires_at', cloud.v1_ts(u.expires_at));
end;
$$;

create or replace function api.v1_new_upload_key(p_account uuid, p_artifact text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id text := cloud.v1_id('upl');
  a cloud.artifacts;
begin
  perform cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
  select * into a from cloud.artifacts where id = p_artifact;
  return jsonb_build_object('id', v_id, 'key', cloud.v1_upload_key(a.account_id, p_artifact, v_id));
end;
$$;

create or replace function api.v1_upload_target(p_account uuid, p_upload text, p_storage_limit bigint default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('key', u.object_key, 'content_type', u.content_type, 'size', u.declared_size,
           'multipart_id', u.multipart_id, 'parts', u.parts,
           'room', case when p_storage_limit is null then null
                        else p_storage_limit - cloud.v1_storage_used(cloud.v1_payer_of(cloud.v1_task_workspace(a.task_id)), u.id) end)
  from cloud.artifact_uploads u join cloud.artifacts a on a.id = u.artifact_id
  where u.id = p_upload and cloud.v1_in(p_account, cloud.v1_task_workspace(a.task_id))
    and u.uploaded_at is null and u.expires_at > now();
$$;

create or replace function api.v1_add_upload_part(
  p_account uuid, p_upload text, p_part integer, p_etag text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u cloud.artifact_uploads;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'upload', p_upload), p_daily_write_budget);
  update cloud.artifact_uploads
     set parts = (select coalesce(jsonb_agg(p order by (p ->> 'part')::integer), '[]')
                    from (select p from jsonb_array_elements(parts) p where (p ->> 'part')::integer <> p_part
                          union all select jsonb_build_object('part', p_part, 'etag', p_etag)) x(p))
   where id = p_upload and multipart_id is not null and uploaded_at is null and expires_at > now()
  returning * into u;
  if not found then perform cloud.v1_missing('upload'); end if;
  return jsonb_build_object('id', u.id, 'object', 'upload_part', 'part', p_part);
end;
$$;

create or replace function api.v1_finish_upload(
  p_account uuid, p_upload text, p_size bigint, p_daily_write_budget integer, p_storage_limit bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u cloud.artifact_uploads;
  v_ws text := cloud.v1_workspace_of(p_account, 'upload', p_upload);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_storage_limit is not null and cloud.v1_storage_used(cloud.v1_payer_of(v_ws), p_upload) + p_size > p_storage_limit then
    perform cloud.v1_over_quota('storage', p_storage_limit);
  end if;
  update cloud.artifact_uploads set size = p_size, uploaded_at = now(), parts = '[]'
  where id = p_upload and uploaded_at is null and expires_at > now()
  returning * into u;
  if not found then perform cloud.v1_missing('upload'); end if;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'size', u.size,
    'content_type', u.content_type, 'uploaded', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Decisions and comments
-- ---------------------------------------------------------------------------

create or replace function api.v1_create_decision(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_card boolean;
  v_status text;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint for update;
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
  v_card := exists (select 1 from cloud.task_cards k where k.task_id = c.task_id);
  if v_revision is null and v_card then
    perform cloud.v1_refuse('This task has a card: name the review_revision you reviewed.');
  end if;
  if v_revision is not null and v_revision <> c.review_revision then
    raise exception 'This checkpoint has changed since it was opened. Reload it and review again.'
      using errcode = 'AKB26', detail = 'review_outdated';
  end if;

  if v_artifact is null then
    select v.artifact_id, v.version into v_artifact, v_version
    from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where a.checkpoint_id = c.id order by v.created_at desc, v.version desc limit 1;
  elsif v_version is null then
    select a.latest_version into v_version from cloud.artifacts a where a.id = v_artifact and a.checkpoint_id = c.id;
  end if;
  -- A card review with nothing attached decides on the card alone.
  if not (v_artifact is null and p_fields ->> 'artifact' is null and v_card) and not exists (
    select 1 from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where v.artifact_id = v_artifact and v.version = v_version and a.checkpoint_id = c.id
  ) then
    perform cloud.v1_missing('artifact version on this checkpoint');
  end if;

  insert into cloud.decisions (id, account_id, checkpoint_id, artifact_id, artifact_version, decision, comment,
                               decided_by, review_revision)
  values (cloud.v1_id('dec'), c.account_id, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision)
  returning * into d;
  perform cloud.v1_emit(v_ws, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(v_ws, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
    if v_status = 'approved' then perform cloud.v1_after_approval(c); end if;
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

create or replace function api.v1_list_decisions(p_account uuid, p_checkpoint text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
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

create or replace function api.v1_create_comment(
  p_account uuid, p_checkpoint text, p_body text, p_author jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  m cloud.checkpoint_comments;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint;
  insert into cloud.checkpoint_comments (id, account_id, task_id, checkpoint_id, body, author)
  values (cloud.v1_id('cmt'), c.account_id, c.task_id, c.id, p_body, p_author)
  returning * into m;
  perform cloud.v1_emit(v_ws, 'comment.created', cloud.v1_comment_json(m));
  return cloud.v1_comment_json(m);
end;
$$;

create or replace function api.v1_list_comments(p_account uuid, p_checkpoint text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select m.id, cloud.v1_comment_json(m) j, row_number() over (order by m.id) n
      from cloud.checkpoint_comments m
      where m.checkpoint_id = p_checkpoint and (p_after is null or m.id > p_after)
      order by m.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

-- ---------------------------------------------------------------------------
-- Memory
-- ---------------------------------------------------------------------------

-- `p_task` narrows to what that task may read: its workspace's memory, and its project's.
drop function api.v1_list_memories(uuid, text, text, text, text, integer);
create function api.v1_list_memories(
  p_account uuid, p_workspace text, p_scope text, p_project text, p_task text, p_after text, p_limit integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text;
  v_task_project text;
begin
  if p_task is not null then
    v_ws := cloud.v1_workspace_of(p_account, 'task', p_task);
    if p_workspace is not null and p_workspace <> v_ws then perform cloud.v1_missing('task'); end if;
    select project_id into v_task_project from cloud.tasks where id = p_task;
  else
    v_ws := cloud.v1_target(p_account, p_workspace, p_project);
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select m.id, cloud.v1_memory_json(m) j, row_number() over (order by m.id) n
      from cloud.memories m
      where m.workspace_id = v_ws and (p_after is null or m.id > p_after)
        and (p_scope is null or m.scope = p_scope)
        and (p_project is null or m.project_id = p_project)
        and (p_task is null or m.scope = 'workspace' or m.project_id = v_task_project)
      order by m.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

create or replace function api.v1_memory(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m cloud.memories;
begin
  perform cloud.v1_workspace_of(p_account, 'memory', p_id);
  select * into m from cloud.memories where id = p_id;
  return cloud.v1_memory_json(m);
end;
$$;

create or replace function api.v1_create_memory(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
  v_project text := case when p_fields ->> 'scope' = 'project' then p_fields ->> 'project' end;
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  begin
    insert into cloud.memories (id, account_id, workspace_id, scope, project_id, name, body)
    values (cloud.v1_id('mem'), p_account, v_ws, p_fields ->> 'scope', v_project, p_fields ->> 'name',
            coalesce(p_fields ->> 'body', ''))
    returning * into m;
  exception when unique_violation then
    perform cloud.v1_refuse('A memory with this name already exists here.');
  end;
  perform cloud.v1_emit(v_ws, 'memory.updated', cloud.v1_memory_json(m));
  return cloud.v1_memory_json(m);
end;
$$;

create or replace function api.v1_update_memory(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
  v_ws text := cloud.v1_workspace_of(p_account, 'memory', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into m from cloud.memories where id = p_id for update;
  if p_fields ? 'base_version' and m.version <> (p_fields ->> 'base_version')::integer then
    perform cloud.v1_outdated(format('The memory %s', m.name));
  end if;
  begin
    update cloud.memories set
      name = coalesce(p_fields ->> 'name', name),
      body = coalesce(p_fields ->> 'body', body),
      version = version + 1,
      updated_at = now()
    where id = p_id returning * into m;
  exception when unique_violation then
    perform cloud.v1_refuse('A memory with this name already exists here.');
  end;
  perform cloud.v1_emit(v_ws, 'memory.updated', cloud.v1_memory_json(m));
  return cloud.v1_memory_json(m);
end;
$$;

create or replace function api.v1_delete_memory(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
  v_ws text := cloud.v1_workspace_of(p_account, 'memory', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  delete from cloud.memories where id = p_id returning * into m;
  perform cloud.v1_emit(v_ws, 'memory.deleted', cloud.v1_memory_json(m));
  return jsonb_build_object('id', m.id, 'object', 'memory', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Events: every workspace the account is in, while it is in it
-- ---------------------------------------------------------------------------

create or replace function api.v1_list_events(p_account uuid, p_after bigint, p_limit integer, p_hidden text[] default '{}')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.seq) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit)
      then 'evt_' || max(x.seq) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select e.seq, cloud.v1_event_json(e) j, row_number() over (order by e.seq) n
    from cloud.api_events e
    where e.workspace_id in (select m.workspace_id from cloud.v1_workspace_members m where m.account_id = p_account)
      and (e.account_id is null or e.account_id = p_account)
      and e.seq > coalesce(p_after, 0) and not (e.type = any(coalesce(p_hidden, '{}')))
    order by e.seq limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create or replace function cloud.v1_event_json(e cloud.api_events) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', 'evt_' || e.seq, 'object', 'event', 'type', e.type, 'workspace', e.workspace_id,
    'created_at', cloud.v1_ts(e.created_at), 'data', e.data);
$$;

-- ---------------------------------------------------------------------------
-- Share links, guests and the review page
-- ---------------------------------------------------------------------------

create or replace function api.v1_create_share_link(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_hash text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_fields ->> 'access' = 'link' then perform cloud.v1_require_owner(p_account, v_ws); end if;
  insert into cloud.share_links (id, account_id, checkpoint_id, token_hash, access, expires_at)
  values (cloud.v1_id('shr'), p_account, p_checkpoint, p_hash, coalesce(p_fields ->> 'access', 'invited'),
          now() + make_interval(days => coalesce((p_fields ->> 'expires_in_days')::integer, 7)))
  returning * into l;
  perform cloud.v1_emit(v_ws, 'share_link.created', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create or replace function api.v1_update_share_link(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
  v_ws text := cloud.v1_workspace_of(p_account, 'share link', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  select * into l from cloud.share_links where id = p_id for update;
  if l.revoked_at is not null then perform cloud.v1_refuse('This link has been revoked.'); end if;
  if l.expires_at <= now() then perform cloud.v1_refuse('This link has expired.'); end if;
  update cloud.share_links set access = coalesce(p_fields ->> 'access', access), updated_at = now()
  where id = p_id returning * into l;
  perform cloud.v1_emit(v_ws, 'share_link.updated', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create or replace function api.v1_list_share_links(p_account uuid, p_checkpoint text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_share_link_json(l) order by l.id)
    from cloud.share_links l where l.checkpoint_id = p_checkpoint), '[]'), 'next', null);
end;
$$;

create or replace function api.v1_revoke_share_link(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
  v_ws text := cloud.v1_workspace_of(p_account, 'share link', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  update cloud.share_links set revoked_at = coalesce(revoked_at, now()), updated_at = now()
  where id = p_id returning * into l;
  perform cloud.v1_emit(v_ws, 'share_link.revoked', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

drop function cloud.v1_own_task(uuid, text);

create or replace function api.v1_list_guests(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = p_task), '[]'), 'next', null);
end;
$$;

create or replace function api.v1_add_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  select * into g from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email));
  if found then return cloud.v1_guest_json(g); end if;
  if (select count(*) from cloud.task_guests where task_id = p_task) >= 50 then
    perform cloud.v1_refuse('A task takes at most 50 guests.');
  end if;
  insert into cloud.task_guests (task_id, email) values (p_task, lower(btrim(p_email))) returning * into g;
  perform cloud.v1_emit(v_ws, 'guest.added', cloud.v1_guest_json(g));
  return cloud.v1_guest_json(g);
end;
$$;

create or replace function api.v1_remove_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  delete from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email)) returning * into g;
  if not found then perform cloud.v1_missing('guest'); end if;
  perform cloud.v1_emit(v_ws, 'guest.removed', cloud.v1_guest_json(g));
  return cloud.v1_guest_json(g) || jsonb_build_object('deleted', true);
end;
$$;

-- `owner` and `member` are the task's workspace roles; `guest` is invited to the task.
-- `account` is who a write through the link is made as: the member, or for a guest the
-- workspace's creator.
create or replace function cloud.v1_share_access(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l cloud.share_links;
  t cloud.tasks;
  v_role text;
begin
  select * into l from cloud.share_links where token_hash = p_hash;
  if not found then
    raise exception 'This link is not valid.' using errcode = 'AKB24', detail = 'invalid';
  end if;
  if l.revoked_at is not null then
    raise exception 'This link has been revoked.' using errcode = 'AKB24', detail = 'revoked';
  end if;
  if l.expires_at <= now() then
    raise exception 'This link has expired.' using errcode = 'AKB24', detail = 'expired';
  end if;
  select t2.* into t from cloud.task_checkpoints c join cloud.tasks t2 on t2.id = c.task_id where c.id = l.checkpoint_id;
  v_role := cloud.v1_role(p_subject, t.workspace_id);
  if v_role is null and p_subject is not null and p_email is not null
    and exists (select 1 from cloud.task_guests g where g.task_id = t.id and g.email = lower(p_email)) then
    v_role := 'guest';
  end if;
  if v_role is null and l.access <> 'link' then
    if p_subject is null then
      raise exception 'Sign in to open this review.' using errcode = 'AKB25', detail = 'sign_in_required';
    end if;
    raise exception 'This email is not invited to this review.' using errcode = 'AKB25', detail = 'not_invited';
  end if;
  return jsonb_build_object('link', l.id, 'workspace', t.workspace_id, 'checkpoint', l.checkpoint_id, 'task', t.id,
    'role', v_role,
    'account', case when v_role in ('owner', 'member') then p_subject else cloud.v1_payer_of(t.workspace_id) end);
end;
$$;

create or replace function cloud.v1_reviewer(p_role text, p_subject uuid, p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_role in ('owner', 'member')
    then jsonb_build_object('kind', 'user', 'handle', (select a.handle from cloud.accounts a where a.id = p_subject))
    else jsonb_build_object('kind', 'reviewer', 'email', lower(p_email),
           'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end;
$$;

drop function cloud.v1_share_owner(text, uuid, text);
create function cloud.v1_share_member(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
begin
  if v ->> 'role' is null or v ->> 'role' not in ('owner', 'member') then
    raise exception 'Only the workspace''s members can do this.' using errcode = 'AKB25', detail = 'owner_only';
  end if;
  return v;
end;
$$;

create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  k cloud.task_cards;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;
  select * into k from cloud.task_cards where task_id = c.task_id;

  v_out := jsonb_build_object(
    'object', 'shared_review',
    'role', v_role,
    'me', case when p_subject is null then null else jsonb_build_object('email', lower(p_email),
            'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end,
    'link', jsonb_build_object('id', l.id, 'access', l.access, 'expires_at', cloud.v1_ts(l.expires_at)),
    'owner', (select jsonb_build_object('handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url)
              from cloud.accounts a where a.id = t.account_id),
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name) from cloud.v1_workspaces w
                  where w.id = t.workspace_id and v_role in ('owner', 'member')),
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'checkpoint', case when v_role is null then cloud.v1_checkpoint_json(c) - 'status' else cloud.v1_checkpoint_json(c) end,
    'card', case when k.task_id is null then null else jsonb_build_object('version', t.card_version, 'body', k.body,
              'metadata', k.metadata, 'assets', k.assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(coalesce(k.assets, '{}')) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));

  if v_role is null then return v_out; end if;
  v_out := v_out || jsonb_build_object(
    'decisions', coalesce((select jsonb_agg(cloud.v1_decision_json(d) order by d.id)
                           from cloud.decisions d where d.checkpoint_id = c.id), '[]'),
    'comments', coalesce((select jsonb_agg(cloud.v1_comment_json(m) order by m.id)
                          from cloud.checkpoint_comments m where m.checkpoint_id = c.id), '[]'),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision', r.revision, 'created_at', cloud.v1_ts(r.created_at))
                                            order by r.revision)
                           from cloud.checkpoint_revisions r where r.checkpoint_id = c.id), '[]'));
  if v_role <> 'owner' then return v_out; end if;
  return v_out || jsonb_build_object('guests', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = t.id), '[]'));
end;
$$;

-- A write through a link answers which workspace it changed, so the Worker wakes its members.
create or replace function api.v1_shared_comment(p_hash text, p_subject uuid, p_email text, p_body text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
begin
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_comment((v ->> 'account')::uuid, v ->> 'checkpoint', p_body, v -> 'author', p_daily_write_budget));
end;
$$;

create or replace function api.v1_shared_decide(
  p_hash text, p_subject uuid, p_email text, p_picked integer, p_text text, p_revision integer,
  p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
  c cloud.task_checkpoints;
  v_option jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_fields jsonb;
begin
  select * into c from cloud.task_checkpoints where id = v ->> 'checkpoint';
  if not exists (select 1 from cloud.task_cards k where k.task_id = c.task_id) then
    raise exception 'This checkpoint has no full card to review yet.' using errcode = 'AKB26', detail = 'card_missing';
  end if;
  if p_picked is null then
    if v_text is null then perform cloud.v1_refuse('Write what should change.'); end if;
    v_fields := jsonb_build_object('decision', 'request_changes', 'comment', v_text);
  else
    v_option := coalesce(c.review -> 'options', '[{"label": "Approve", "approve": true}]') -> p_picked;
    if v_option is null or p_picked < 0 then perform cloud.v1_refuse('No option has this number.'); end if;
    v_fields := jsonb_build_object(
      'decision', case when coalesce((v_option ->> 'approve')::boolean, false) then 'approve' else 'request_changes' end,
      'comment', concat_ws(E'\n\n', v_option ->> 'label', v_text));
  end if;
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_decision((v ->> 'account')::uuid, c.id, v_fields || jsonb_build_object('review_revision', p_revision),
                           v -> 'author', p_daily_write_budget));
end;
$$;

-- The chat runs on the Runner of whoever started the task.
create or replace function api.v1_shared_chat(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
begin
  return cloud.task_chat_json((select t.account_id from cloud.tasks t where t.id = v ->> 'task'), v ->> 'task');
end;
$$;

create or replace function api.v1_shared_chat_send(
  p_hash text, p_subject uuid, p_email text, p_body text, p_runtime text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
  v_task text := v ->> 'task';
  v_runner uuid;
  h cloud.task_chats;
  v_job json;
begin
  perform cloud.v1_write((v ->> 'account')::uuid, v ->> 'workspace', p_daily_write_budget);
  select account_id into v_runner from cloud.tasks where id = v_task for update;
  insert into cloud.task_chats (task_id, account_id) values (v_task, v_runner) on conflict (task_id) do nothing;
  select * into h from cloud.task_chats where task_id = v_task;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if not exists (select 1 from cloud.runners r where r.owner_id = v_runner and r.live_until > now()) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
  values (cloud.v1_id('msg'), v_task, v_runner, 'user', p_body);
  v_job := api.dispatch_runner_job(v_runner, p_runtime, null, cloud.task_chat_prompt(v_task), '[]', p_daily_write_budget, v_task);
  if h.session_runtime is not distinct from p_runtime and h.session is not null then
    update cloud.runner_jobs set resume = h.session where id = (v_job ->> 'id')::uuid;
  end if;
  update cloud.task_chats set runtime = p_runtime, job_id = (v_job ->> 'id')::uuid, failure = null,
    session = case when session_runtime is distinct from p_runtime then null else session end,
    context = case when session_runtime is distinct from p_runtime then null else context end,
    updated_at = now()
  where task_id = v_task;
  return jsonb_build_object('workspace', v -> 'workspace', 'result', cloud.task_chat_json(v_runner, v_task));
end;
$$;

create or replace function api.v1_shared_chat_clear(p_hash text, p_subject uuid, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
  v_task text := v ->> 'task';
  h cloud.task_chats;
begin
  perform cloud.v1_write((v ->> 'account')::uuid, v ->> 'workspace', p_daily_write_budget);
  select * into h from cloud.task_chats where task_id = v_task for update;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  delete from cloud.task_chat_messages where task_id = v_task;
  update cloud.task_chats set job_id = null, session = null, session_runtime = null, context = null, failure = null,
    updated_at = now()
  where task_id = v_task;
  return jsonb_build_object('workspace', v -> 'workspace',
    'result', cloud.task_chat_json((select t.account_id from cloud.tasks t where t.id = v_task), v_task));
end;
$$;

-- ---------------------------------------------------------------------------
-- Alerts: the task's creator alone, while still a member
-- ---------------------------------------------------------------------------

create or replace function cloud.raise_alert(p_task cloud.tasks, p_kind text, p_checkpoint text, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runners;
  a cloud.alerts;
  v_desktop boolean;
begin
  if not cloud.v1_in(p_task.account_id, p_task.workspace_id) then return; end if;
  select * into r from cloud.runners where owner_id = p_task.account_id and live_until > now() and notify;
  v_desktop := r.owner_id is not null and not exists (
    select 1 from cloud.project_folders f
     where f.project_id = p_task.project_id and f.machine_id = r.machine_id and not f.notify);
  insert into cloud.alerts (id, account_id, kind, task_id, checkpoint_id, comment_id, channel, machine_id)
  values (cloud.v1_id('alr'), p_task.account_id, p_kind, p_task.id, p_checkpoint, p_comment,
          case when v_desktop then 'desktop' else 'web' end, case when v_desktop then r.machine_id end)
  returning * into a;
  perform cloud.v1_emit(p_task.workspace_id, 'alert.created', cloud.v1_alert_json(a), a.account_id);
  if v_desktop then perform cloud.hint_desktop(a.account_id, 'alert', jsonb_build_object('alertId', a.id)); end if;
end;
$$;

create or replace function cloud.read_alerts_where(p_account uuid, p_task text, p_checkpoint text, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
begin
  for a in update cloud.alerts set read_at = now()
            where account_id = p_account and task_id = p_task and read_at is null
              and (p_checkpoint is null or checkpoint_id = p_checkpoint)
              and (p_kind is null or kind = p_kind)
            returning * loop
    perform cloud.v1_emit(cloud.v1_task_workspace(p_task), 'alert.read', cloud.v1_alert_json(a), p_account);
  end loop;
end;
$$;

-- A guest's or another member's comment tells the task's creator; their own reads it.
create or replace function cloud.comment_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where id = new.task_id;
  if new.author ->> 'kind' = 'reviewer' or (new.author ->> 'kind' = 'user'
     and new.author ->> 'handle' is distinct from (select a.handle from cloud.accounts a where a.id = t.account_id)) then
    perform cloud.raise_alert(t, 'comment', new.checkpoint_id, new.id);
  else
    perform cloud.read_alerts_where(t.account_id, new.task_id, new.checkpoint_id, 'comment');
  end if;
  return null;
end;
$$;

create or replace function api.v1_list_alerts(p_account uuid, p_channel text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id desc) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then min(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select a.id, cloud.v1_alert_json(a) j, row_number() over (order by a.id desc) n
    from cloud.alerts a join cloud.tasks t on t.id = a.task_id
    where a.account_id = p_account and a.read_at is null and cloud.v1_in(p_account, t.workspace_id)
      and (p_channel is null or a.channel = p_channel) and (p_after is null or a.id < p_after)
    order by a.id desc limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

create or replace function api.v1_read_alert(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
  v_ws text;
begin
  select * into a from cloud.alerts where id = p_id and account_id = p_account;
  v_ws := cloud.v1_task_workspace(a.task_id);
  if a.id is null or not cloud.v1_in(p_account, v_ws) then perform cloud.v1_missing('alert'); end if;
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.read_alerts_where(p_account, a.task_id, a.checkpoint_id, a.kind);
  perform cloud.hint_desktop(p_account, 'inbox', jsonb_build_object('taskId', a.task_id));
  select * into a from cloud.alerts where id = p_id;
  return cloud.v1_alert_json(a);
end;
$$;

create or replace function api.list_desktop_alerts(p_subject uuid, p_machine uuid, p_comments boolean default false)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(cloud.v1_alert_json(a) order by a.id), '[]'::json)
  from cloud.alerts a join cloud.tasks t on t.id = a.task_id
  where a.account_id = p_subject and a.machine_id = p_machine and a.shown_at is null and a.read_at is null
    and cloud.v1_in(p_subject, t.workspace_id) and (p_comments or a.kind <> 'comment');
$$;

create or replace function api.runner_inbox(p_subject uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'review', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, c.id checkpoint, c.title detail,
               c.updated_at at,
               (select a.id from cloud.alerts a where a.checkpoint_id = c.id and a.kind = 'review' and a.read_at is null
                 order by a.id desc limit 1) alert
          from cloud.task_checkpoints c
          join cloud.tasks t on t.id = c.task_id
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and c.status = 'ready' and cloud.v1_in(p_subject, t.workspace_id)
           and t.status not in ('done', 'failed', 'cancelled')
         order by c.updated_at desc limit 200) x), '[]'::json),
    'running', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, null::text checkpoint,
               (select c.title from cloud.task_checkpoints c
                 where c.task_id = t.id and c.status <> 'approved' order by c.position limit 1) detail,
               t.created_at at, null::text alert
          from cloud.tasks t
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and t.status = 'running' and cloud.v1_in(p_subject, t.workspace_id)
         order by t.created_at desc limit 200) x), '[]'::json)
  );
$$;

-- ---------------------------------------------------------------------------
-- The Runner: the account's own computer, for the tasks it started
-- ---------------------------------------------------------------------------

create or replace function api.list_project_folders(p_subject uuid, p_machine uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(cloud.folder_json(f, p.name) order by lower(p.name), p.id), '[]'::json)
  from cloud.project_folders f join cloud.projects p on p.id = f.project_id
  where f.account_id = p_subject and f.machine_id = p_machine and cloud.v1_in(p_subject, p.workspace_id);
$$;

-- A folder becomes a project of the personal workspace.
create or replace function api.add_project_folder(
  p_subject uuid, p_machine uuid, p_name text, p_path text, p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  f cloud.project_folders;
  p cloud.projects;
  v_ws text := cloud.v1_personal(p_subject);
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    perform cloud.v1_refuse('This computer is not your connected Runner.');
  end if;
  select * into f from cloud.project_folders
   where account_id = p_subject and machine_id = p_machine and path = p_path;
  if found then
    select * into p from cloud.projects where id = f.project_id;
    return cloud.folder_json(f, p.name);
  end if;

  perform cloud.v1_write(p_subject, v_ws, p_daily_write_budget);
  insert into cloud.projects (id, account_id, workspace_id, name)
  values (cloud.v1_id('prj'), p_subject, v_ws, p_name) returning * into p;
  perform cloud.v1_emit(v_ws, 'project.created', cloud.v1_project_json(p));
  insert into cloud.project_folders (project_id, machine_id, account_id, path)
  values (p.id, p_machine, p_subject, p_path) returning * into f;
  return cloud.folder_json(f, p.name);
end;
$$;

-- A job of a task is the task's creator's to run, while they are in its workspace.
create or replace function api.dispatch_runner_job(
  p_subject uuid,
  p_runtime text,
  p_project text,
  p_prompt text,
  p_attachments jsonb,
  p_daily_write_budget integer,
  p_task text default null,
  p_stage text default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  v_folder cloud.project_folders;
  v_project text := p_project;
begin
  if not exists (select 1 from cloud.accounts where id = p_subject) then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;
  if p_task is not null then
    select project_id into v_project from cloud.tasks
     where id = p_task and account_id = p_subject and cloud.v1_in(p_subject, workspace_id);
    if not found then perform cloud.v1_missing('task'); end if;
    perform cloud.v1_task_open(p_task);
    if p_project is not null and p_project is distinct from v_project then
      perform cloud.v1_refuse('This task belongs to another project.');
    end if;
  end if;
  if v_project is not null then
    perform cloud.v1_workspace_of(p_subject, 'project', v_project);
    select f.* into v_folder from cloud.project_folders f
      left join cloud.runners r on r.owner_id = p_subject and r.machine_id = f.machine_id and r.live_until > now()
     where f.project_id = v_project and f.account_id = p_subject
     order by r.owner_id is not null desc, f.updated_at desc
     limit 1;
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, prompt, attachments)
  values (p_subject, p_runtime, v_project, v_folder.path, v_folder.machine_id, p_task, p_stage, p_prompt,
          coalesce(p_attachments, '[]'::jsonb))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;

create or replace function api.claim_runner_job(
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
  v_job cloud.runner_jobs;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    return json_build_object('claimed', false, 'reason', 'This computer is not your connected Runner.');
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job for update;
  if v_job.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such job.');
  end if;
  perform cloud.require_owner(v_job.owner_id, p_subject);
  if v_job.task_id is not null then
    if not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
      return json_build_object('claimed', false, 'reason', 'There is no such job.');
    end if;
    -- Two claims on one task wait for each other here, so only the first one runs.
    perform 1 from cloud.tasks where id = v_job.task_id for update;
  end if;
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
  end if;
  if cloud.runner_job_queued(v_job) then
    return json_build_object('claimed', false, 'reason', 'An earlier job of this task has not ended.');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.runner_jobs
     set state = 'claimed',
         claimed_machine = p_machine,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

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
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, attempt, resume, prompt,
                                   attachments)
    values (v_job.owner_id, v_job.runtime, v_job.project_id, v_job.project_dir, v_job.machine_id, v_job.task_id, v_job.stage, 2,
            v_job.resume, v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_outcome = 'done' and v_job.stage = 'plan' and v_job.task_id is not null
     and cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    perform cloud.v1_submit_draft(v_job.task_id);
  end if;

  if exists (select 1 from cloud.task_chats where job_id = p_job) then
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
      values (cloud.v1_id('msg'), v_job.task_id, v_job.owner_id, 'agent', v_reply);
    end if;
    update cloud.task_chats set
      job_id = v_retry.id,
      session = coalesce(p_report ->> 'session', session),
      session_runtime = case when p_report ->> 'session' is null then session_runtime else v_job.runtime end,
      context = coalesce(p_report -> 'context', context),
      failure = case v_outcome when 'failed' then
        case when v_reason = 'The card was updated elsewhere.' then 'conflict' else 'failed' end end,
      updated_at = now()
    where job_id = p_job;
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- The plans' keep: by the plan of each workspace's creator
-- ---------------------------------------------------------------------------

create or replace function api.v1_expiring_accounts(p_days integer, p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.id), '[]') from (
    select w.account_id id from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
     where t.status in ('done', 'failed', 'cancelled') and t.updated_at < now() - make_interval(days => p_days)
    union
    select j.owner_id from cloud.runner_jobs j
     where j.state = 'finished' and j.finished_at < now() - make_interval(days => p_days)
    limit p_limit
  ) x;
$$;

create or replace function api.v1_expired(p_account uuid, p_days integer, p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with t as (
    select t.id from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
     where w.account_id = p_account and t.status in ('done', 'failed', 'cancelled')
       and t.updated_at < now() - make_interval(days => p_days)
     order by t.updated_at limit p_limit
  ), a as (select id from cloud.artifacts where task_id in (select id from t))
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(id) from t), '[]'),
    'files', coalesce((select jsonb_agg(k) from (
        select v.file ->> 'key' k from cloud.artifact_versions v where v.artifact_id in (select id from a) and v.file is not null
        union
        select u.object_key from cloud.artifact_uploads u
         where u.artifact_id in (select id from a) and u.uploaded_at is not null and u.used_at is null) f), '[]'),
    'multipart', coalesce((select jsonb_agg(jsonb_build_object('key', u.object_key, 'id', u.multipart_id))
        from cloud.artifact_uploads u
       where u.artifact_id in (select id from a) and u.uploaded_at is null and u.multipart_id is not null), '[]'));
$$;

create or replace function api.v1_delete_expired(p_account uuid, p_days integer, p_tasks text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tasks text[];
  v_named text[];
  v_events integer;
  v_deleted integer;
  v_jobs integer;
begin
  select coalesce(array_agg(t.id), '{}') into v_tasks from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
   where w.account_id = p_account and t.id = any(p_tasks) and t.status in ('done', 'failed', 'cancelled')
     and t.updated_at < now() - make_interval(days => p_days);
  select v_tasks
         || coalesce((select array_agg(id) from cloud.task_checkpoints where task_id = any(v_tasks)), '{}')
         || coalesce((select array_agg(id) from cloud.artifacts where task_id = any(v_tasks)), '{}')
    into v_named;
  delete from cloud.api_events
   where workspace_id in (select w.id from cloud.v1_workspaces w where w.account_id = p_account)
     and (data ->> 'id' = any(v_named) or data ->> 'task' = any(v_named)
          or data ->> 'artifact' = any(v_named) or data ->> 'checkpoint' = any(v_named));
  get diagnostics v_events = row_count;
  delete from cloud.tasks where id = any(v_tasks);
  get diagnostics v_deleted = row_count;
  delete from cloud.runner_jobs
   where owner_id = p_account and state = 'finished' and finished_at < now() - make_interval(days => p_days);
  get diagnostics v_jobs = row_count;
  return jsonb_build_object('tasks', v_deleted, 'events', v_events, 'jobs', v_jobs);
end;
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
revoke all on function cloud.v1_add_personal() from public;
