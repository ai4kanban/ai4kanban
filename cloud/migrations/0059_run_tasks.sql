-- Tasks run by the Runner (#2020): a task made with `run` is planned, revised and built by akb
-- on its creator's Runner, one flow job per step; and each person has their own chat on a task.
--
-- - **The cloud dispatches each step**: a create, a finished flow job and a decision queue the
--   next one; there is no scheduler. A claimed flow job makes the task `running`.
-- - **A finished step submits its draft**: `create`, `resolve`, `revise` and `approve` submit the
--   card's current stage for review, asking the card's open question when the Runner reports
--   one; `implement` ends the task with the agent's summary as its result, or, held on a
--   question, asks it, and the answer carries the build on. A failed one fails
--   the task with its reason. Nothing is retried but #2037's one conflict.
-- - **A decision drives the flow**: request changes on a card question resolves it, otherwise
--   revises; approving moves to the next stage, then builds, or ends a plan-delivering task.
-- - **An interrupted flow job fails its task**: when its Runner registers again, or at the
--   hourly sweep.
-- - **A running task cannot be cancelled**: the Runner cannot stop its agent midway. Cancelling
--   a queued one finishes its waiting jobs.
-- - **A chat is one person's**: `task_chats` holds a row per task and account, and a message
--   is its account's; every job still runs on the task creator's Runner.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB21  a decision while the agent is still working on the task.
-- AKB26  `task_running`: cancelling a task whose flow job is running.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.tasks
  add column run boolean not null default false,
  add column result text,
  add column failure text,
  -- The akb card on the Runner's board, as the Runner last reported it.
  add column run_card integer check (run_card > 0);
create index tasks_runs on cloud.tasks (account_id) where run and status in ('queued', 'running');

alter table cloud.runner_jobs
  -- `{ verb, workflow, card?, text?, title? }` of a run task's step; null for any other job.
  add column flow jsonb check (flow is null or flow ->> 'verb' in ('create', 'resolve', 'revise', 'approve', 'implement')),
  add column reply text;
create index runner_jobs_flow on cloud.runner_jobs (task_id, seq) where flow is not null;

alter table cloud.task_chats drop constraint task_chats_pkey, add primary key (task_id, account_id);
create index task_chats_job on cloud.task_chats (job_id) where job_id is not null;
create index task_chat_messages_account on cloud.task_chat_messages (task_id, account_id, seq);

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
    'stage', p_job.stage,
    'flow', p_job.flow,
    'attempt', p_job.attempt,
    'resume', p_job.resume,
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

-- The task's flow job that is waiting or running.
create function cloud.v1_flow_job(p_task text) returns cloud.runner_jobs
language sql stable security definer set search_path = '' as $$
  select j.* from cloud.runner_jobs j
  where j.task_id = p_task and j.flow is not null and j.state <> 'finished' and not cloud.runner_job_interrupted(j)
  order by j.state = 'claimed' desc, j.attempt desc, j.seq limit 1;
$$;

create function cloud.v1_run_json(t cloud.tasks) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when j.id is not null then jsonb_build_object(
    'state', case j.state when 'claimed' then 'running' else 'queued' end,
    'runner_connected', exists (select 1 from cloud.runners r where r.owner_id = t.account_id and r.live_until > now()),
    'job', j.id) end
  from cloud.v1_flow_job(t.id) j;
$$;

create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'card_version', nullif(t.card_version, 0),
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'last_job', (select j.id from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null order by j.seq desc limit 1),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create or replace function cloud.v1_checkpoint_json(c cloud.task_checkpoints) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'object', 'checkpoint', 'task', c.task_id, 'position', c.position,
    'key', c.key, 'title', c.title, 'artifact_type', c.definition -> 'artifact_type',
    'question', coalesce(c.review ->> 'question', c.definition ->> 'question', ''),
    'options', c.review -> 'options',
    'card_question', c.review -> 'card_question',
    'acceptance', coalesce(c.definition ->> 'acceptance', ''),
    'review_revision', c.review_revision,
    'status', c.status, 'created_at', cloud.v1_ts(c.created_at), 'updated_at', cloud.v1_ts(c.updated_at));
