-- Workflows as akb files (#2040): `WORKFLOW.md` and the agents' folders, kept in versions; a
-- task names the version it was made on, and its checkpoints come from the plan's drafts.
--
-- - **Old workflows are deleted**: rows in the JSON definition (`expertise`, `checkpoints`,
--   `memory`) are dropped, and the columns with them.
-- - **A version is immutable**: each create or change of a workflow adds one; a built-in's is
--   added the first time a task uses its current files. A version no task uses and no longer
--   current is removed.
-- - **A checkpoint is a submitted draft**: a task's finished `plan` job submits the card's
--   current drafting stage (`metadata.phases` / `metadata.phase`), or the whole plan when it
--   has none. Approving it moves the card to its next stage; approving the last ends the task
--   when its workflow delivers the plan, and queues it for the build otherwise.
-- - **Memory written by a job: the last one wins**: a workspace write no longer checks the
--   version a memory was read at.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.workflow_versions (
  id text primary key,
  -- An account's own (`wf_…`, outliving it while a task uses it) or a built-in (`wf_builtin_…`).
  workflow_id text not null,
  -- Null for a built-in.
  account_id uuid references cloud.accounts (id) on delete cascade,
  version integer not null check (version >= 1),
  -- A built-in's files, told apart.
  hash text,
  name text not null,
  description text not null default '',
  delivers text not null check (delivers in ('plan', 'execute')),
  files jsonb not null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version),
  check ((account_id is null) = (hash is not null))
);
create unique index workflow_versions_builtin on cloud.workflow_versions (workflow_id, hash) where account_id is null;
alter table cloud.workflow_versions enable row level security;

delete from cloud.workflows;
alter table cloud.workflows
  drop column expertise,
  drop column checkpoints,
  drop column memory,
  add column version integer not null default 1;

-- `workflow` becomes `{ id, name, version }`; the files are the version's.
alter table cloud.tasks add column workflow_version text references cloud.workflow_versions (id);
update cloud.tasks set workflow = jsonb_strip_nulls(jsonb_build_object('id', workflow -> 'id', 'name', workflow -> 'name'));

alter table cloud.runner_jobs add column stage text check (stage in ('plan', 'execute'));

-- A decision on a card review names no artifact.
alter table cloud.decisions alter column artifact_id drop not null, alter column artifact_version drop not null;

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_workflow_json(w cloud.workflows) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', w.id, 'object', 'workflow', 'builtin', false, 'name', w.name,
    'description', w.description, 'version', w.version,
    'created_at', cloud.v1_ts(w.created_at), 'updated_at', cloud.v1_ts(w.updated_at));
$$;

