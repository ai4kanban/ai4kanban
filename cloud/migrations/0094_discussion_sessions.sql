-- A task started from a discussion carries its session (#2146).
--
-- - **One session**: the task chat's. Its planning, the answers to its questions and its chat
--   all continue it, and every job that reports a session writes it back.
-- - **First fork**: while the task chat has no session, a job forks the discussion's, when it
--   was made on the same connector and model.
-- - **Transcript**: every such job carries the discussion's messages, read when nothing can be
--   carried on.
-- - **Answers**: a resolve or revise is the chat's reply, so the chat shows the agent's answer
--   and not the user's.
-- - **One step at a time**: a task's jobs already run in turn; a waiting one takes the session
--   the one before it reported.

alter table cloud.runner_jobs
  add column fork boolean not null default false,
  add column transcript_of text references cloud.discussions (id) on delete set null;

create function cloud.v1_discussion_transcript(p_id text) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(case when m.role = 'user' then 'User: ' else 'Agent: ' end || cloud.v1_said(m.body, m.image_names),
                    E'\n\n' order by m.seq)
  from cloud.discussion_messages m where m.discussion_id = p_id;
$$;

-- A task job's session: the chat's own, else the discussion's forked; none for a task that came
-- from no discussion.
create function cloud.v1_carry_session(p_job uuid, p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  d cloud.discussions;
  h cloud.task_chats;
  v_key text;
  v_own boolean;
begin
  select * into j from cloud.runner_jobs where id = p_job;
  select x.* into d from cloud.tasks t join cloud.discussions x on x.id = t.discussion_id where t.id = j.task_id;
  if d.id is null then return; end if;
  select * into h from cloud.task_chats where task_id = j.task_id and account_id = p_account;
  v_key := cloud.v1_session_key(j.runtime, j.model);
  v_own := h.session is not null and h.session_runtime is not distinct from v_key;
  update cloud.runner_jobs set transcript_of = d.id,
    resume = case when v_own then h.session when d.session_runtime is not distinct from v_key then d.session end,
    fork = not v_own and d.session is not null and d.session_runtime is not distinct from v_key
  where id = p_job;
end;
$$;

-- 0092's, with `fork` and, on a claimed job, `transcript`; an answer's job answers no chat message.
create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'runtimeId', p_job.runtime_id,
    'model', p_job.model,
    'settings', coalesce(p_job.settings, '{}'::jsonb),
    'test', p_job.test,
    'secret', p_job.secret is not null,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', coalesce(p_job.project_dir, case when p_job.agent is not null or p_job.task_id is not null then
      (select f.path from cloud.project_folders f
        where f.project_id = coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id))
          and f.machine_id = coalesce(p_job.claimed_machine, p_job.machine_id) limit 1) end),
    'task', p_job.task_id,
    'discussion', (select json_build_object('id', d.id, 'workspace', d.workspace_id,
        'ideas', coalesce((select json_agg(json_build_object('id', i.id, 'title', i.title, 'outcome', i.outcome,
            'acceptance', i.acceptance, 'workflow', i.workflow, 'task', i.task_id) order by i.seq)
          from cloud.discussion_ideas i where i.discussion_id = d.id and i.state <> 'dropped'), '[]'::json))
      from cloud.discussions d where d.id = p_job.discussion_id),
    'chat', (select json_build_object('message', m.id, 'body', m.body)
      from cloud.task_chats h
      cross join lateral (select m.id, m.body from cloud.task_chat_messages m
                          where m.task_id = h.task_id and m.account_id = h.account_id and m.role = 'user'
                          order by m.seq desc limit 1) m
      where h.job_id = p_job.id and coalesce(p_job.flow ->> 'verb', '') not in ('resolve', 'revise') limit 1),
    'review', p_job.review,
    'agent', p_job.agent,
    'stage', p_job.stage,
    'flow', p_job.flow,
    'number', (select t.number from cloud.tasks t where t.id = p_job.task_id),
    'workflow', (select v.workflow_id from cloud.tasks t join cloud.workflow_versions v on v.id = t.workflow_version
                 where t.id = p_job.task_id),
    'attempt', p_job.attempt,
    'resume', p_job.resume,
    'fork', p_job.fork,
    'transcript', case when p_job.state = 'claimed' then cloud.v1_discussion_transcript(p_job.transcript_of) end,
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