$$;

-- ---------------------------------------------------------------------------
-- The flow: one job per step, on the task creator's Runner
-- ---------------------------------------------------------------------------

-- An agent the creator's Runner can run, Claude Code first.
create function cloud.v1_flow_runtime(p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e ->> 'name' from cloud.runners r, jsonb_array_elements(r.runtimes) e
    where r.owner_id = p_account and e ->> 'name' in ('claude-code', 'codex')
      and coalesce((e ->> 'installed')::boolean, false) and coalesce((e ->> 'loggedIn')::boolean, true)
    order by e ->> 'name' = 'claude-code' desc limit 1), 'claude-code');
$$;

-- Queues the task's next step, in its project's folder when it has one. The caller holds the
-- workspace's lock and tells it about the task.
create function cloud.v1_dispatch_flow(p_task text, p_verb text, p_text text default null) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  f cloud.project_folders;
begin
  select * into t from cloud.tasks where id = p_task for update;
  select x.* into f from cloud.project_folders x
    left join cloud.runners r on r.owner_id = t.account_id and r.machine_id = x.machine_id and r.live_until > now()
   where x.project_id = t.project_id and x.account_id = t.account_id
   order by r.owner_id is not null desc, x.updated_at desc limit 1;
  insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (t.account_id, cloud.v1_flow_runtime(t.account_id), t.project_id, f.path, f.machine_id, t.id,
          format('akb %s: %s', p_verb, t.title),
          jsonb_strip_nulls(jsonb_build_object('verb', p_verb, 'workflow', t.workflow ->> 'id', 'card', t.run_card,
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end)))
  returning * into j;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', failure = null, result = null, updated_at = now() where id = p_task;
  return j;
end;
$$;

-- Submit the card's current draft for review; `p_review` replaces the checkpoint's question.
drop function cloud.v1_submit_draft(text);
create function cloud.v1_submit_draft(p_task text, p_review jsonb default null) returns void
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
    update cloud.task_checkpoints set key = v_key, title = v_title, status = 'ready', review = coalesce(p_review, review),
      updated_at = now() where id = c.id;
  else
    insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition, status, review)
    values (cloud.v1_id('cp'), t.account_id, p_task, v_n, v_key, v_title, '{}', 'ready', p_review)
    returning * into c;
  end if;
  c := cloud.v1_revise(c.id);
  perform cloud.v1_emit(t.workspace_id, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  update cloud.tasks set status = 'waiting_review', updated_at = now() where id = p_task returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- A checkpoint born ready (a task's first draft) asks for review like one that became ready.
create trigger checkpoint_alerts_born after insert on cloud.task_checkpoints
  for each row when (new.status = 'ready') execute function cloud.checkpoint_alerts();

-- A finished flow job: the draft for review, the task done, or the task failed.
create function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if t.status in ('done', 'failed', 'cancelled') or j.outcome = 'conflict' then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif j.flow ->> 'verb' = 'implement' and jsonb_typeof(r) is distinct from 'object' then
    update cloud.tasks set status = 'done', result = j.reply, updated_at = now() where id = t.id returning * into t;
  else
    perform cloud.v1_submit_draft(t.id, case
      when jsonb_typeof(r) = 'object' then jsonb_build_object('question', r ->> 'question',
        'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'approve', false) order by o.n)
                    from jsonb_array_elements_text(r -> 'options') with ordinality o(label, n)),
        'card_question', (r ->> 'position')::integer)
      when concat(t.request, t.title) ~ '[一-鿿]' then
        '{"question": "批准这份方案？", "options": [{"label": "确认", "approve": true}, {"label": "需要修改", "approve": false}]}'
      else '{"question": "Approve this plan?", "options": [{"label": "Approve", "approve": true},
             {"label": "Request changes", "approve": false}]}' end);
    return;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- A run task whose flow job lost its lease, failed: nothing runs that job again.
