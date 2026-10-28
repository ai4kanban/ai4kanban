-- The desktop Runner (#2005): a project's folder on one computer, jobs sent only to that
-- computer, and alerts raised once — on the desktop when it can show one, on the web otherwise.
--
-- - **A folder is a computer and a path**: one per project per computer. The Runner's own
--   allow list stays on the computer; this row only decides where a project's job goes.
-- - **An alert is raised once**: a checkpoint ready for review, or a task done or failed.
--   Its channel is chosen as it is raised — the account's connected Runner when it shows
--   notifications and the project's bell is on there, the web otherwise. Reading it anywhere
--   reads it everywhere; deciding the checkpoint reads it too.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.project_folders (
  project_id text not null references cloud.projects (id) on delete cascade,
  machine_id uuid not null,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  path text not null check (length(path) between 1 and 1024),
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, machine_id),
  unique (account_id, machine_id, path)
);
alter table cloud.project_folders enable row level security;

-- Whether the Runner shows notifications: the desktop app, switched on, and allowed by the system.
alter table cloud.runners add column notify boolean not null default false;

alter table cloud.runner_jobs
  add column project_id text references cloud.projects (id) on delete set null,
  -- The one computer that may run it, when its project has a folder there.
  add column machine_id uuid;

create table cloud.alerts (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  kind text not null check (kind in ('review', 'done', 'failed')),
  task_id text not null references cloud.tasks (id) on delete cascade,
  checkpoint_id text references cloud.task_checkpoints (id) on delete cascade,
  channel text not null check (channel in ('desktop', 'web')),
  machine_id uuid,
  shown_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((channel = 'desktop') = (machine_id is not null))
);
create index alerts_unread on cloud.alerts (account_id, id) where read_at is null;
create index alerts_task on cloud.alerts (task_id);
alter table cloud.alerts enable row level security;

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_json(p_runner cloud.runners)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'machineId', p_runner.machine_id,
    'machineName', p_runner.machine_name,
    'protocol', p_runner.protocol,
    'version', p_runner.version,
    'runtimes', p_runner.runtimes,
    'notify', p_runner.notify,
    'connected', p_runner.live_until > now()
  );
$$;

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'project', p_job.project_id,
    'projectDir', p_job.project_dir,
    'prompt', p_job.prompt,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;

create function cloud.v1_alert_json(a cloud.alerts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'alert', 'kind', a.kind, 'task', a.task_id,
    'task_title', t.title, 'project', t.project_id, 'checkpoint', a.checkpoint_id,
    'checkpoint_title', c.title, 'channel', a.channel, 'read', a.read_at is not null,
    'created_at', cloud.v1_ts(a.created_at))
  from cloud.tasks t left join cloud.task_checkpoints c on c.id = a.checkpoint_id
  where t.id = a.task_id;
$$;

-- ---------------------------------------------------------------------------
-- Registering: now says whether this computer shows notifications
-- ---------------------------------------------------------------------------

drop function api.register_runner(uuid, uuid, text, integer, text, jsonb, integer, integer);

create function api.register_runner(
  p_subject uuid,
  p_machine uuid,
  p_machine_name text,
  p_protocol integer,
  p_version text,
  p_runtimes jsonb,
  p_notify boolean,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runner cloud.runners;
  v_until timestamptz := now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60));
begin
  if not exists (select 1 from cloud.accounts where id = p_subject) then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;

  select * into v_runner from cloud.runners where owner_id = p_subject for update;
  if v_runner.owner_id is not null
     and v_runner.machine_id <> p_machine
     and v_runner.live_until > now() then
    raise exception 'Your WildCrane Runner is already connected on %.',
      coalesce(nullif(v_runner.machine_name, ''), 'another computer')
      using errcode = 'AKB22';
  end if;

  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runners (owner_id, machine_id, machine_name, protocol, version, runtimes, notify, live_until)
  values (p_subject, p_machine, coalesce(p_machine_name, ''), p_protocol, coalesce(p_version, ''),
          coalesce(p_runtimes, '[]'::jsonb), coalesce(p_notify, false), v_until)
  on conflict (owner_id) do update
     set machine_id = excluded.machine_id,
         machine_name = excluded.machine_name,
         protocol = excluded.protocol,
         version = excluded.version,
         runtimes = excluded.runtimes,
         notify = excluded.notify,
         live_until = excluded.live_until,
         updated_at = now()
  returning * into v_runner;
  return cloud.runner_json(v_runner);
