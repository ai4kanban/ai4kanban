-- Every workspace has an inbox (#2061): a task filed without a project lands in its own
-- workspace's, made the first time one needs it, shared or personal alike.

create or replace function cloud.v1_inbox(p_workspace text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  w cloud.v1_workspaces;
  p cloud.projects;
begin
  select * into p from cloud.projects where workspace_id = p_workspace and inbox;
  if found then return p.id; end if;
  select * into w from cloud.v1_workspaces where id = p_workspace;
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