-- Add a version of an own workflow, and drop the ones nothing uses any more.
create function cloud.v1_add_workflow_version(w cloud.workflows, p_fields jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.workflow_versions (id, workflow_id, account_id, version, name, description, delivers, files)
  values (cloud.v1_id('wfv'), w.id, w.account_id, w.version, w.name, w.description,
          p_fields ->> 'delivers', p_fields -> 'files');
  delete from cloud.workflow_versions v
   where v.workflow_id = w.id and v.version < w.version
     and not exists (select 1 from cloud.tasks t where t.workflow_version = v.id);
end;
$$;

create or replace function api.v1_workflow(p_account uuid, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  select * into w from cloud.workflows where id = p_id and account_id = p_account;
  if not found then perform cloud.v1_missing('workflow'); end if;
  return cloud.v1_workflow_json(w) || jsonb_build_object('files',
    (select v.files from cloud.workflow_versions v where v.workflow_id = w.id and v.version = w.version));
end;
$$;

create or replace function api.v1_create_workflow(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  insert into cloud.workflows (id, account_id, name, description)
  values (cloud.v1_id('wf'), p_account, p_fields ->> 'name', coalesce(p_fields ->> 'description', ''))
  returning * into w;
  perform cloud.v1_add_workflow_version(w, p_fields);
  perform cloud.v1_emit(p_account, 'workflow.created', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create or replace function api.v1_update_workflow(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.workflows set
    name = p_fields ->> 'name',
    description = coalesce(p_fields ->> 'description', ''),
    version = version + 1,
    updated_at = now()
  where id = p_id and account_id = p_account returning * into w;
  if not found then perform cloud.v1_missing('workflow'); end if;
  perform cloud.v1_add_workflow_version(w, p_fields);
  perform cloud.v1_emit(p_account, 'workflow.updated', cloud.v1_workflow_json(w));
  return cloud.v1_workflow_json(w);
end;
$$;

create or replace function api.v1_delete_workflow(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w cloud.workflows;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  delete from cloud.workflows where id = p_id and account_id = p_account returning * into w;
  if not found then perform cloud.v1_missing('workflow'); end if;
  delete from cloud.workflow_versions v
   where v.workflow_id = w.id and not exists (select 1 from cloud.tasks t where t.workflow_version = v.id);
  perform cloud.v1_emit(p_account, 'workflow.deleted', cloud.v1_workflow_json(w));
  return jsonb_build_object('id', w.id, 'object', 'workflow', 'deleted', true);
end;
$$;

-- `p_builtins` is `[{ id, hash }]`; each answers the version its files have, or will have when
-- first used.
create function api.v1_builtin_versions(p_builtins jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(b ->> 'id', coalesce(
    (select v.version from cloud.workflow_versions v
      where v.account_id is null and v.workflow_id = b ->> 'id' and v.hash = b ->> 'hash'),
    (select max(v.version) + 1 from cloud.workflow_versions v where v.account_id is null and v.workflow_id = b ->> 'id'),
    1)), '{}')
  from jsonb_array_elements(coalesce(p_builtins, '[]')) b;
$$;

-- A built-in's current files as a version, added when first used.
create function cloud.v1_builtin_version(p_workflow jsonb) returns cloud.workflow_versions
language plpgsql security definer set search_path = '' as $$
declare
  v cloud.workflow_versions;
begin
  perform pg_advisory_xact_lock(hashtext('workflow_versions:' || (p_workflow ->> 'id')));
  select * into v from cloud.workflow_versions
   where account_id is null and workflow_id = p_workflow ->> 'id' and hash = p_workflow ->> 'hash';
  if found then return v; end if;
  insert into cloud.workflow_versions (id, workflow_id, version, hash, name, description, delivers, files)
  values (cloud.v1_id('wfv'), p_workflow ->> 'id',
          coalesce((select max(o.version) + 1 from cloud.workflow_versions o
                     where o.account_id is null and o.workflow_id = p_workflow ->> 'id'), 1),
          p_workflow ->> 'hash', p_workflow ->> 'name', coalesce(p_workflow ->> 'description', ''),
          p_workflow ->> 'delivers', p_workflow -> 'files')
  returning * into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- `p_workflow` is a built-in's `{ id, builtin: true, name, description, delivers, hash, files }`,
-- or `{ id, builtin: false }` for the account's own, made on its current version.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  v_project text := p_fields ->> 'project';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if p_max_tasks is not null and cloud.v1_open_tasks(p_account) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
  end if;
  if v_project is not null and not exists (
    select 1 from cloud.projects where id = v_project and account_id = p_account
  ) then
    perform cloud.v1_missing('project');
  end if;
  if (p_workflow ->> 'builtin')::boolean then
    v := cloud.v1_builtin_version(p_workflow);
  else
    select v2.* into v from cloud.workflows w
      join cloud.workflow_versions v2 on v2.workflow_id = w.id and v2.version = w.version
     where w.id = p_workflow ->> 'id' and w.account_id = p_account;
    if not found then perform cloud.v1_missing('workflow'); end if;
  end if;
  insert into cloud.tasks (id, account_id, project_id, workflow, workflow_version, title, request, source, source_context)
  values (cloud.v1_id('task'), p_account, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'))
  returning * into t;
  perform cloud.v1_emit(p_account, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- The workflow version a task runs on, files and all.
create function api.v1_task_workflow(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.workflow_versions;
begin
  if not exists (select 1 from cloud.tasks where id = p_task and account_id = p_account) then
    perform cloud.v1_missing('task');
  end if;
  select v2.* into v from cloud.tasks t join cloud.workflow_versions v2 on v2.id = t.workflow_version where t.id = p_task;
  if not found then perform cloud.v1_missing('workflow version for this task'); end if;
  return jsonb_build_object('object', 'workflow_version', 'workflow', v.workflow_id, 'builtin', v.account_id is null,
    'version', v.version, 'name', v.name, 'description', v.description, 'delivers', v.delivers, 'files', v.files);
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkpoints from drafts
-- ---------------------------------------------------------------------------

-- The card's drafting stages, or null when it has none.
create function cloud.v1_card_phases(k cloud.task_cards) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(k.metadata -> 'phases') = 'array' and jsonb_array_length(k.metadata -> 'phases') > 0
    then k.metadata -> 'phases' end;
$$;

-- Submit the card's current draft for review: its stage's checkpoint is ready, and any later
-- one — a draft going back drops — is gone.
create function cloud.v1_submit_draft(p_task text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  c cloud.task_checkpoints;
  v_phases jsonb;
  v_n integer := 1;
  v_key text := 'plan';
  v_title text;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.status in ('done', 'failed', 'cancelled') then return; end if;
  select * into k from cloud.task_cards where task_id = p_task;
  v_phases := cloud.v1_card_phases(k);
  v_title := t.title;
  if v_phases is not null then
    v_n := least(greatest(coalesce((k.metadata ->> 'phase')::integer, 1), 1), jsonb_array_length(v_phases));
    v_key := 'phase-' || v_n;
    v_title := v_phases ->> (v_n - 1);
  end if;

  delete from cloud.task_checkpoints where task_id = p_task and position > v_n;
  select * into c from cloud.task_checkpoints where task_id = p_task and position = v_n for update;
  if found then
    update cloud.task_checkpoints set key = v_key, title = v_title, status = 'ready', updated_at = now() where id = c.id;
  else
    insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition, status)
    values (cloud.v1_id('cp'), t.account_id, p_task, v_n, v_key, v_title, '{}', 'ready')
    returning * into c;
  end if;
  c := cloud.v1_revise(c.id);
  perform cloud.v1_emit(t.account_id, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  update cloud.tasks set status = 'waiting_review', updated_at = now() where id = p_task returning * into t;
  perform cloud.v1_emit(t.account_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- After an approval: the card's next drafting stage, or the end of the plan.
create function cloud.v1_after_approval(c cloud.task_checkpoints) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_phases jsonb;
  v_status text;
begin
  select * into t from cloud.tasks where id = c.task_id for update;
  if t.workflow_version is null then return; end if;
  select * into k from cloud.task_cards where task_id = c.task_id;
  v_phases := cloud.v1_card_phases(k);
  if v_phases is not null and jsonb_array_length(v_phases) > c.position then
    perform cloud.v1_write_card(c.account_id, c.task_id, jsonb_build_object('body', k.body,
      'metadata', k.metadata || jsonb_build_object('phase', c.position + 1), 'assets', k.assets));
    v_status := 'queued';
  elsif exists (select 1 from cloud.task_checkpoints e where e.task_id = c.task_id and e.status <> 'approved') then
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
  end if;
  update cloud.tasks set status = v_status, updated_at = now() where id = c.task_id returning * into t;
  perform cloud.v1_emit(c.account_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

create or replace function api.v1_create_decision(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_card boolean;
  v_status text;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account for update;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  perform cloud.v1_task_open(c.task_id);
  if c.status = 'pending' then
    perform cloud.v1_refuse('Nothing has been submitted to this checkpoint yet.');
  end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position > c.position and e.status <> 'pending'
  ) then
    perform cloud.v1_refuse('A later checkpoint has already moved on.');
  end if;
  v_card := exists (select 1 from cloud.task_cards k where k.task_id = c.task_id);
  if v_revision is null and v_card then
    perform cloud.v1_refuse('This task has a card: name the review_revision you reviewed.');
  end if;
  if v_revision is not null and v_revision <> c.review_revision then
    raise exception 'This checkpoint has changed since it was opened. Reload it and review again.'
      using errcode = 'AKB26', detail = 'review_outdated';
  end if;

  if v_artifact is null then
    select v.artifact_id, v.version into v_artifact, v_version
    from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where a.checkpoint_id = c.id order by v.created_at desc, v.version desc limit 1;
  elsif v_version is null then
    select a.latest_version into v_version from cloud.artifacts a where a.id = v_artifact and a.checkpoint_id = c.id;
  end if;
  -- A card review with nothing attached decides on the card alone.
  if not (v_artifact is null and p_fields ->> 'artifact' is null and v_card) and not exists (
    select 1 from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where v.artifact_id = v_artifact and v.version = v_version and a.checkpoint_id = c.id
  ) then
    perform cloud.v1_missing('artifact version on this checkpoint');
  end if;

  insert into cloud.decisions (id, account_id, checkpoint_id, artifact_id, artifact_version, decision, comment,
                               decided_by, review_revision)
  values (cloud.v1_id('dec'), p_account, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision)
  returning * into d;
  perform cloud.v1_emit(p_account, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(p_account, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
    if v_status = 'approved' then perform cloud.v1_after_approval(c); end if;
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

-- ---------------------------------------------------------------------------
-- Runner jobs: a stage, and a finished plan job submits its draft
-- ---------------------------------------------------------------------------

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'project', p_job.project_id,
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
    'stage', p_job.stage,
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

drop function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer, text);

-- A task's job runs in its project's folder, when it has one.
create function api.dispatch_runner_job(
  p_subject uuid,
  p_runtime text,
  p_project text,
  p_prompt text,
  p_attachments jsonb,
  p_daily_write_budget integer,
  p_task text default null,
  p_stage text default null
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
  insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, prompt, attachments)
  values (p_subject, p_runtime, v_project, v_folder.path, v_folder.machine_id, p_task, p_stage, p_prompt,
          coalesce(p_attachments, '[]'::jsonb))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;

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
    insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, attempt, prompt, attachments)
    values (v_job.owner_id, v_job.runtime, v_job.project_id, v_job.project_dir, v_job.machine_id, v_job.task_id, v_job.stage, 2,
            v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_outcome = 'done' and v_job.stage = 'plan' and v_job.task_id is not null then
    perform cloud.v1_submit_draft(v_job.task_id);
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- The workspace write: the card on the version read, memory last-writer-wins
-- ---------------------------------------------------------------------------

create or replace function api.v1_commit_workspace(
  p_account uuid, p_task text, p_card jsonb, p_memories jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  m cloud.memories;
  e jsonb;
  v_scope text;
  v_project text;
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

  select * into k from cloud.task_cards where task_id = p_task;
  if p_card is null or (k.task_id is not null and k.body = p_card ->> 'body'
      and k.metadata = coalesce(p_card -> 'metadata', '{}') and k.assets = coalesce(p_card -> 'assets', '{}')) then
    v_card := case when k.task_id is null then null else cloud.v1_card_json(k, t.card_version) end;
  else
    v_card := cloud.v1_write_card(p_account, p_task, p_card - 'base_version');
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_memories, '[]')) loop
    m := null;
    if e -> 'body' is null or jsonb_typeof(e -> 'body') = 'null' then
      delete from cloud.memories
       where account_id = p_account and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      if m.id is not null then
        perform cloud.v1_emit(p_account, 'memory.deleted', cloud.v1_memory_json(m));
        v_out := v_out || jsonb_build_object('id', m.id, 'object', 'memory', 'name', m.name, 'deleted', true);
      else
        v_out := v_out || jsonb_build_object('object', 'memory', 'name', e ->> 'name', 'deleted', true);
      end if;
    else
      update cloud.memories set body = e ->> 'body', version = version + 1, updated_at = now()
       where account_id = p_account and scope = v_scope and project_id is not distinct from v_project
         and name = e ->> 'name'
      returning * into m;
      if m.id is null then
        insert into cloud.memories (id, account_id, scope, project_id, name, body)
        values (cloud.v1_id('mem'), p_account, v_scope, v_project, e ->> 'name', e ->> 'body')
        returning * into m;
      end if;
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

revoke all on function cloud.v1_add_workflow_version(cloud.workflows, jsonb) from public;
revoke all on function cloud.v1_builtin_version(jsonb) from public;
revoke all on function cloud.v1_card_phases(cloud.task_cards) from public;
revoke all on function cloud.v1_submit_draft(text) from public;
revoke all on function cloud.v1_after_approval(cloud.task_checkpoints) from public;
revoke all on function api.v1_builtin_versions(jsonb) from public;
revoke all on function api.v1_task_workflow(uuid, text) from public;
revoke all on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer, text, text) from public;
grant execute on function api.v1_builtin_versions(jsonb) to service_role;
grant execute on function api.v1_task_workflow(uuid, text) to service_role;
grant execute on function api.dispatch_runner_job(uuid, text, text, text, jsonb, integer, text, text) to service_role;