end;
$$;
revoke all on function api.register_runner(uuid, uuid, text, integer, text, jsonb, boolean, integer, integer) from public;
grant execute on function api.register_runner(uuid, uuid, text, integer, text, jsonb, boolean, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Folders on this computer
-- ---------------------------------------------------------------------------

create function cloud.folder_json(p_folder cloud.project_folders, p_name text)
returns json language sql stable set search_path = '' as $$
  select json_build_object('project', p_folder.project_id, 'name', p_name, 'path', p_folder.path,
    'notify', p_folder.notify);
$$;
revoke all on function cloud.folder_json(cloud.project_folders, text) from public;

create function api.list_project_folders(p_subject uuid, p_machine uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(cloud.folder_json(f, p.name) order by lower(p.name), p.id), '[]'::json)
  from cloud.project_folders f join cloud.projects p on p.id = f.project_id
  where f.account_id = p_subject and f.machine_id = p_machine;
$$;
revoke all on function api.list_project_folders(uuid, uuid) from public;
grant execute on function api.list_project_folders(uuid, uuid) to service_role;

-- A new project, named after the folder, placed on this computer. Only the connected Runner
-- adds one, and a folder already added answers the project it already holds.
create function api.add_project_folder(
  p_subject uuid, p_machine uuid, p_name text, p_path text, p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  f cloud.project_folders;
  p cloud.projects;
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

  perform cloud.v1_write(p_subject, p_daily_write_budget);
  insert into cloud.projects (id, account_id, name)
  values (cloud.v1_id('prj'), p_subject, p_name) returning * into p;
  perform cloud.v1_emit(p_subject, 'project.created', cloud.v1_project_json(p));
  insert into cloud.project_folders (project_id, machine_id, account_id, path)
  values (p.id, p_machine, p_subject, p_path) returning * into f;
  return cloud.folder_json(f, p.name);
end;
$$;
revoke all on function api.add_project_folder(uuid, uuid, text, text, integer) from public;
grant execute on function api.add_project_folder(uuid, uuid, text, text, integer) to service_role;

-- Takes the project off this computer. The project itself stays.
create function api.remove_project_folder(p_subject uuid, p_machine uuid, p_project text, p_daily_write_budget integer)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.count_write(p_daily_write_budget);
  delete from cloud.project_folders
   where account_id = p_subject and machine_id = p_machine and project_id = p_project;
  return json_build_object('removed', found);
end;
$$;
revoke all on function api.remove_project_folder(uuid, uuid, text, integer) from public;
grant execute on function api.remove_project_folder(uuid, uuid, text, integer) to service_role;

create function api.set_project_folder_notify(
  p_subject uuid, p_machine uuid, p_project text, p_notify boolean, p_daily_write_budget integer
) returns json language plpgsql security definer set search_path = '' as $$
declare
  f cloud.project_folders;
begin
  perform cloud.count_write(p_daily_write_budget);
  update cloud.project_folders set notify = p_notify, updated_at = now()
   where account_id = p_subject and machine_id = p_machine and project_id = p_project
  returning * into f;
  if not found then perform cloud.v1_missing('project on this computer'); end if;
  return cloud.folder_json(f, (select name from cloud.projects where id = f.project_id));
end;
$$;
revoke all on function api.set_project_folder_notify(uuid, uuid, text, boolean, integer) from public;
grant execute on function api.set_project_folder_notify(uuid, uuid, text, boolean, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Jobs: a project's job goes to the computer holding its folder
-- ---------------------------------------------------------------------------

drop function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer);

-- With a project placed on a computer, the job runs in that folder on that computer — the
-- connected Runner's when it holds one. Without, it runs in the Runner's own folder.
create function api.dispatch_runner_job(
  p_subject uuid,
  p_runtime text,
  p_project text,
  p_prompt text,
  p_attachments jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  v_folder cloud.project_folders;
begin
  if not exists (select 1 from cloud.accounts where id = p_subject) then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;
  if p_project is not null then
    if not exists (select 1 from cloud.projects where id = p_project and account_id = p_subject) then
      perform cloud.v1_missing('project');
    end if;
    select f.* into v_folder from cloud.project_folders f
      left join cloud.runners r on r.owner_id = p_subject and r.machine_id = f.machine_id and r.live_until > now()
     where f.project_id = p_project
     order by r.owner_id is not null desc, f.updated_at desc
     limit 1;
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, prompt, attachments)
  values (p_subject, p_runtime, p_project, v_folder.path, v_folder.machine_id, p_prompt,
          coalesce(p_attachments, '[]'::jsonb))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;
revoke all on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer) from public;
grant execute on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer) to service_role;

