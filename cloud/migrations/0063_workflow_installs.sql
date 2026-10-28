-- Workflow marketplace (#2030): a workspace runs only the official workflows it has installed,
-- besides its own.
--
-- - **Listed**: `workflow_listings` names the official workflows on offer. A new workspace gets
--   every listed one installed; one listed later is installed by hand. A new official workflow
--   needs its row here, in a migration (test/workflows.test.mjs checks).
-- - **Owners install**: installing and uninstalling are owner-only (AKB14); members use what is
--   installed. A task names its workflow version, so an uninstall or a new version never
--   reaches a task already made.

create table cloud.workflow_listings (
  workflow_id text primary key check (workflow_id like 'wf\_builtin\_%'),
  created_at timestamptz not null default now()
);
alter table cloud.workflow_listings enable row level security;

insert into cloud.workflow_listings (workflow_id) values
  ('wf_builtin_blog_post'), ('wf_builtin_carousel_post'), ('wf_builtin_coding'),
  ('wf_builtin_hyperframes_video'), ('wf_builtin_slide_deck'), ('wf_builtin_video_clone');

create table cloud.workflow_installs (
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  workflow_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, workflow_id)
);
alter table cloud.workflow_installs enable row level security;

insert into cloud.workflow_installs (workspace_id, workflow_id)
select w.id, l.workflow_id from cloud.v1_workspaces w cross join cloud.workflow_listings l;

create function cloud.v1_install_listed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.workflow_installs (workspace_id, workflow_id)
  select new.id, l.workflow_id from cloud.workflow_listings l;
  return null;
end;
$$;
create trigger v1_workspaces_install after insert on cloud.v1_workspaces
  for each row execute function cloud.v1_install_listed();

create function cloud.v1_installed(p_workspace text, p_workflow text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cloud.workflow_installs i where i.workspace_id = p_workspace and i.workflow_id = p_workflow);
$$;

create function api.v1_installed_workflows(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
begin
  return coalesce((select jsonb_agg(i.workflow_id order by i.workflow_id) from cloud.workflow_installs i
                    where i.workspace_id = v_ws), '[]');
end;
$$;

-- `p_installed` is what the workspace holds afterwards.
create function api.v1_install_workflow(
  p_account uuid, p_workspace text, p_workflow text, p_installed boolean, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  if p_installed = cloud.v1_installed(v_ws, p_workflow) then
    return jsonb_build_object('workspace', v_ws, 'installed', p_installed);
  end if;
  if p_installed then
    insert into cloud.workflow_installs (workspace_id, workflow_id) values (v_ws, p_workflow);
  else
    delete from cloud.workflow_installs where workspace_id = v_ws and workflow_id = p_workflow;
  end if;
  perform cloud.v1_emit(v_ws, case when p_installed then 'workflow.installed' else 'workflow.uninstalled' end,
    jsonb_build_object('id', p_workflow, 'object', 'workflow', 'builtin', true, 'workspace', v_ws, 'installed', p_installed));
  return jsonb_build_object('workspace', v_ws, 'installed', p_installed);
end;
$$;

-- An official workflow starts a task only where it is installed.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_max_tasks is not null
     and cloud.v1_open_tasks((select w.account_id from cloud.v1_workspaces w where w.id = v_ws)) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
  end if;
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
                           source_context, run)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce((p_fields ->> 'run')::boolean, false))
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
  return cloud.v1_task_json(t);
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
