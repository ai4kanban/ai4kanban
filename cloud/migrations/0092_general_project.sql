-- The workspace's built-in project is `general` (#2141): an ordinary project in every list, where a
-- task without one goes. `unfiled` becomes `general` throughout; a row still named `No project`
-- is renamed, one the user renamed keeps its name. It keeps `TASK` and still cannot be deleted.

alter table cloud.projects rename column unfiled to general;
alter index cloud.projects_one_unfiled rename to projects_one_general;
alter table cloud.projects rename constraint projects_unfiled_prefix to projects_general_prefix;
alter function cloud.v1_unfiled(text) rename to v1_general;

update cloud.projects set name = 'general', updated_at = now() where general and name = 'No project';

create or replace function cloud.v1_general(p_workspace text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
  p cloud.projects;
begin
  select * into p from cloud.projects where workspace_id = p_workspace and general;
  if found then return p.id; end if;
  select * into w from cloud.v1_workspaces where id = p_workspace;
  insert into cloud.projects (id, account_id, workspace_id, name, prefix, general)
  values (cloud.v1_id('prj'), w.account_id, p_workspace, 'general', 'TASK', true)
  on conflict (workspace_id) where general do nothing
  returning * into p;
  if not found then
    select * into p from cloud.projects where workspace_id = p_workspace and general;
    return p.id;
  end if;
  perform cloud.v1_emit(p_workspace, 'project.created', cloud.v1_project_json(p));
  return p.id;
end;
$$;

create or replace function cloud.v1_prefix_free(p_workspace text, p_prefix text, p_project text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from cloud.projects where workspace_id = p_workspace and prefix = p_prefix and id is distinct from p_project
  ) or (p_prefix = 'TASK' and not exists (select 1 from cloud.projects where id = p_project and general)) then
    perform cloud.v1_refuse('Another project already uses this prefix.');
  end if;
end;
$$;

create or replace function cloud.v1_project_json(p cloud.projects) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'object', 'project', 'workspace', p.workspace_id, 'name', p.name, 'path', p.path,
    'prefix', p.prefix, 'general', p.general,
    'created_at', cloud.v1_ts(p.created_at), 'updated_at', cloud.v1_ts(p.updated_at));
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
    select * into p from cloud.projects where id = p_project and not general;
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
  where not p.general and not exists (
    select 1 from cloud.project_folders f
    where f.project_id = p.id and f.account_id = p_subject and f.machine_id = p_machine);
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
  new.project_id := coalesce(new.project_id, cloud.v1_general(new.workspace_id));
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
  v_project := coalesce(v_project, cloud.v1_general(v_ws));
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

create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_general text;
  v_moved jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p.general then perform cloud.v1_refuse('This project cannot be deleted.'); end if;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    if not (select personal from cloud.v1_workspaces where id = v_ws) then
      perform cloud.v1_refuse('This project still has tasks. Move them to another project first.');
    end if;
    v_general := cloud.v1_general(v_ws);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_general, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
      if t.card_path is not null then
        v_moved := v_moved || jsonb_build_object('task', t.id, 'path', t.card_path, 'number', t.number);
      end if;
    end loop;
  end if;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true, 'moved', v_moved, 'general', v_general);
end;
$$;
