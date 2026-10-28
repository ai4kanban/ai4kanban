-- One board per workspace (#2114): every project's files sit under `projects/<id>/` in its
-- workspace's `Board`, the shared memory under `memory/`. Memory is board files only.
--
-- - **Parked, not lost**: the workspace memory rows move to `cloud.board_moves`, written into the
--   workspace's board both as shared memory and into its project for tasks with none, by
--   `scripts/board-move.mjs`, together with each project's old board.
-- - **No project, by name**: the inbox is `unfiled`, named `No project`, its tasks `TASK-n`;
--   the old `INBOX-n` keys are not kept.
-- - **A board queued to go is a workspace's**: a project's files go with `deleteProject`.

-- ---------------------------------------------------------------------------
-- The project for tasks with none
-- ---------------------------------------------------------------------------

alter table cloud.projects rename column inbox to unfiled;
alter table cloud.projects drop constraint projects_inbox_prefix;
alter index cloud.projects_one_inbox rename to projects_one_unfiled;

-- A project of the user's own already on `TASK` gives the prefix up first.
do $$
declare
  p cloud.projects;
  n integer;
begin
  for p in select * from cloud.projects where prefix = 'TASK' and not unfiled loop
    n := 2;
    while exists (select 1 from cloud.projects where workspace_id = p.workspace_id and prefix = 'TASK' || n) loop n := n + 1; end loop;
    update cloud.projects set prefix = 'TASK' || n, updated_at = now() where id = p.id;
  end loop;
end;
$$;

alter table cloud.projects disable trigger projects_aliases;
update cloud.projects set name = 'No project', prefix = 'TASK', updated_at = now() where unfiled;
alter table cloud.projects enable trigger projects_aliases;
delete from cloud.task_aliases where prefix = 'INBOX';

alter table cloud.projects add constraint projects_unfiled_prefix check (unfiled or prefix <> 'TASK');

drop function cloud.v1_inbox(text);

create function cloud.v1_unfiled(p_workspace text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
  p cloud.projects;
begin
  select * into p from cloud.projects where workspace_id = p_workspace and unfiled;
  if found then return p.id; end if;
  select * into w from cloud.v1_workspaces where id = p_workspace;
  insert into cloud.projects (id, account_id, workspace_id, name, prefix, unfiled)
  values (cloud.v1_id('prj'), w.account_id, p_workspace, 'No project', 'TASK', true)
  on conflict (workspace_id) where unfiled do nothing
  returning * into p;
  if not found then
    select * into p from cloud.projects where workspace_id = p_workspace and unfiled;
    return p.id;
  end if;
  perform cloud.v1_emit(p_workspace, 'project.created', cloud.v1_project_json(p));
  return p.id;
end;
$$;
revoke all on function cloud.v1_unfiled(text) from public;

create or replace function cloud.v1_project_json(p cloud.projects) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'object', 'project', 'workspace', p.workspace_id, 'name', p.name, 'path', p.path,
    'prefix', p.prefix, 'unfiled', p.unfiled,
    'created_at', cloud.v1_ts(p.created_at), 'updated_at', cloud.v1_ts(p.updated_at));
$$;

create or replace function cloud.v1_prefix_free(p_workspace text, p_prefix text, p_project text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from cloud.projects where workspace_id = p_workspace and prefix = p_prefix and id is distinct from p_project
  ) or (p_prefix = 'TASK' and not exists (select 1 from cloud.projects where id = p_project and unfiled)) then
    perform cloud.v1_refuse('Another project already uses this prefix.');
  end if;
end;
$$;

create or replace function cloud.v1_default_prefix(p_workspace text, p_name text) returns text
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
  while v_prefix = 'TASK' or exists (select 1 from cloud.projects where workspace_id = p_workspace and prefix = v_prefix) loop
    n := n + 1;
    v_prefix := v_base || n;
  end loop;
  return v_prefix;
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
  new.project_id := coalesce(new.project_id, cloud.v1_unfiled(new.workspace_id));
  update cloud.projects set next_number = next_number + 1 where id = new.project_id
  returning next_number - 1 into new.number;
  return new;
end;
$$;

create or replace function api.v1_create_triage(p_account uuid, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  v_source text := p_fields ->> 'source_task';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if v_source is not null then perform cloud.v1_workspace_of(p_account, 'task', v_source); end if;
  v_project := coalesce(v_project, cloud.v1_unfiled(v_ws));
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
  return cloud.v1_triage_json(i) || '{"created": true}';
end;
$$;

create or replace function api.add_project_folder(p_subject uuid, p_machine uuid, p_name text, p_path text,
                                                  p_daily_write_budget integer, p_project text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  f cloud.project_folders;
  p cloud.projects;
  v_ws text := cloud.v1_personal(p_subject);
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    perform cloud.v1_refuse('This computer is not your connected Runner.');
  end if;
  if p_project is not null then
    select * into p from cloud.projects where id = p_project and not unfiled;
    if not found or not cloud.v1_in(p_subject, p.workspace_id) then perform cloud.v1_missing('project'); end if;
  end if;
  select * into f from cloud.project_folders
   where account_id = p_subject and machine_id = p_machine and path = p_path;
  if found and (p_project is null or f.project_id = p_project) then
    select * into p from cloud.projects where id = f.project_id;
    return cloud.folder_json(f, p.name);
  end if;
  if found then
    raise exception 'That folder already belongs to another project.' using errcode = 'AKB29',
      detail = (select name from cloud.projects where id = f.project_id);
  end if;

  if p_project is not null then
    perform cloud.v1_write(p_subject, p.workspace_id, p_daily_write_budget);
    insert into cloud.project_folders (project_id, machine_id, account_id, path)
    values (p.id, p_machine, p_subject, p_path)
    on conflict (project_id, machine_id) do update set path = excluded.path, updated_at = now()
    returning * into f;
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

create or replace function api.list_elsewhere_projects(p_subject uuid, p_machine uuid) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('project', p.id, 'name', p.name, 'workspace', w.id,
    'workspace_name', w.name, 'personal', w.personal) order by w.personal desc, lower(w.name), lower(p.name), p.id), '[]'::json)
  from cloud.projects p
  join cloud.v1_workspaces w on w.id = p.workspace_id
  join cloud.v1_workspace_members m on m.workspace_id = w.id and m.account_id = p_subject
  where not p.unfiled and not exists (
    select 1 from cloud.project_folders f
    where f.project_id = p.id and f.account_id = p_subject and f.machine_id = p_machine);
$$;

-- In a personal workspace its tasks move to the one with no project; elsewhere they are moved first.
create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_unfiled text;
  v_moved jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p.unfiled then perform cloud.v1_refuse('This project cannot be deleted.'); end if;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    if not (select personal from cloud.v1_workspaces where id = v_ws) then
      perform cloud.v1_refuse('This project still has tasks. Move them to another project first.');
    end if;
    v_unfiled := cloud.v1_unfiled(v_ws);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_unfiled, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
      if t.card_path is not null then v_moved := v_moved || jsonb_build_object('task', t.id, 'path', t.card_path); end if;
    end loop;
  end if;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true, 'moved', v_moved, 'unfiled', v_unfiled);