create function cloud.v1_fail_interrupted(p_owner uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  t cloud.tasks;
  n integer := 0;
begin
  for v_id in
    select x.id from cloud.tasks x
    where x.run and x.status in ('queued', 'running') and (p_owner is null or x.account_id = p_owner)
      and exists (select 1 from cloud.runner_jobs j where j.task_id = x.id and j.flow is not null
                  and cloud.runner_job_interrupted(j))
  loop
    perform cloud.v1_lock(cloud.v1_task_workspace(v_id));
    select * into t from cloud.tasks where id = v_id for update;
    if t.status not in ('queued', 'running') or (cloud.v1_flow_job(v_id)).id is not null then continue; end if;
    update cloud.tasks set status = 'failed', failure = 'The Runner stopped before this step finished.', updated_at = now()
     where id = v_id returning * into t;
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

-- `run`: the first step is queued, and the request opens the creator's chat on the task.
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

-- A queued run task's waiting jobs end with it; a running one cannot be stopped.
create or replace function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  if (cloud.v1_flow_job(p_id)).state = 'claimed' then
    raise exception 'A running task cannot be cancelled.' using errcode = 'AKB26', detail = 'task_running';
  end if;
  update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'Cancelled.', finished_at = now(),
    updated_at = now()
  where task_id = p_id and state = 'waiting';
  for h in
    update cloud.task_chats c set job_id = null, failure = 'failed', updated_at = now()
     where c.task_id = p_id and c.job_id in (select j.id from cloud.runner_jobs j where j.task_id = p_id and j.reason = 'Cancelled.')
    returning c.*
  loop
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
  update cloud.tasks set status = 'cancelled', updated_at = now() where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.cancelled', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- After an approval: the card's next drafting stage, or the end of the plan. A run task's
-- Runner approves the stage, or builds, as its next step.
create or replace function cloud.v1_after_approval(c cloud.task_checkpoints) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_phases jsonb;
  v_more boolean;
  v_status text;
begin
  select * into t from cloud.tasks where id = c.task_id for update;
  if t.workflow_version is null then return; end if;
  select * into k from cloud.task_cards where task_id = c.task_id;
  v_phases := cloud.v1_card_phases(k);
  v_more := v_phases is not null and jsonb_array_length(v_phases) > c.position;
  if v_more then
    perform cloud.v1_write_card(c.task_id, jsonb_build_object('body', k.body,
      'metadata', k.metadata || jsonb_build_object('phase', c.position + 1), 'assets', k.assets));
    v_status := 'queued';
  elsif exists (select 1 from cloud.task_checkpoints e where e.task_id = c.task_id and e.status <> 'approved') then
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
  end if;
  if t.run and v_status = 'queued' then
    perform cloud.v1_dispatch_flow(c.task_id, case when v_more then 'approve' else 'implement' end);
    select * into t from cloud.tasks where id = c.task_id;
  else
    update cloud.tasks set status = v_status, updated_at = now(),
      result = case when t.run and v_status = 'done' then (
        select j.reply from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null and j.state = 'finished'
        order by j.seq desc limit 1) else result end
    where id = c.task_id returning * into t;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- Changes asked on a run task's checkpoint are its Runner's next step: answering the card's
-- question, or revising.
create or replace function api.v1_create_decision(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  t cloud.tasks;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_card boolean;
  v_status text;
  v_text text;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint for update;
  perform cloud.v1_task_open(c.task_id);
  select * into t from cloud.tasks where id = c.task_id;
  if t.run and (cloud.v1_flow_job(t.id)).id is not null then
    perform cloud.v1_refuse('The agent is still working on this task.');
  end if;
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
  values (cloud.v1_id('dec'), c.account_id, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision)
  returning * into d;
  perform cloud.v1_emit(v_ws, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(v_ws, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
    if v_status = 'approved' then
      perform cloud.v1_after_approval(c);
    elsif t.run then
      v_text := d.comment;
      if c.review ? 'card_question' and strpos(v_text, c.review ->> 'question') = 0 then
        v_text := concat_ws(E'\n\n', c.review ->> 'question', nullif(v_text, ''));
      end if;
      -- A build held on a question carries on with the answer.
      perform cloud.v1_dispatch_flow(t.id, case
        when not c.review ? 'card_question' then 'revise'
        when (select j.flow ->> 'verb' from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null
               order by j.seq desc limit 1) = 'implement' then 'implement'
        else 'resolve' end, v_text);
      select * into t from cloud.tasks where id = c.task_id;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    end if;
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

-- ---------------------------------------------------------------------------
-- Chats: one per person on a task, run on the task creator's Runner
-- ---------------------------------------------------------------------------

-- `replying` while a job writes the reply; `waiting_you` when the agent spoke last and the
-- task waits for review.
create function cloud.v1_chat_state(h cloud.task_chats) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when (cloud.task_chat_job(h)).id is not null then 'replying'
    when (select m.role from cloud.task_chat_messages m where m.task_id = h.task_id and m.account_id = h.account_id
          order by m.seq desc limit 1) = 'agent'
      and (select t.status from cloud.tasks t where t.id = h.task_id) = 'waiting_review' then 'waiting_you'
    else 'idle' end;
$$;

-- Tells the chat's own person, and nobody else.
create function cloud.v1_chat_changed(p_task text, p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
begin
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if h.task_id is null then return; end if;
  perform cloud.v1_emit(cloud.v1_task_workspace(p_task), 'chat.updated',
    jsonb_build_object('task', p_task, 'state', cloud.v1_chat_state(h)), p_account);
end;
$$;

create or replace function cloud.task_chat_json(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  j cloud.runner_jobs;
  r cloud.runners;
  v_status text := 'idle';
begin
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  select x.* into r from cloud.runners x join cloud.tasks t on t.account_id = x.owner_id where t.id = p_task;
  if h.job_id is not null then
    j := cloud.task_chat_job(h);
    if j.id is null then v_status := 'failed';
    elsif j.state = 'waiting' and cloud.runner_job_queued(j) then v_status := 'queued';
    else v_status := 'replying';
    end if;
  elsif h.failure is not null then
    v_status := h.failure;
  end if;
  return jsonb_build_object(
    'object', 'task_chat',
    'messages', coalesce((
      select jsonb_agg(cloud.v1_chat_message_json(m) order by m.seq)
      from cloud.task_chat_messages m where m.task_id = p_task and m.account_id = p_account), '[]'),
    'status', v_status,
    'runtime', h.runtime,
    'runtimes', coalesce((
      select jsonb_agg(e ->> 'name') from jsonb_array_elements(r.runtimes) e
      where (e ->> 'installed')::boolean and coalesce((e ->> 'loggedIn')::boolean, true)), '[]'),
    'runner', jsonb_build_object('connected', coalesce(r.live_until > now(), false)),
    'context', case when h.session is not null and (h.context ->> 'limit')::integer > 0 then
      jsonb_build_object('used', (h.context ->> 'used')::integer, 'limit', (h.context ->> 'limit')::integer) end);
end;
$$;

drop function cloud.task_chat_prompt(text);
create function cloud.task_chat_prompt(p_task text, p_account uuid) returns text
language sql stable security definer set search_path = '' as $$
  with recent as (
    select m.role, m.body, row_number() over (order by m.seq desc) n
    from cloud.task_chat_messages m where m.task_id = p_task and m.account_id = p_account order by m.seq desc limit 30
  )
  select concat_ws(E'\n\n',
    'Answer the newest message in this task card''s review-page chat, following `akb guide card-chat`.',
    case when count(*) filter (where n > 1) > 0 then E'The conversation so far, oldest first:\n\n' || string_agg(
      case when role = 'user' then 'User: ' else 'Agent: ' end || body, E'\n\n' order by n desc) filter (where n > 1) end,
    E'The newest message:\n\n' || max(body) filter (where n = 1))
  from recent;
$$;

-- One message, answered by a job of the task. Switching agents starts a new session. The
-- caller holds the workspace's lock.
create function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_runner uuid;
  v_runtime text;
  h cloud.task_chats;
  v_job json;
begin
  select account_id into v_runner from cloud.tasks where id = p_task for update;
  insert into cloud.task_chats (task_id, account_id) values (p_task, p_account) on conflict do nothing;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  if not exists (select 1 from cloud.runners r where r.owner_id = v_runner and r.live_until > now()) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_runtime := coalesce(p_runtime, h.runtime, cloud.v1_flow_runtime(v_runner));
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', p_body);
  v_job := api.dispatch_runner_job(v_runner, v_runtime, null, cloud.task_chat_prompt(p_task, p_account), '[]',
                                   p_daily_write_budget, p_task);
  if h.session_runtime is not distinct from v_runtime and h.session is not null then
    update cloud.runner_jobs set resume = h.session where id = (v_job ->> 'id')::uuid;
  end if;
  update cloud.task_chats set runtime = v_runtime, job_id = (v_job ->> 'id')::uuid, failure = null,
    session = case when session_runtime is distinct from v_runtime then null else session end,
    context = case when session_runtime is distinct from v_runtime then null else context end,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

create function cloud.v1_chat_clear(p_account uuid, p_task text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
begin
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account for update;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  delete from cloud.task_chat_messages where task_id = p_task and account_id = p_account;
  update cloud.task_chats set job_id = null, session = null, session_runtime = null, context = null, failure = null,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

-- The caller's own chat on a task of their workspace.
create function api.v1_task_chat(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

create function api.v1_task_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  return cloud.v1_chat_send(p_account, p_task, p_body, p_runtime, p_daily_write_budget);
end;
$$;

create function api.v1_task_chat_clear(p_account uuid, p_task text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  return cloud.v1_chat_clear(p_account, p_task);
end;
$$;

-- The caller's chats in a workspace, newest message first. `after` is the last task listed.
create function api.v1_list_chats(p_account uuid, p_workspace text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_target(p_account, p_workspace, null);
  v_limit integer := cloud.v1_limit(p_limit);
  v_at timestamptz;
begin
  if p_after is not null then
    select max(m.created_at) into v_at from cloud.task_chat_messages m where m.task_id = p_after and m.account_id = p_account;
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.n) filter (where x.n <= v_limit), '[]'),
      'next', case when count(*) > v_limit then (array_agg(x.id order by x.n))[v_limit] end)
    from (
      select t.id, row_number() over (order by c.at desc, t.id desc) n,
        jsonb_build_object('task', t.id,
          'key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
          'title', t.title, 'project', t.project_id, 'last_message_at', cloud.v1_ts(c.at), 'state', cloud.v1_chat_state(h)) j
      from cloud.task_chats h
      join cloud.tasks t on t.id = h.task_id
      cross join lateral (select max(m.created_at) at from cloud.task_chat_messages m
                          where m.task_id = h.task_id and m.account_id = h.account_id) c
      where h.account_id = p_account and t.workspace_id = v_ws and c.at is not null
        and (p_after is null or (c.at, t.id) < (v_at, p_after))
      order by c.at desc, t.id desc limit v_limit + 1
    ) x);
end;
$$;

-- The review page's chat is the caller's own too.
create or replace function api.v1_shared_chat(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
begin
  return cloud.task_chat_json((v ->> 'account')::uuid, v ->> 'task');
end;
$$;

create or replace function api.v1_shared_chat_send(
  p_hash text, p_subject uuid, p_email text, p_body text, p_runtime text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
begin
  perform cloud.v1_write((v ->> 'account')::uuid, v ->> 'workspace', p_daily_write_budget);
  return jsonb_build_object('workspace', v -> 'workspace',
    'result', cloud.v1_chat_send((v ->> 'account')::uuid, v ->> 'task', p_body, p_runtime, p_daily_write_budget));
end;
$$;

create or replace function api.v1_shared_chat_clear(p_hash text, p_subject uuid, p_email text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
begin
  perform cloud.v1_write((v ->> 'account')::uuid, v ->> 'workspace', p_daily_write_budget);
  return jsonb_build_object('workspace', v -> 'workspace',
    'result', cloud.v1_chat_clear((v ->> 'account')::uuid, v ->> 'task'));
end;
$$;

-- ---------------------------------------------------------------------------
-- The Runner
-- ---------------------------------------------------------------------------

create or replace function api.register_runner(
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
  perform cloud.v1_fail_interrupted(p_subject);
  return cloud.runner_json(v_runner);
end;
$$;

-- A flow job's run log is readable by every member of its task's workspace.
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
  if v_job.flow is null or not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    perform cloud.require_owner(v_job.owner_id, p_subject);
  end if;
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

-- A task's jobs wait for its workspace's lock before either row, as every write there does.
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
    -- Two claims on one task wait for each other here, so only the first one runs.
    perform 1 from cloud.tasks where id = v_job.task_id for update;
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job for update;
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
  if v_job.flow is not null then
    update cloud.tasks set status = 'running', updated_at = now() where id = v_job.task_id and status = 'queued'
    returning * into t;
    if t.id is not null then perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t)); end if;
  end if;
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

create or replace function api.finish_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_outcome text,
  p_reason text,
  p_daily_write_budget integer,
  p_report jsonb default null
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
  v_reply text := nullif(btrim(left(coalesce(p_report ->> 'reply', ''), 60000)), '');
  h cloud.task_chats;
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
  perform cloud.count_write(p_daily_write_budget);
  if v_outcome = 'conflict' and (v_job.task_id is null or v_job.attempt >= 2) then
    v_outcome := 'failed';
    v_reason := 'The card was updated elsewhere.';
  end if;
  update cloud.runner_jobs
     set state = 'finished',
         outcome = v_outcome,
         reason = v_reason,
         reply = v_reply,
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, project_id, project_dir, machine_id, task_id, stage, flow, attempt, resume,
                                   prompt, attachments)
    values (v_job.owner_id, v_job.runtime, v_job.project_id, v_job.project_dir, v_job.machine_id, v_job.task_id, v_job.stage,
            v_job.flow, 2, v_job.resume, v_job.prompt, v_job.attachments)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_job.task_id is not null and cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_outcome = 'done' and v_job.stage = 'plan' then perform cloud.v1_submit_draft(v_job.task_id); end if;
    if v_job.flow is not null then perform cloud.v1_finish_flow(v_job, p_report); end if;
  end if;

  for h in select * from cloud.task_chats where job_id = p_job loop
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
      values (cloud.v1_id('msg'), h.task_id, h.account_id, 'agent', v_reply);
    end if;
    update cloud.task_chats set
      job_id = v_retry.id,
      session = case when v_job.flow is null then coalesce(p_report ->> 'session', session) else session end,
      session_runtime = case when v_job.flow is null and p_report ->> 'session' is not null then v_job.runtime
                             else session_runtime end,
      context = case when v_job.flow is null then coalesce(p_report -> 'context', context) else context end,
      failure = case v_outcome when 'failed' then
        case when v_reason = 'The card was updated elsewhere.' then 'conflict' else 'failed' end end,
      updated_at = now()
    where task_id = h.task_id and account_id = h.account_id;
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end);
end;
$$;

-- The hourly sweep also fails run tasks whose Runner went away mid-step.
create or replace function api.v1_sweep() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_events integer;
  v_replays integer;
  v_alerts integer;
begin
  delete from cloud.api_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from cloud.api_idempotency where created_at < now() - interval '1 day';
  get diagnostics v_replays = row_count;
  delete from cloud.alerts where read_at < now() - interval '30 days';
  get diagnostics v_alerts = row_count;
  return jsonb_build_object('events', v_events, 'replays', v_replays, 'alerts', v_alerts,
    'interrupted', cloud.v1_fail_interrupted());
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function cloud.task_chat_prompt(text, uuid) from public;
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
