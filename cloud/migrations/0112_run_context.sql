-- A run reports how full its context window was (#52), for the task page's run header.

alter table cloud.runner_jobs add column context jsonb;

-- 0108's, keeping the context a job reported.
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
  v_cost numeric := case when jsonb_typeof(p_report -> 'costUsd') = 'number' then (p_report ->> 'costUsd')::numeric end;
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
         context = case when jsonb_typeof(p_report -> 'context') = 'object' then p_report -> 'context' end,
         cost_usd = cloud.runner_turn_cost(v_job, v_cost),
         session = v_session,
         session_cost_usd = case when v_job.runtime = 'claude-code' and v_job.flow is null then v_cost end,
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

-- 0104's, with `context`.
create or replace function api.read_runner_job(p_subject uuid, p_job uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  v_json jsonb;
begin
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then return null; end if;
  if v_job.flow is null or not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
    if v_job.claimed_by is distinct from p_subject then perform cloud.require_owner(v_job.owner_id, p_subject); end if;
  end if;
  v_json := cloud.runner_job_json(v_job)::jsonb;
  if p_subject is distinct from coalesce(v_job.claimed_by, cloud.runner_job_host(v_job), v_job.owner_id) then
    v_json := v_json || '{"projectDir": null, "settings": {}}';
  end if;
  return json_build_object('job', (v_json || jsonb_build_object('reply', v_job.reply, 'usage', v_job.usage, 'costUsd', v_job.cost_usd, 'context', v_job.context))::json);
end;
$$;