-- 0093's, a planning step carrying the session and an answer replying in the chat.
create or replace function cloud.v1_dispatch_flow(p_task text, p_verb text, p_text text default null) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  f cloud.project_folders;
  r cloud.runtimes;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if cardinality(cloud.v1_open_blockers(t)) > 0 then
    update cloud.tasks set held_flow = jsonb_strip_nulls(jsonb_build_object('verb', p_verb,
        'text', nullif(btrim(coalesce(p_text, '')), ''))),
      status = 'queued', failure = null, result = null, updated_at = now()
    where id = p_task;
    return null;
  end if;
  r := cloud.v1_task_runtime(t);
  select x.* into f from cloud.project_folders x
    left join cloud.runners rr on rr.owner_id = t.account_id and rr.machine_id = x.machine_id and rr.live_until > now()
   where x.project_id = t.project_id and x.account_id = t.account_id
   order by rr.owner_id is not null desc, x.updated_at desc limit 1;
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, prompt, flow)
  values (t.account_id, r.connector, r.model, t.project_id, f.path, f.machine_id, t.id,
          format('akb %s: %s', p_verb, t.title),
          jsonb_strip_nulls(jsonb_build_object('verb', p_verb, 'workflow', t.workflow ->> 'id', 'card', t.run_card,
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end,
            'skip_plan', case when p_verb = 'create' and t.skip_plan then true end,
            'metadata', case when p_verb = 'create' then nullif(t.card_metadata
              - array['phases', 'phase', 'schedule', 'parent', 'source'], '{}') end)))
  returning * into j;
  -- Past 0088's binding, as 0090's resume.
  select x.* into f from cloud.project_folders x
   where x.project_id = t.project_id and x.account_id = t.account_id
     and x.machine_id = (select y.claimed_machine from cloud.runner_jobs y
                         where y.task_id = t.id and y.flow is not null and y.claimed_machine is not null
                         order by y.seq desc limit 1);
  if found then
    update cloud.runner_jobs set machine_id = f.machine_id, project_dir = f.path where id = j.id returning * into j;
  end if;
  if t.discussion_id is not null and p_verb in ('create', 'refine', 'resolve', 'revise') then
    perform cloud.v1_carry_session(j.id, t.account_id);
    if p_verb in ('resolve', 'revise') then
      update cloud.task_chats h set job_id = j.id, failure = null, updated_at = now()
       where h.task_id = t.id and h.account_id = t.account_id and (cloud.task_chat_job(h)).id is null;
      if found then perform cloud.v1_chat_changed(t.id, t.account_id); end if;
    end if;
    select * into j from cloud.runner_jobs where id = j.id;
  end if;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', held_flow = null, failure = null, result = null, updated_at = now()
  where id = p_task;
  return j;
end;
$$;