end;
$$;

-- ---------------------------------------------------------------------------
-- Memory is board files
-- ---------------------------------------------------------------------------

create table cloud.board_moves (
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  path text not null,
  content text,
  primary key (workspace_id, path)
);
alter table cloud.board_moves enable row level security;

-- Every workspace has a row to move, a null one when it has no memory.
insert into cloud.board_moves (workspace_id, path, content)
select w.id, '', null from cloud.v1_workspaces w;

insert into cloud.board_moves (workspace_id, path, content)
select m.workspace_id, 'memory/' || m.name, m.body from cloud.memories m where m.scope = 'workspace'
on conflict do nothing;

insert into cloud.board_moves (workspace_id, path, content)
select m.workspace_id, 'projects/' || cloud.v1_unfiled(m.workspace_id) || '/memory/' || m.name, m.body
from cloud.memories m where m.scope = 'workspace'
on conflict do nothing;

drop function api.v1_list_memories(uuid, text, text, text, text, text, integer);
drop function api.v1_create_memory(uuid, jsonb, integer);
drop function api.v1_update_memory(uuid, text, jsonb, integer);
drop function api.v1_delete_memory(uuid, text, integer);
drop function api.v1_memory(uuid, text);
drop function cloud.v1_memory_json(cloud.memories);
drop table cloud.memories;

