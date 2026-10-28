-- Short task keys (#2034): every task is numbered within its project and read as `WC-12`.
--
-- - **The id stays the primary key**: `number` is unique per project; `key` is its prefix and
--   number.
-- - **Every task has a project**: one filed without lands in the account's inbox (`INBOX`),
--   made on first need. Deleting a project moves its tasks there.
-- - **A key once given keeps working**: a move or a prefix change files the old key in
--   `task_aliases`. A current key wins over an alias.

alter table cloud.projects
  add column prefix text,
  add column next_number integer not null default 1,
  add column inbox boolean not null default false;
alter table cloud.tasks add column number integer;

create table cloud.task_aliases (
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  prefix text not null,
  number integer not null,
  task_id text not null references cloud.tasks (id) on delete cascade,
  primary key (account_id, prefix, number)
);
create index task_aliases_task on cloud.task_aliases (task_id);
alter table cloud.task_aliases enable row level security;

-- The initials of the name's words (`WildCrane` → `WC`), at most four, `P` when it has none;
-- a number follows when the account already uses them.
create function cloud.v1_default_prefix(p_account uuid, p_name text) returns text
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
  while exists (select 1 from cloud.projects where account_id = p_account and prefix = v_prefix) loop
    n := n + 1;
    v_prefix := v_base || n;
  end loop;
  return v_prefix;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: prefixes, inboxes, numbers in creation order
-- ---------------------------------------------------------------------------

do $backfill$
declare
  p cloud.projects;
begin
  for p in select * from cloud.projects order by account_id, created_at, id loop
    update cloud.projects set prefix = cloud.v1_default_prefix(p.account_id, p.name) where id = p.id;
  end loop;
end
$backfill$;

insert into cloud.projects (id, account_id, name, prefix, inbox)
select distinct on (account_id) cloud.v1_id('prj'), account_id, 'Inbox', 'INBOX', true
from cloud.tasks where project_id is null;
update cloud.tasks t set project_id = p.id
from cloud.projects p where t.project_id is null and p.account_id = t.account_id and p.inbox;

update cloud.tasks t set number = n.number
from (select id, row_number() over (partition by project_id order by created_at, id) number from cloud.tasks) n
where n.id = t.id;
update cloud.projects p set next_number = coalesce((select max(number) from cloud.tasks where project_id = p.id), 0) + 1;

alter table cloud.projects
  alter column prefix set not null,
  add constraint projects_prefix check (prefix ~ '^[A-Z][A-Z0-9]{0,9}$'),
  add constraint projects_inbox_prefix check (inbox or prefix <> 'INBOX');
create unique index projects_prefix_unique on cloud.projects (account_id, prefix);
create unique index projects_one_inbox on cloud.projects (account_id) where inbox;

-- Moving a project's tasks to the inbox comes first; an account closing takes both at once.
alter table cloud.tasks
  alter column project_id set not null,
  alter column number set not null,
  drop constraint tasks_project_id_fkey,
  add constraint tasks_project_id_fkey foreign key (project_id) references cloud.projects (id),
  add constraint tasks_number unique (project_id, number);

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------

-- The account's inbox, made the first time a task needs it.
create function cloud.v1_inbox(p_account uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  select * into p from cloud.projects where account_id = p_account and inbox;
  if found then return p.id; end if;
  insert into cloud.projects (id, account_id, name, prefix, inbox)
  values (cloud.v1_id('prj'), p_account, 'Inbox', 'INBOX', true)
  on conflict (account_id) where inbox do nothing
  returning * into p;
  if not found then
    select * into p from cloud.projects where account_id = p_account and inbox;
    return p.id;
  end if;
  perform cloud.v1_emit(p_account, 'project.created', cloud.v1_project_json(p));
  return p.id;
end;
$$;

create function cloud.v1_project_prefix() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.prefix := coalesce(new.prefix, cloud.v1_default_prefix(new.account_id, new.name));
  return new;
end;
$$;
create trigger projects_prefix before insert on cloud.projects
  for each row execute function cloud.v1_project_prefix();

create function cloud.v1_project_aliases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.task_aliases (account_id, prefix, number, task_id)
  select new.account_id, old.prefix, t.number, t.id from cloud.tasks t where t.project_id = new.id
  on conflict (account_id, prefix, number) do update set task_id = excluded.task_id;
  return null;
end;
$$;
create trigger projects_aliases after update of prefix on cloud.projects
  for each row when (old.prefix is distinct from new.prefix) execute function cloud.v1_project_aliases();

-- The project's next number, taken under its row lock, so concurrent creates never share one.
create function cloud.v1_task_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is not distinct from old.project_id then return new; end if;
    insert into cloud.task_aliases (account_id, prefix, number, task_id)
    select old.account_id, p.prefix, old.number, old.id from cloud.projects p where p.id = old.project_id
    on conflict (account_id, prefix, number) do update set task_id = excluded.task_id;
  end if;
  new.project_id := coalesce(new.project_id, cloud.v1_inbox(new.account_id));
  update cloud.projects set next_number = next_number + 1 where id = new.project_id
  returning next_number - 1 into new.number;
  return new;
end;
$$;
create trigger tasks_number before insert or update of project_id on cloud.tasks
  for each row execute function cloud.v1_task_number();

-- ---------------------------------------------------------------------------
-- What a project and a task read as
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_project_json(p cloud.projects) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'object', 'project', 'name', p.name, 'path', p.path,
    'prefix', p.prefix, 'inbox', p.inbox,
    'created_at', cloud.v1_ts(p.created_at), 'updated_at', cloud.v1_ts(p.updated_at));
$$;

-- `key` is added around the task's own fields, so a migration replacing those keeps it.
alter function cloud.v1_task_json(cloud.tasks) rename to v1_task_fields_json;
create function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number);
$$;

