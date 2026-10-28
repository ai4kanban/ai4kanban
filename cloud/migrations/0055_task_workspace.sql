-- A task's workspace on the Runner (#2037): a job may belong to a task, the task's jobs run
-- one after another, and what a job changed comes back in one versioned write.
--
-- - **One job of a task at a time**: a task's next job is neither listed nor claimable while
--   an earlier one is waiting or running. A retry goes first.
-- - **A conflict retries once**: a job ending `conflict` is dispatched again as attempt 2; a
--   second conflict fails the job.
-- - **Every memory carries a version**: a write may name the one it was made on.
-- - **A workspace write is all or nothing**: the card and the memories it names are saved
--   together only when every version still matches; otherwise nothing is saved (AKB27).

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB27  the card or a memory changed since the caller read it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.runner_jobs
  add column task_id text references cloud.tasks (id) on delete cascade,
  add column attempt integer not null default 1 check (attempt in (1, 2)),
  -- The order a task's jobs run in, after `attempt desc`.
  add column seq bigint generated always as identity;
alter table cloud.runner_jobs drop constraint runner_jobs_outcome_check;
alter table cloud.runner_jobs add constraint runner_jobs_outcome_check check (outcome in ('done', 'failed', 'conflict'));
create index runner_jobs_task on cloud.runner_jobs (task_id) where state <> 'finished';

alter table cloud.memories add column version integer not null default 1;

-- ---------------------------------------------------------------------------
-- Wire shapes
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'project', p_job.project_id,
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
    'attempt', p_job.attempt,
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

create or replace function cloud.v1_memory_json(m cloud.memories) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'object', 'memory', 'scope', m.scope, 'project', m.project_id,
    'name', m.name, 'body', m.body, 'version', m.version,
    'created_at', cloud.v1_ts(m.created_at), 'updated_at', cloud.v1_ts(m.updated_at));
$$;

create function cloud.v1_outdated(p_what text) returns void language plpgsql set search_path = '' as $$
begin
  raise exception '% changed since it was read.', p_what using errcode = 'AKB27';
end;
$$;

-- ---------------------------------------------------------------------------
-- A task's jobs, one at a time
-- ---------------------------------------------------------------------------

-- An earlier job of the same task is still waiting or running. An interrupted one has ended.
create function cloud.runner_job_queued(p_job cloud.runner_jobs) returns boolean
language sql stable set search_path = '' as $$
  select p_job.task_id is not null and exists (
    select 1 from cloud.runner_jobs o
     where o.task_id = p_job.task_id and o.id <> p_job.id
       and o.state <> 'finished' and not cloud.runner_job_interrupted(o)
       and (o.state = 'claimed' or o.attempt > p_job.attempt or (o.attempt = p_job.attempt and o.seq < p_job.seq)));
$$;

drop function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer);

-- A task's job runs in its project's folder, when it has one.
create function api.dispatch_runner_job(
  p_subject uuid,
  p_runtime text,
  p_project text,
  p_prompt text,
  p_attachments jsonb,
  p_daily_write_budget integer,
  p_task text default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  v_folder cloud.project_folders;
  v_project text := p_project;
begin
  if not exists (select 1 from cloud.accounts where id = p_subject) then
    raise exception 'That belongs to another account.' using errcode = 'AKB02';
  end if;
  if p_task is not null then
    select project_id into v_project from cloud.tasks where id = p_task and account_id = p_subject;
    if not found then perform cloud.v1_missing('task'); end if;
    perform cloud.v1_task_open(p_task);
    if p_project is not null and p_project is distinct from v_project then
      perform cloud.v1_refuse('This task belongs to another project.');
    end if;
  end if;
  if v_project is not null then
    if not exists (select 1 from cloud.projects where id = v_project and account_id = p_subject) then
      perform cloud.v1_missing('project');
    end if;
    select f.* into v_folder from cloud.project_folders f
      left join cloud.runners r on r.owner_id = p_subject and r.machine_id = f.machine_id and r.live_until > now()
     where f.project_id = v_project
     order by r.owner_id is not null desc, f.updated_at desc
     limit 1;
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, prompt, attachments)
  values (p_subject, p_runtime, v_project, v_folder.path, v_folder.machine_id, p_task, p_prompt,
          coalesce(p_attachments, '[]'::jsonb))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;
