-- A workspace's Runners (#2134): every computer that holds one of its projects, and an owner
-- removing one.
--
-- - **Every computer an account connected is kept**: `cloud.runners` stays the one live row per
--   account; `cloud.runner_machines` keeps each computer's name and when it was last active —
--   registering, renewing, claiming or finishing a job.
-- - **A workspace's Runners are its folders' computers**: a member's computer holding a folder of
--   one of its projects. Online is that account's Runner row, still live.
-- - **Removing is the workspace's only**: its folders on that computer go, and the computer claims
--   none of its jobs again until its owner places one of its projects there once more.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.runner_machines (
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  machine_id uuid not null,
  machine_name text not null default '',
  last_active_at timestamptz not null default now(),
  primary key (owner_id, machine_id)
);
alter table cloud.runner_machines enable row level security;

insert into cloud.runner_machines (owner_id, machine_id, machine_name, last_active_at)
select owner_id, machine_id, machine_name, updated_at from cloud.runners;

create table cloud.removed_runners (
  workspace_id text not null references cloud.v1_workspaces (id) on delete cascade,
  machine_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, machine_id)
);
alter table cloud.removed_runners enable row level security;

-- ---------------------------------------------------------------------------
-- Keeping them current
-- ---------------------------------------------------------------------------

create function cloud.runner_machine_seen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.runner_machines (owner_id, machine_id, machine_name)
  values (new.owner_id, new.machine_id, new.machine_name)
  on conflict (owner_id, machine_id) do update
     set machine_name = excluded.machine_name, last_active_at = now();
  return new;
end;
$$;

create trigger runner_machine_seen after insert or update of machine_id, machine_name, live_until on cloud.runners
for each row execute function cloud.runner_machine_seen();

create function cloud.runner_job_seen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cloud.runner_machines set last_active_at = now()
  where owner_id = new.owner_id and machine_id = new.claimed_machine;
  return new;
end;
$$;

create trigger runner_job_seen after update of state on cloud.runner_jobs
for each row when (new.claimed_machine is not null and new.state is distinct from old.state)
execute function cloud.runner_job_seen();

-- A folder placed again brings the computer back.
create function cloud.runner_folder_returns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from cloud.removed_runners
  where machine_id = new.machine_id
    and workspace_id = (select p.workspace_id from cloud.projects p where p.id = new.project_id);
  return new;
end;
$$;

create trigger runner_folder_returns after insert or update of project_id, machine_id on cloud.project_folders
for each row execute function cloud.runner_folder_returns();

-- The workspace a job belongs to: its task's, or its project's.
create function cloud.runner_job_removed(j cloud.runner_jobs, p_machine uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cloud.removed_runners x
    where x.machine_id = p_machine
      and x.workspace_id = coalesce((select t.workspace_id from cloud.tasks t where t.id = j.task_id),
                                    (select p.workspace_id from cloud.projects p where p.id = j.project_id)));
$$;
revoke all on function cloud.runner_job_removed(cloud.runner_jobs, uuid) from public;

-- ---------------------------------------------------------------------------
-- The Runner
-- ---------------------------------------------------------------------------

-- `name` is this computer's name, null when it gave none.
create or replace function api.read_runner(p_subject uuid)
returns json language sql security definer set search_path = '' as $$
  select (cloud.runner_json(r)::jsonb || jsonb_build_object('name', nullif(r.machine_name, '')))::json
  from cloud.runners r where r.owner_id = p_subject;
$$;

-- 0079's, without the jobs of a workspace that removed this computer.
create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_runner cloud.runners := cloud.runner_for(p_subject, p_machine);
begin
  if v_runner.owner_id is null then return '[]'::json; end if;
  perform cloud.v1_requeue_lapsed(p_subject);
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at, j.seq)
    from cloud.runner_jobs j
    where j.owner_id = p_subject
      and (j.machine_id is null or j.machine_id = p_machine)
      and (j.agent is null or v_runner.protocol >= 6 and exists (select 1 from cloud.project_folders f
                                      where f.project_id = j.project_id and f.machine_id = p_machine))
      and ((j.state = 'waiting' and not cloud.runner_job_queued(j) and not cloud.runner_job_removed(j, p_machine))
           or (j.state = 'claimed' and j.claimed_machine = p_machine and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
end;
$$;

-- 0059's, refusing a workspace's job on a computer it removed.
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
  t cloud.tasks;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    return json_build_object('claimed', false, 'reason', 'This computer is not your connected Runner.');
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such job.');
  end if;
  perform cloud.require_owner(v_job.owner_id, p_subject);
  if v_job.task_id is not null then
    if not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
      return json_build_object('claimed', false, 'reason', 'There is no such job.');
    end if;
    perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id));
    perform 1 from cloud.tasks where id = v_job.task_id for update;
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job for update;
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
  end if;
  if cloud.runner_job_removed(v_job, p_machine) then
    return json_build_object('claimed', false, 'reason', 'This computer was removed from that workspace.');
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
  if v_job.flow is not null then
    update cloud.tasks set status = 'running', updated_at = now() where id = v_job.task_id and status = 'queued'
    returning * into t;
    if t.id is not null then perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t)); end if;
  end if;
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

-- ---------------------------------------------------------------------------
-- A workspace's Runners
-- ---------------------------------------------------------------------------

create function api.v1_list_workspace_runners(p_account uuid, p_workspace text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
begin
  return jsonb_build_object('runners', coalesce((
    select jsonb_agg(jsonb_build_object('machine', x.machine_id, 'name', x.name, 'connected', x.connected,
                                        'last_active', x.last_active)
                     order by x.connected desc, x.last_active desc nulls last, x.machine_id)
    from (
      select f.machine_id,
             coalesce(max(nullif(m.machine_name, '')), '') as name,
             bool_or(r.live_until > now() and r.machine_id = f.machine_id) is true as connected,
             max(m.last_active_at) as last_active
      from cloud.project_folders f
      join cloud.projects p on p.id = f.project_id and p.workspace_id = v_ws
      join cloud.v1_workspace_members wm on wm.workspace_id = v_ws and wm.account_id = f.account_id
      left join cloud.runner_machines m on m.owner_id = f.account_id and m.machine_id = f.machine_id
      left join cloud.runners r on r.owner_id = f.account_id
      group by f.machine_id
    ) x), '[]'));
end;
$$;
revoke all on function api.v1_list_workspace_runners(uuid, text) from public;
grant execute on function api.v1_list_workspace_runners(uuid, text) to service_role;

create function api.v1_remove_workspace_runner(p_account uuid, p_workspace text, p_machine uuid, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'workspace', p_workspace);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  delete from cloud.project_folders f using cloud.projects p
  where p.id = f.project_id and p.workspace_id = v_ws and f.machine_id = p_machine;
  if not found then perform cloud.v1_missing('runner'); end if;
  insert into cloud.removed_runners (workspace_id, machine_id) values (v_ws, p_machine)
  on conflict do nothing;
  return jsonb_build_object('object', 'runner', 'workspace', v_ws, 'machine', p_machine, 'deleted', true);
end;
$$;
revoke all on function api.v1_remove_workspace_runner(uuid, text, uuid, integer) from public;
grant execute on function api.v1_remove_workspace_runner(uuid, text, uuid, integer) to service_role;
