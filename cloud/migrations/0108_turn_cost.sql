-- Each reply's own cost (#35). Claude Code reports the session's running total, so a job's
-- `cost_usd` is that total less the total of the job whose session it carried on.
--
-- - **No total before it**: a job carrying on a session whose last job left no total shows
--   no cost rather than the history's.
-- - **A copied session**: a discussion's session forked into a task starts from the
--   discussion's total.
-- - **History**: earlier jobs are worked out the same way, so the daily stats stop counting a
--   turn's history again.

alter table cloud.runner_jobs
  add column session text,
  add column session_cost_usd numeric;

create index runner_jobs_session on cloud.runner_jobs (session, finished_at) where session is not null;

/** What this job spent itself, from what its connector reported. A total lower than the one
 *  before is a new session, so it is the job's own. */
create function cloud.runner_turn_cost(p_job cloud.runner_jobs, p_total numeric) returns numeric
language plpgsql stable set search_path = '' as $$
declare
  v_before cloud.runner_jobs;
begin
  if p_total is null or p_job.runtime <> 'claude-code' or p_job.flow is not null or p_job.resume is null then
    return p_total;
  end if;
  select * into v_before from cloud.runner_jobs
   where session = p_job.resume and id <> p_job.id and state = 'finished'
     and finished_at < coalesce(p_job.finished_at, 'infinity')
   order by finished_at desc, seq desc limit 1;
  if v_before.session_cost_usd is null then return null; end if;
  if p_total < v_before.session_cost_usd then return p_total; end if;
  return nullif(p_total - v_before.session_cost_usd, 0);
end;
$$;

-- History: a chat's job reported the session it carried on, and a first turn the one its next
-- job carried on.
update cloud.runner_jobs set session_cost_usd = cost_usd
 where state = 'finished' and runtime = 'claude-code' and flow is null and cost_usd is not null;
update cloud.runner_jobs set session = resume
 where session_cost_usd is not null and resume is not null and not fork;
update cloud.runner_jobs j set session = (
    select n.resume from cloud.runner_jobs n
     where n.owner_id = j.owner_id and n.task_id is not distinct from j.task_id
       and n.discussion_id is not distinct from j.discussion_id and n.flow is null
       and n.runtime = j.runtime and n.created_at > j.finished_at
     order by n.created_at limit 1)
 where session_cost_usd is not null and (resume is null or fork);
update cloud.runner_jobs j set cost_usd = cloud.runner_turn_cost(j, j.session_cost_usd)
 where session_cost_usd is not null;

-- 0094's, keeping the session a job reported and the cost of its own turn.
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