revoke all on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer, text) from public;
grant execute on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer, text) to service_role;

create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at, j.seq)
    from cloud.runner_jobs j
    where j.owner_id = p_subject
      and (j.machine_id is null or j.machine_id = p_machine)
      and ((j.state = 'waiting' and not cloud.runner_job_queued(j))
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
  if v_job.task_id is not null then
    -- Two claims on one task wait for each other here, so only the first one runs.
    perform 1 from cloud.tasks where id = v_job.task_id for update;
  end if;
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
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
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

-- `conflict` is a task's job whose write was refused: the first is dispatched again, ahead of
-- the task's other jobs; the second fails. A job without a task cannot conflict.
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
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  v_outcome text := p_outcome;
  v_reason text := nullif(p_reason, '');
  v_retry cloud.runner_jobs;
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  perform cloud.count_write(p_daily_write_budget);
  if v_outcome = 'conflict' and (v_job.task_id is null or v_job.attempt >= 2) then
    v_outcome := 'failed';
    v_reason := 'The card was updated elsewhere.';
  end if;
  update cloud.runner_jobs
     set state = 'finished',
         outcome = v_outcome,
         reason = v_reason,
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, attempt, prompt, attachments)
    values (v_job.owner_id, v_job.runtime, v_job.project_id, v_job.project_dir, v_job.machine_id, v_job.task_id, 2,
            v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Memory versions
-- ---------------------------------------------------------------------------

create or replace function api.v1_update_memory(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.memories;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into m from cloud.memories where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('memory'); end if;
  if p_fields ? 'base_version' and m.version <> (p_fields ->> 'base_version')::integer then
    perform cloud.v1_outdated(format('The memory %s', m.name));
  end if;
  begin
    update cloud.memories set
      name = coalesce(p_fields ->> 'name', name),
      body = coalesce(p_fields ->> 'body', body),
      version = version + 1,
      updated_at = now()
    where id = p_id returning * into m;
  exception when unique_violation then
    perform cloud.v1_refuse('A memory with this name already exists here.');
  end;
  perform cloud.v1_emit(p_account, 'memory.updated', cloud.v1_memory_json(m));
  return cloud.v1_memory_json(m);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cards: one write, shared by the card route and the workspace
-- ---------------------------------------------------------------------------

-- Save the card of a task the caller holds locked, and move its checkpoints on.
create function cloud.v1_write_card(p_account uuid, p_task text, p_fields jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_bad text;
  v_cp text;
begin
  select e.key into v_bad from jsonb_each(coalesce(p_fields -> 'assets', '{}')) e
  where not exists (
    select 1 from cloud.artifacts a
    where a.id = e.value ->> 'artifact' and a.task_id = p_task
      and (e.value -> 'version' is null or (e.value ->> 'version')::integer between 1 and a.latest_version))
  limit 1;
  if v_bad is not null then
    raise exception 'The asset % names no artifact version on this task.', v_bad using errcode = 'AKB20';
  end if;
  insert into cloud.task_cards (task_id, account_id, body, metadata, assets)
  values (p_task, p_account, p_fields ->> 'body', coalesce(p_fields -> 'metadata', '{}'), coalesce(p_fields -> 'assets', '{}'))
  on conflict (task_id) do update set body = excluded.body, metadata = excluded.metadata, assets = excluded.assets,
    updated_at = now()
  returning * into k;
  update cloud.tasks set card_version = card_version + 1, updated_at = now() where id = p_task returning * into t;
  for v_cp in
    select c.id from cloud.task_checkpoints c
    where c.task_id = p_task and c.status not in ('pending', 'approved') order by c.position
  loop
    perform cloud.v1_revise(v_cp);
  end loop;
  perform cloud.v1_emit(p_account, 'card.updated', cloud.v1_card_json(k, t.card_version) - 'body');
  return cloud.v1_card_json(k, t.card_version);
end;
$$;

create or replace function api.v1_save_card(
  p_account uuid, p_task text, p_fields jsonb, p_base integer, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_task);
  if t.card_version <> p_base then
    perform cloud.v1_refuse(format('The card is at version %s now; read it and write against that.', t.card_version));
  end if;
  return cloud.v1_write_card(p_account, p_task, p_fields);
end;
$$;

-- ---------------------------------------------------------------------------
-- The workspace write
-- ---------------------------------------------------------------------------

-- `p_card` is `{ body, metadata, assets, base_version }`, or null to leave the card alone; a
-- card that reads as it already does keeps its version. Each memory is `{ name, body, base_version }`
-- in the task's memory — its project's, or the user's for an inbox task: `base_version` 0 creates
-- it, a null `body` deletes it. Nothing is saved unless every version matches.
create function api.v1_commit_workspace(
  p_account uuid, p_task text, p_card jsonb, p_memories jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  m cloud.memories;
  e jsonb;
  v_scope text;
  v_project text;
  v_base integer;
  v_card jsonb;
  v_out jsonb := '[]';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_task);
  select p.id into v_project from cloud.projects p where p.id = t.project_id and not p.inbox;
  v_scope := case when v_project is null then 'user' else 'project' end;

  if p_card is not null and t.card_version <> (p_card ->> 'base_version')::integer then
    perform cloud.v1_outdated('The card');
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_memories, '[]')) loop
    v_base := (e ->> 'base_version')::integer;
    select * into m from cloud.memories
     where account_id = p_account and scope = v_scope and project_id is not distinct from v_project
       and name = e ->> 'name'
     for update;
    if coalesce(m.version, 0) <> v_base then perform cloud.v1_outdated(format('The memory %s', e ->> 'name')); end if;
  end loop;

  select * into k from cloud.task_cards where task_id = p_task;
  if p_card is null or (k.task_id is not null and k.body = p_card ->> 'body'
      and k.metadata = coalesce(p_card -> 'metadata', '{}') and k.assets = coalesce(p_card -> 'assets', '{}')) then
    v_card := case when k.task_id is null then null else cloud.v1_card_json(k, t.card_version) end;
  else
    v_card := cloud.v1_write_card(p_account, p_task, p_card - 'base_version');
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_memories, '[]')) loop
    if e -> 'body' is null or jsonb_typeof(e -> 'body') = 'null' then
      delete from cloud.memories
       where account_id = p_account and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      if m.id is not null then
        perform cloud.v1_emit(p_account, 'memory.deleted', cloud.v1_memory_json(m));
        v_out := v_out || jsonb_build_object('id', m.id, 'object', 'memory', 'name', m.name, 'deleted', true);
      end if;
    elsif (e ->> 'base_version')::integer = 0 then
      insert into cloud.memories (id, account_id, scope, project_id, name, body)
      values (cloud.v1_id('mem'), p_account, v_scope, v_project, e ->> 'name', e ->> 'body')
      returning * into m;
      perform cloud.v1_emit(p_account, 'memory.updated', cloud.v1_memory_json(m));
      v_out := v_out || cloud.v1_memory_json(m);
    else
      update cloud.memories set body = e ->> 'body', version = version + 1, updated_at = now()
       where account_id = p_account and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      perform cloud.v1_emit(p_account, 'memory.updated', cloud.v1_memory_json(m));
      v_out := v_out || cloud.v1_memory_json(m);
    end if;
  end loop;
  return jsonb_build_object('object', 'workspace', 'card', v_card, 'memories', v_out);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function cloud.v1_outdated(text) from public;
revoke all on function cloud.runner_job_queued(cloud.runner_jobs) from public;
revoke all on function cloud.v1_write_card(uuid, text, jsonb) from public;
revoke all on function api.v1_commit_workspace(uuid, text, jsonb, jsonb, integer) from public;
grant execute on function api.v1_commit_workspace(uuid, text, jsonb, jsonb, integer) to service_role;