create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at)
    from cloud.runner_jobs j
    where j.owner_id = p_subject
      and (j.machine_id is null or j.machine_id = p_machine)
      and (j.state = 'waiting'
           or (j.state = 'claimed' and j.claimed_machine = p_machine and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
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
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
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

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

-- A hint on the Runner's topic. `inbox` when what needs the user changed, `alert` when there
-- is something to show. Swallowed on failure, like every hint.
create function cloud.hint_desktop(p_owner uuid, p_event text, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, 'runner:' || p_owner::text, true);
exception when others then
  null;
end;
$$;
revoke all on function cloud.hint_desktop(uuid, text, jsonb) from public;

-- Raise one alert, on the one place best placed to show it.
create function cloud.raise_alert(p_task cloud.tasks, p_kind text, p_checkpoint text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runners;
  a cloud.alerts;
  v_desktop boolean;
begin
  select * into r from cloud.runners where owner_id = p_task.account_id and live_until > now() and notify;
  v_desktop := r.owner_id is not null and not exists (
    select 1 from cloud.project_folders f
     where f.project_id = p_task.project_id and f.machine_id = r.machine_id and not f.notify);
  insert into cloud.alerts (id, account_id, kind, task_id, checkpoint_id, channel, machine_id)
  values (cloud.v1_id('alr'), p_task.account_id, p_kind, p_task.id, p_checkpoint,
          case when v_desktop then 'desktop' else 'web' end, case when v_desktop then r.machine_id end)
  returning * into a;
  perform cloud.v1_emit(a.account_id, 'alert.created', cloud.v1_alert_json(a));
  if v_desktop then perform cloud.hint_desktop(a.account_id, 'alert', jsonb_build_object('alertId', a.id)); end if;
end;
$$;
revoke all on function cloud.raise_alert(cloud.tasks, text, text) from public;

-- Null narrows nothing: a checkpoint's alerts, a kind's, or the whole task's.
create function cloud.read_alerts_where(p_account uuid, p_task text, p_checkpoint text, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
begin
  for a in update cloud.alerts set read_at = now()
            where account_id = p_account and task_id = p_task and read_at is null
              and (p_checkpoint is null or checkpoint_id = p_checkpoint)
              and (p_kind is null or kind = p_kind)
            returning * loop
    perform cloud.v1_emit(p_account, 'alert.read', cloud.v1_alert_json(a));
  end loop;
end;
$$;
revoke all on function cloud.read_alerts_where(uuid, text, text, text) from public;

create function cloud.checkpoint_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'ready' then
    perform cloud.raise_alert((select t from cloud.tasks t where t.id = new.task_id), 'review', new.id);
  elsif old.status = 'ready' then
    -- Decided: there is nothing left to review.
    perform cloud.read_alerts_where(new.account_id, new.task_id, new.id, null);
  end if;
  perform cloud.hint_desktop(new.account_id, 'inbox', jsonb_build_object('taskId', new.task_id));
  return null;
end;
$$;
create trigger checkpoint_alerts after update of status on cloud.task_checkpoints
  for each row execute function cloud.checkpoint_alerts();

create function cloud.task_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status in ('done', 'failed', 'cancelled') then
    perform cloud.read_alerts_where(new.account_id, new.id, null, 'review');
  end if;
  if new.status in ('done', 'failed') then perform cloud.raise_alert(new, new.status, null); end if;
  perform cloud.hint_desktop(new.account_id, 'inbox', jsonb_build_object('taskId', new.id));
  return null;
end;
$$;
create trigger task_alerts after update of status on cloud.tasks
  for each row execute function cloud.task_alerts();

-- The web's alerts: unread, newest first.
create function api.v1_list_alerts(p_account uuid, p_channel text, p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.id desc) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit) then min(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select a.id, cloud.v1_alert_json(a) j, row_number() over (order by a.id desc) n
    from cloud.alerts a
    where a.account_id = p_account and a.read_at is null
      and (p_channel is null or a.channel = p_channel) and (p_after is null or a.id < p_after)
    order by a.id desc limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

-- Read one alert, and with it every unread one on the same task and checkpoint.
create function api.v1_read_alert(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into a from cloud.alerts where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('alert'); end if;
  perform cloud.read_alerts_where(p_account, a.task_id, a.checkpoint_id, a.kind);
  perform cloud.hint_desktop(p_account, 'inbox', jsonb_build_object('taskId', a.task_id));
  select * into a from cloud.alerts where id = p_id;
  return cloud.v1_alert_json(a);
end;
$$;

-- What the desktop has to show: its own alerts, unread and not yet shown.
create function api.list_desktop_alerts(p_subject uuid, p_machine uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(cloud.v1_alert_json(a) order by a.id), '[]'::json)
  from cloud.alerts a
  where a.account_id = p_subject and a.machine_id = p_machine and a.shown_at is null and a.read_at is null;
$$;
revoke all on function api.list_desktop_alerts(uuid, uuid) from public;
grant execute on function api.list_desktop_alerts(uuid, uuid) to service_role;

create function api.show_desktop_alert(p_subject uuid, p_machine uuid, p_alert text, p_daily_write_budget integer)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.count_write(p_daily_write_budget);
  update cloud.alerts set shown_at = now()
   where id = p_alert and account_id = p_subject and machine_id = p_machine and shown_at is null;
  return json_build_object('shown', found);
end;
$$;
revoke all on function api.show_desktop_alert(uuid, uuid, text, integer) from public;
grant execute on function api.show_desktop_alert(uuid, uuid, text, integer) to service_role;

-- What needs the user, for the menu bar: checkpoints waiting for review and tasks running,
-- newest first, each with its project and whether it is still unread.
create function api.runner_inbox(p_subject uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'review', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, c.id checkpoint, c.title detail,
               c.updated_at at,
               (select a.id from cloud.alerts a where a.checkpoint_id = c.id and a.read_at is null
                 order by a.id desc limit 1) alert
          from cloud.task_checkpoints c
          join cloud.tasks t on t.id = c.task_id
          left join cloud.projects p on p.id = t.project_id
         where c.account_id = p_subject and c.status = 'ready'
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
         where t.account_id = p_subject and t.status = 'running'
         order by t.created_at desc limit 200) x), '[]'::json)
  );
$$;
revoke all on function api.runner_inbox(uuid) from public;
grant execute on function api.runner_inbox(uuid) to service_role;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname in ('v1_list_alerts', 'v1_read_alert'))
       or (n.nspname = 'cloud' and p.proname in ('v1_alert_json', 'checkpoint_alerts', 'task_alerts'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;

-- The sweep keeps a month of read alerts.
create or replace function api.v1_sweep() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_events integer;
  v_replays integer;
  v_uploads integer;
  v_alerts integer;
begin
  delete from cloud.api_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from cloud.api_idempotency where created_at < now() - interval '1 day';
  get diagnostics v_replays = row_count;
  delete from cloud.artifact_uploads where used_at is null and expires_at < now() - interval '1 day';
  get diagnostics v_uploads = row_count;
  delete from cloud.alerts where read_at < now() - interval '30 days';
  get diagnostics v_alerts = row_count;
  return jsonb_build_object('events', v_events, 'replays', v_replays, 'uploads', v_uploads, 'alerts', v_alerts);
end;
$$;
