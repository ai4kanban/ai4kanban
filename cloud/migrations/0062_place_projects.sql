-- An existing project placed on this computer (#2022): one the account removed, a teammate's,
-- or one made on another computer. Any member who sees a project may place it on their own
-- Runner; the Runner checks the folder, this only refuses a folder held by another project.

-- AKB29  The folder already belongs to another project on this computer; `detail` names it.
--        The Worker answers 409 `folder_taken`.

-- With `p_project`, places that project instead of making one.
drop function api.add_project_folder(uuid, uuid, text, text, integer);
create function api.add_project_folder(
  p_subject uuid, p_machine uuid, p_name text, p_path text, p_daily_write_budget integer, p_project text default null
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
  if p_project is not null then
    select * into p from cloud.projects where id = p_project and not inbox;
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

revoke all on function api.add_project_folder(uuid, uuid, text, text, integer, text) from public;
grant execute on function api.add_project_folder(uuid, uuid, text, text, integer, text) to service_role;

-- The projects of every workspace the account is in that have no folder on this computer.
create function api.list_elsewhere_projects(p_subject uuid, p_machine uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('project', p.id, 'name', p.name, 'workspace', w.id,
    'workspace_name', w.name, 'personal', w.personal) order by w.personal desc, lower(w.name), lower(p.name), p.id), '[]'::json)
  from cloud.projects p
  join cloud.v1_workspaces w on w.id = p.workspace_id
  join cloud.v1_workspace_members m on m.workspace_id = w.id and m.account_id = p_subject
  where not p.inbox and not exists (
    select 1 from cloud.project_folders f
    where f.project_id = p.id and f.account_id = p_subject and f.machine_id = p_machine);
$$;

revoke all on function api.list_elsewhere_projects(uuid, uuid) from public;
grant execute on function api.list_elsewhere_projects(uuid, uuid) to service_role;

-- Each project says whether it is on the account's Runner computer.
create or replace function api.v1_list_projects(p_account uuid, p_workspace text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select p.id, cloud.v1_project_json(p) || jsonb_build_object('placed', exists (
        select 1 from cloud.project_folders f join cloud.runners r on r.owner_id = f.account_id and r.machine_id = f.machine_id
        where f.project_id = p.id and f.account_id = p_account)) j,
      row_number() over (order by p.id) n
    from cloud.projects p
    where p.workspace_id = cloud.v1_target(p_account, p_workspace, null) and (p_after is null or p.id > p_after)
    order by p.id limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;