create or replace function cloud.v1_workspace_of(p_account uuid, p_kind text, p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  v := case p_kind
    when 'workspace' then (select w.id from cloud.v1_workspaces w where w.id = p_id)
    when 'project' then (select p.workspace_id from cloud.projects p where p.id = p_id)
    when 'workflow' then (select w.workspace_id from cloud.workflows w where w.id = p_id)
    when 'task' then cloud.v1_task_workspace(p_id)
    when 'artifact' then (select cloud.v1_task_workspace(a.task_id) from cloud.artifacts a where a.id = p_id)
    when 'upload' then (select cloud.v1_task_workspace(a.task_id)
                          from cloud.artifact_uploads u join cloud.artifacts a on a.id = u.artifact_id where u.id = p_id)
    when 'share link' then (select cloud.v1_task_workspace(l.task_id) from cloud.share_links l where l.id = p_id)
  end;
  if v is null or not cloud.v1_in(p_account, v) then perform cloud.v1_missing(p_kind); end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Worker's side
-- ---------------------------------------------------------------------------

-- The workspace whose board holds a project's files; the Worker keeps the answer.
create function api.v1_board_of(p_project text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text := (select p.workspace_id from cloud.projects p where p.id = p_project);
begin
  if v is null then perform cloud.v1_missing('project'); end if;
  return v;
end;
$$;

drop function api.v1_board_import(text);
drop function api.v1_board_imported(text, jsonb);

-- What a workspace still has to move: its projects, whose old boards are named by their ids, and
-- the files parked for it. Nothing once moved.
create function api.v1_board_move(p_workspace text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'projects', case when exists (select 1 from cloud.board_moves where workspace_id = p_workspace)
      then coalesce((select jsonb_agg(p.id order by p.id) from cloud.projects p where p.workspace_id = p_workspace), '[]')
      else '[]' end,
    'files', coalesce((
      select jsonb_agg(jsonb_build_object('path', f.path, 'content', f.content) order by f.path) from (
        select b.path, b.content from cloud.board_moves b where b.workspace_id = p_workspace and b.content is not null
        union all
        select 'projects/' || i.project_id || '/' || i.path, i.content
          from cloud.board_import i join cloud.projects p on p.id = i.project_id
         where p.workspace_id = p_workspace and exists (select 1 from cloud.board_moves where workspace_id = p_workspace)
      ) f), '[]'));
$$;

-- Moved: each card's `card_version` is its new `seq`, and the old boards are queued to go.
create function api.v1_board_moved(p_workspace text, p_cards jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update cloud.tasks t set card_version = (e ->> 'seq')::integer
    from jsonb_array_elements(coalesce(p_cards, '[]')) e
   where t.id = e ->> 'task' and t.card_path = e ->> 'path' and t.workspace_id = p_workspace;
  get diagnostics n = row_count;
  insert into cloud.dropped_boards (board) select p.id from cloud.projects p where p.workspace_id = p_workspace
  on conflict do nothing;
  delete from cloud.board_import i using cloud.projects p where p.id = i.project_id and p.workspace_id = p_workspace;
  delete from cloud.board_moves where workspace_id = p_workspace;
  return jsonb_build_object('indexed', n);
end;
$$;

-- A queued board is named by what it was named for: a workspace now, a project before.
alter table cloud.dropped_boards rename column project_id to board;
drop trigger drop_board on cloud.projects;

create or replace function cloud.drop_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.dropped_boards (board) values (old.id) on conflict do nothing;
  return old;
end;
$$;
create trigger drop_board after delete on cloud.v1_workspaces for each row execute function cloud.drop_board();

create or replace function api.v1_dropped_boards(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(board), '[]') from (
    select board from cloud.dropped_boards where dropped_at < now() - interval '10 minutes'
     order by dropped_at limit p_limit) b;
$$;

create or replace function api.v1_forget_boards(p_ids text[]) returns integer
language sql security definer set search_path = '' as $$
  with d as (delete from cloud.dropped_boards where board = any(p_ids) returning 1)
  select count(*)::integer from d;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api' and p.proname in ('v1_board_of', 'v1_board_move', 'v1_board_moved')
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$grants$;
