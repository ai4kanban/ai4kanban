-- A board moved on (#103): each account with a folder for a project it touched hears it, by project.
-- `p_projects` null is every project of the workspace (its shared memory changed); `p_machine` is
-- the computer that pushed it, which drops its own. A hint and nothing more: a failure is swallowed.
create function cloud.hint_board(p_workspace text, p_projects text[], p_head bigint, p_machine uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select distinct f.account_id, f.project_id from cloud.project_folders f
      join cloud.projects p on p.id = f.project_id
     where p.workspace_id = p_workspace and (p_projects is null or f.project_id = any (p_projects))
  loop
    perform cloud.hint_desktop(r.account_id, 'board',
      jsonb_strip_nulls(jsonb_build_object('board', r.project_id, 'head_seq', p_head, 'machine', p_machine)));
  end loop;
exception when others then
  null;
end;
$$;
revoke all on function cloud.hint_board(text, text[], bigint, uuid) from public;

create function api.hint_board(p_workspace text, p_projects text[], p_head bigint, p_machine uuid default null) returns void
language sql security definer set search_path = '' as $$
  select cloud.hint_board(p_workspace, p_projects, p_head, p_machine);
$$;
revoke all on function api.hint_board(text, text[], bigint, uuid) from public;
grant execute on function api.hint_board(text, text[], bigint, uuid) to service_role;
