-- The account's Local Runner, and the jobs it runs (#2001).
--
-- A Runner is the one computer an account connects. Cloud hands it jobs — a runtime, a
-- folder, a prompt and a few attachments — and it claims each under a lease, runs it locally
-- and reports the output and how it ended. Same rules as 0005's board server, keyed on the
-- account instead of a board: one Runner per account, one claim per job, and an expired
-- lease reads as interrupted. An interrupted job is never run again.
--
-- The version a Runner launches is Cloud's call too: `cloud.runner_release` names the stable
-- version and an optional candidate rolled out to a share of machines.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB22  another computer is this account's Runner, and it is still connected. The refusal
--        names that computer.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per account. Another computer takes the row over once the one holding it has
-- released it or stopped renewing it.
create table cloud.runners (
  owner_id uuid primary key references cloud.accounts (id) on delete cascade,
  machine_id uuid not null,
  machine_name text not null default '',
  protocol integer not null,
  version text not null default '',
  runtimes jsonb not null default '[]'::jsonb,
  -- Until when this computer counts as connected. Every register renews it.
  live_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table cloud.runners enable row level security;

create table cloud.runner_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud.accounts (id) on delete cascade,
  runtime text not null check (runtime in ('codex', 'claude-code')),
  -- A project's folder on the Runner's computer, or null for the Runner's own folder.
  project_dir text,
  prompt text not null,
  attachments jsonb not null default '[]'::jsonb,
  state text not null default 'waiting' check (state in ('waiting', 'claimed', 'finished')),
  outcome text check (outcome in ('done', 'failed')),
  reason text,
  claimed_machine uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index runner_jobs_live on cloud.runner_jobs (owner_id) where state <> 'finished';
alter table cloud.runner_jobs enable row level security;

-- Output, in batches. `seq` is the Runner's own count, so a retried batch lands once.
create table cloud.runner_job_events (
  job_id uuid not null references cloud.runner_jobs (id) on delete cascade,
  seq integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  primary key (job_id, seq)
);
alter table cloud.runner_job_events enable row level security;

create table cloud.runner_release (
  id boolean primary key default true check (id),
  stable text,
  candidate text,
  candidate_percent integer not null default 0 check (candidate_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
alter table cloud.runner_release enable row level security;
insert into cloud.runner_release (id) values (true);

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_job_interrupted(p_job cloud.runner_jobs)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_job.state = 'claimed' and p_job.lease_expires_at < now();
$$;
revoke all on function cloud.runner_job_interrupted(cloud.runner_jobs) from public;

create or replace function cloud.runner_json(p_runner cloud.runners)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'machineId', p_runner.machine_id,
    'machineName', p_runner.machine_name,
    'protocol', p_runner.protocol,
    'version', p_runner.version,
    'runtimes', p_runner.runtimes,
    'connected', p_runner.live_until > now()
  );
$$;
revoke all on function cloud.runner_json(cloud.runners) from public;

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
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
revoke all on function cloud.runner_job_json(cloud.runner_jobs) from public;

-- ---------------------------------------------------------------------------
-- The Runner's private Realtime topic: `runner:<account id>`
-- ---------------------------------------------------------------------------

create policy "a runner receives its own broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.messages.extension) = 'broadcast'
    and realtime.topic() = 'runner:' || (select auth.uid())::text
  );

-- A hint and nothing more: the catch-up read on every connect is what makes the durable
-- write enough on its own, so a failed send is swallowed.
create or replace function cloud.hint_runner(p_owner uuid, p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    json_build_object('jobId', p_job::text)::jsonb,
    'job',
    'runner:' || p_owner::text,
    true
  );
exception when others then
  null;
end;
$$;
revoke all on function cloud.hint_runner(uuid, uuid) from public;

-- The account's Runner, when the calling computer is it. Null otherwise.
create or replace function cloud.runner_for(p_subject uuid, p_machine uuid)
returns cloud.runners
language sql
stable
set search_path = ''
as $$
  select * from cloud.runners
   where owner_id = p_subject and machine_id = p_machine and live_until > now();
$$;
revoke all on function cloud.runner_for(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Registering
-- ---------------------------------------------------------------------------

-- Register this computer as the account's Runner, or renew it. A second computer is refused
-- while the first is connected, and the refusal names it.
create or replace function api.register_runner(
  p_subject uuid,
  p_machine uuid,
  p_machine_name text,
  p_protocol integer,
  p_version text,
  p_runtimes jsonb,
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
  insert into cloud.runners (owner_id, machine_id, machine_name, protocol, version, runtimes, live_until)
  values (p_subject, p_machine, coalesce(p_machine_name, ''), p_protocol, coalesce(p_version, ''),
          coalesce(p_runtimes, '[]'::jsonb), v_until)
  on conflict (owner_id) do update
     set machine_id = excluded.machine_id,
         machine_name = excluded.machine_name,
         protocol = excluded.protocol,
         version = excluded.version,
         runtimes = excluded.runtimes,
         live_until = excluded.live_until,
         updated_at = now()
  returning * into v_runner;
  return cloud.runner_json(v_runner);
end;
$$;
revoke all on function api.register_runner(uuid, uuid, text, integer, text, jsonb, integer, integer) from public;
grant execute on function api.register_runner(uuid, uuid, text, integer, text, jsonb, integer, integer) to service_role;

-- A Runner that is quitting frees the account for another computer at once.
create or replace function api.release_runner(p_subject uuid, p_machine uuid, p_daily_write_budget integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runner cloud.runners := cloud.runner_for(p_subject, p_machine);
begin
  if v_runner.owner_id is null then return json_build_object('released', false); end if;
  perform cloud.count_write(p_daily_write_budget);
  update cloud.runners set live_until = now(), updated_at = now() where owner_id = p_subject;
  return json_build_object('released', true);
end;
$$;
revoke all on function api.release_runner(uuid, uuid, integer) from public;
grant execute on function api.release_runner(uuid, uuid, integer) to service_role;

create or replace function api.read_runner(p_subject uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select cloud.runner_json(r) from cloud.runners r where r.owner_id = p_subject;
$$;
revoke all on function api.read_runner(uuid) from public;
grant execute on function api.read_runner(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create or replace function api.dispatch_runner_job(
  p_subject uuid,
  p_runtime text,
  p_project_dir text,
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
begin
  if not exists (select 1 from cloud.accounts where id = p_subject) then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_jobs (owner_id, runtime, project_dir, prompt, attachments)
  values (p_subject, p_runtime, nullif(p_project_dir, ''), p_prompt, coalesce(p_attachments, '[]'::jsonb))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;
revoke all on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer) from public;
grant execute on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer) to service_role;

-- One job and its output after `p_after`. Null when it is not this account's.
create or replace function api.read_runner_job(p_subject uuid, p_job uuid, p_after integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  perform cloud.require_owner(v_job.owner_id, p_subject);
  return json_build_object(
    'job', cloud.runner_job_json(v_job),
    'events', coalesce((
      select json_agg(json_build_object('seq', e.seq, 'text', e.text, 'at', e.created_at) order by e.seq)
      from cloud.runner_job_events e
      where e.job_id = p_job and e.seq > coalesce(p_after, -1)
    ), '[]'::json)
  );
end;
$$;
revoke all on function api.read_runner_job(uuid, uuid, integer) from public;
grant execute on function api.read_runner_job(uuid, uuid, integer) to service_role;

-- What this Runner has to do: every waiting job, and the ones it holds. The catch-up read on
-- every connect, so it costs no write.
create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at)
    from cloud.runner_jobs j
    where j.owner_id = p_subject
      and (j.state = 'waiting'
           or (j.state = 'claimed' and j.claimed_machine = p_machine and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
end;
$$;
revoke all on function api.list_runner_jobs(uuid, uuid) from public;
grant execute on function api.list_runner_jobs(uuid, uuid) to service_role;

-- Take a waiting job, or say why not. Only a waiting job is ever claimed, so a job runs once.
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
revoke all on function api.claim_runner_job(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.claim_runner_job(uuid, uuid, uuid, integer, integer) to service_role;

-- The job this computer holds and whose lease has not run out. Null otherwise: a lapsed
-- lease is an interrupted job, and nothing may write to it again.
create or replace function cloud.held_runner_job(p_subject uuid, p_machine uuid, p_job uuid)
returns cloud.runner_jobs
language plpgsql
stable
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  perform cloud.require_owner(v_job.owner_id, p_subject);
  if v_job.state <> 'claimed' or v_job.claimed_machine <> p_machine or cloud.runner_job_interrupted(v_job) then
    return null;
  end if;
  return v_job;
end;
$$;
revoke all on function cloud.held_runner_job(uuid, uuid, uuid) from public;

create or replace function api.renew_runner_job(
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
begin
  if (cloud.held_runner_job(p_subject, p_machine, p_job)).id is null then
    return json_build_object('renewed', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  update cloud.runner_jobs
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job;
  return json_build_object('renewed', true);
end;
$$;
revoke all on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) from public;
grant execute on function api.renew_runner_job(uuid, uuid, uuid, integer, integer) to service_role;

-- A batch of output, which renews the lease too: a Runner that reports is alive.
create or replace function api.append_runner_job_events(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_events jsonb,
  p_lease_seconds integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (cloud.held_runner_job(p_subject, p_machine, p_job)).id is null then
    return json_build_object('accepted', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_job_events (job_id, seq, text)
  select p_job, (e ->> 'seq')::integer, e ->> 'text'
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
  on conflict (job_id, seq) do nothing;
  update cloud.runner_jobs
     set lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job;
  return json_build_object('accepted', true);
end;
$$;
revoke all on function api.append_runner_job_events(uuid, uuid, uuid, jsonb, integer, integer) from public;
grant execute on function api.append_runner_job_events(uuid, uuid, uuid, jsonb, integer, integer) to service_role;

create or replace function api.finish_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_outcome text,
  p_reason text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
begin
  if (cloud.held_runner_job(p_subject, p_machine, p_job)).id is null then
    return json_build_object('finished', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  update cloud.runner_jobs
     set state = 'finished',
         outcome = p_outcome,
         reason = nullif(p_reason, ''),
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job));
end;
$$;
revoke all on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer) from public;
grant execute on function api.finish_runner_job(uuid, uuid, uuid, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Which version a Runner launches
-- ---------------------------------------------------------------------------

-- The candidate for its share of machines, the stable version for the rest. A machine stays
-- in the same bucket across launches, so raising the share only ever adds machines.
create or replace function api.runner_version(p_machine uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'version',
    case
      when r.candidate is not null
       and abs(hashtext(p_machine::text)) % 100 < r.candidate_percent
      then r.candidate
      else r.stable
    end
  )
  from cloud.runner_release r;
$$;
revoke all on function api.runner_version(uuid) from public;
grant execute on function api.runner_version(uuid) to service_role;

-- Set by `npm run runner-release`. A rollback is setting the share to 0 or the stable
-- version back.
create or replace function cloud.set_runner_release(p_stable text, p_candidate text, p_percent integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  update cloud.runner_release
     set stable = nullif(p_stable, ''),
         candidate = nullif(p_candidate, ''),
         candidate_percent = coalesce(p_percent, 0),
         updated_at = now();
  return (select json_build_object('stable', stable, 'candidate', candidate, 'candidatePercent', candidate_percent)
            from cloud.runner_release);
end;
$$;
revoke all on function cloud.set_runner_release(text, text, integer) from public;