-- 0092's, carrying a discussion task's session.
create or replace function cloud.v1_chat_send(p_account uuid, p_task text, p_body text, p_runtime text, p_daily_write_budget integer,
                                   p_images jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  h cloud.task_chats;
  r cloud.runtimes;
  v_pick text;
  v_ready text;
  v_key text;
  v_job uuid;
begin
  select * into t from cloud.tasks where id = p_task for update;
  insert into cloud.task_chats (task_id, account_id) values (p_task, p_account) on conflict do nothing;
  select * into h from cloud.task_chats where task_id = p_task and account_id = p_account;
  if (cloud.task_chat_job(h)).id is not null then
    raise exception 'A reply is still on its way.' using errcode = 'AKB26', detail = 'chat_busy';
  end if;
  v_pick := case when p_runtime is null then h.runtime when p_runtime = 'task' then null
                 else (cloud.v1_own_runtime(p_account, p_runtime)).id end;
  if v_pick is null then r := cloud.v1_task_runtime(t);
  else select * into r from cloud.runtimes where id = v_pick;
  end if;
  if not exists (select 1 from cloud.runners x where x.owner_id = t.account_id and x.live_until > now()) then
    raise exception 'The Runner this task runs on is not connected.' using errcode = 'AKB26', detail = 'runner_offline';
  end if;
  v_ready := cloud.v1_connectors(t.account_id) ->> r.connector;
  if v_ready in ('not_installed', 'signed_out') then
    raise exception '% is not ready on the computer running this task.', r.connector
      using errcode = 'AKB30', detail = r.connector, hint = v_ready;
  end if;
  insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
  values (cloud.v1_id('msg'), p_task, p_account, 'user', coalesce(p_body, ''), cloud.v1_image_names(p_images));
  v_job := (api.dispatch_runner_job(t.account_id, r.connector, null, cloud.task_chat_prompt(p_task, p_account),
                                    cloud.v1_image_files(p_images), p_daily_write_budget, p_task) ->> 'id')::uuid;
  perform cloud.v1_refuse_removed(v_job, t.workspace_id);
  v_key := cloud.v1_session_key(r.connector, r.model);
  update cloud.runner_jobs set model = r.model,
    resume = case when h.session_runtime is not distinct from v_key then h.session end
  where id = v_job;
  perform cloud.v1_carry_session(v_job, p_account);
  update cloud.task_chats set runtime = v_pick, job_id = v_job, failure = null,
    session = case when session_runtime is distinct from v_key then null else session end,
    context = case when session_runtime is distinct from v_key then null else context end,
    updated_at = now()
  where task_id = p_task and account_id = p_account;
  perform cloud.v1_chat_changed(p_task, p_account);
  return cloud.task_chat_json(p_account, p_task);
end;
$$;

-- 0074's, its first step carrying the discussion's session.
create or replace function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
  i cloud.discussion_ideas;
  t cloud.tasks;
  v_task jsonb;
  v_job uuid;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  i := cloud.v1_open_idea(d, p_idea);
  if p_workflow ->> 'id' is distinct from i.workflow then perform cloud.v1_refuse('This idea''s workflow has changed.'); end if;
  v_task := api.v1_create_task(p_account, jsonb_strip_nulls(jsonb_build_object(
      'title', i.title,
      'request', btrim(concat(i.outcome, E'\n\n## Done when\n' || (
        select string_agg('- ' || btrim(a), E'\n' order by n) from jsonb_array_elements_text(i.acceptance) with ordinality x(a, n))),
        E'\n'),
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account))),
    p_workflow, p_daily_write_budget, p_max_tasks);
  update cloud.tasks set discussion_id = p_discussion where id = v_task ->> 'id' returning * into t;
  for v_job in select j.id from cloud.runner_jobs j where j.task_id = t.id and j.state = 'waiting' loop
    perform cloud.v1_carry_session(v_job, t.account_id);
  end loop;
  update cloud.discussion_ideas set state = 'started', task_id = t.id, updated_at = now() where id = p_idea;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  perform cloud.v1_discussion_changed(p_discussion);
  return cloud.v1_task_json(t);
end;
$$;

-- 0087's: a discussion task's job writes the session it reported back to the task chat, and
-- hands it to the task's jobs still waiting; a retry carries the session as it was.
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
  v_files jsonb := v_job.attachments;
  v_outcome text := p_outcome;
  v_reason text := nullif(p_reason, '');
  v_retry cloud.runner_jobs;
  v_reply text := nullif(btrim(left(coalesce(p_report ->> 'reply', ''), 60000)), '');
  v_stopped boolean := coalesce(p_report -> 'stopped' = 'true'::jsonb, false);
  v_session text := nullif(p_report ->> 'session', '');
  h cloud.task_chats;
  d cloud.discussions;
  v_start jsonb := '[]';