-- The task a key names: the current one, else the task it once named.
create function api.v1_task_id(p_account uuid, p_prefix text, p_number integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id text;
begin
  select t.id into v_id from cloud.projects p join cloud.tasks t on t.project_id = p.id
   where p.account_id = p_account and p.prefix = p_prefix and t.number = p_number;
  if v_id is null then
    select task_id into v_id from cloud.task_aliases
     where account_id = p_account and prefix = p_prefix and number = p_number;
  end if;
  if v_id is null then perform cloud.v1_missing('task'); end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create function cloud.v1_prefix_free(p_account uuid, p_prefix text, p_project text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from cloud.projects where account_id = p_account and prefix = p_prefix and id is distinct from p_project
  ) or (p_prefix = 'INBOX' and not exists (select 1 from cloud.projects where id = p_project and inbox)) then
    perform cloud.v1_refuse('Another project already uses this prefix.');
  end if;
end;
$$;

create or replace function api.v1_create_project(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if p_fields ? 'prefix' then perform cloud.v1_prefix_free(p_account, p_fields ->> 'prefix', null); end if;
  insert into cloud.projects (id, account_id, name, path, prefix)
  values (cloud.v1_id('prj'), p_account, p_fields ->> 'name', coalesce(p_fields ->> 'path', ''), p_fields ->> 'prefix')
  returning * into p;
  perform cloud.v1_emit(p_account, 'project.created', cloud.v1_project_json(p));
  return cloud.v1_project_json(p);
end;
$$;

-- A new prefix moves every task's key; the old keys keep answering.
create or replace function api.v1_update_project(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('project'); end if;
  if p_fields ? 'prefix' then perform cloud.v1_prefix_free(p_account, p_fields ->> 'prefix', p_id); end if;
  update cloud.projects set
    name = coalesce(p_fields ->> 'name', name),
    path = coalesce(p_fields ->> 'path', path),
    prefix = coalesce(p_fields ->> 'prefix', prefix),
    updated_at = now()
  where id = p_id returning * into p;
  perform cloud.v1_emit(p_account, 'project.updated', cloud.v1_project_json(p));
  if p_fields ? 'prefix' then
    for t in select * from cloud.tasks where project_id = p_id loop
      perform cloud.v1_emit(p_account, 'task.updated', cloud.v1_task_json(t));
    end loop;
  end if;
  return cloud.v1_project_json(p);
end;
$$;

-- Its memory goes with it; its tasks move to the inbox, numbered anew.
create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  m cloud.memories;
  t cloud.tasks;
  v_inbox text;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('project'); end if;
  if p.inbox then perform cloud.v1_refuse('The inbox cannot be deleted.'); end if;
  for m in delete from cloud.memories where project_id = p_id returning * loop
    perform cloud.v1_emit(p_account, 'memory.deleted', cloud.v1_memory_json(m));
  end loop;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    v_inbox := cloud.v1_inbox(p_account);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_inbox, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(p_account, 'task.updated', cloud.v1_task_json(t));
    end loop;
  end if;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(p_account, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- Title, status and project. A finished task stays finished; `done` needs every checkpoint
-- approved.
create or replace function api.v1_update_task(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_status text := p_fields ->> 'status';
  v_project text := p_fields ->> 'project';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_id);
  if v_project is not null and not exists (
    select 1 from cloud.projects where id = v_project and account_id = p_account
  ) then
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
  perform cloud.v1_emit(p_account, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
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
    where (n.nspname = 'api' and p.proname = 'v1_task_id')
       or (n.nspname = 'cloud' and p.proname in ('v1_default_prefix', 'v1_inbox', 'v1_project_prefix',
             'v1_project_aliases', 'v1_task_number', 'v1_task_json', 'v1_task_fields_json', 'v1_prefix_free'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