begin
  if v_job.id is null then
    return json_build_object('finished', false);
  end if;
  if v_job.task_id is not null then perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id)); end if;
  if v_job.discussion_id is not null then
    perform cloud.v1_lock((select x.workspace_id from cloud.discussions x where x.id = v_job.discussion_id));
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
         reply = v_reply,
         usage = case when jsonb_typeof(p_report -> 'usage') = 'object' then p_report -> 'usage' end,
         cost_usd = case when jsonb_typeof(p_report -> 'costUsd') = 'number' then (p_report ->> 'costUsd')::numeric end,
         elapsed_ms = case when jsonb_typeof(p_report -> 'ms') = 'number' then (p_report ->> 'ms')::integer end,
         finished_at = now(),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_outcome = 'conflict' then
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, stage, flow,
                                   attempt, resume, fork, transcript_of, prompt, attachments)
    values (v_job.owner_id, v_job.runtime, v_job.model, v_job.project_id, v_job.project_dir, v_job.machine_id,
            v_job.task_id, v_job.stage, v_job.flow, 2, v_job.resume, v_job.fork, v_job.transcript_of, v_job.prompt, v_files)
    returning * into v_retry;
    perform cloud.hint_runner(v_job.owner_id, v_retry.id);
  end if;
  if v_job.task_id is not null and cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_outcome = 'done' and v_job.stage = 'plan' then perform cloud.v1_submit_draft(v_job.task_id); end if;
    if v_job.flow is not null then perform cloud.v1_finish_flow(v_job, p_report); end if;
  end if;

  for h in select * from cloud.task_chats where job_id = p_job loop
    if v_outcome = 'done' and v_reply is not null then
      insert into cloud.task_chat_messages (id, task_id, account_id, role, body, stopped, job_id)
      values (cloud.v1_id('msg'), h.task_id, h.account_id, 'agent', v_reply, v_stopped, p_job);
    end if;
    update cloud.task_chats set
      job_id = v_retry.id,
      session = case when v_job.flow is null then coalesce(v_session, session) else session end,
      session_runtime = case when v_job.flow is null and v_session is not null
                             then cloud.v1_session_key(v_job.runtime, v_job.model) else session_runtime end,
      context = case when v_job.flow is null then coalesce(p_report -> 'context', context) else context end,
      failure = case v_outcome when 'failed' then
        case when v_reason = 'The card was updated elsewhere.' then 'conflict' else 'failed' end end,
      updated_at = now()
    where task_id = h.task_id and account_id = h.account_id;
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;

  if v_job.transcript_of is not null and v_session is not null then
    if v_job.flow is not null then
      insert into cloud.task_chats (task_id, account_id) values (v_job.task_id, v_job.owner_id) on conflict do nothing;
      update cloud.task_chats set session = v_session,
        session_runtime = cloud.v1_session_key(v_job.runtime, v_job.model),
        context = coalesce(p_report -> 'context', context), updated_at = now()
      where task_id = v_job.task_id and account_id = v_job.owner_id;
    end if;
    update cloud.runner_jobs set resume = v_session, fork = false, updated_at = now()
     where task_id = v_job.task_id and transcript_of is not null and state = 'waiting' and id <> p_job
       and cloud.v1_session_key(runtime, model) = cloud.v1_session_key(v_job.runtime, v_job.model);
  end if;

  select * into d from cloud.discussions where id = v_job.discussion_id and job_id = p_job for update;
  if d.id is not null then
    if v_outcome = 'done' then
      if v_reply is not null then
        insert into cloud.discussion_messages (id, discussion_id, role, body, stopped, job_id)
        values (cloud.v1_id('msg'), d.id, 'agent', v_reply, v_stopped, p_job);
      end if;
      if not v_stopped then v_start := cloud.v1_apply_ideas(d.id, p_report -> 'ideas'); end if;
    end if;
    update cloud.discussions set
      job_id = null,
      session = coalesce(v_session, session),
      session_runtime = case when v_session is not null
                             then cloud.v1_session_key(v_job.runtime, v_job.model) else session_runtime end,
      context = coalesce(p_report -> 'context', context),
      failure = case when v_outcome = 'failed' then 'failed' end,
      updated_at = now()
    where id = d.id;
    perform cloud.v1_discussion_changed(d.id);
  end if;
  return json_build_object('finished', true, 'job', cloud.runner_job_json(v_job),
    'retry', case when v_retry.id is null then null else cloud.runner_job_json(v_retry) end,
    'discussion', d.id, 'start', v_start);
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
