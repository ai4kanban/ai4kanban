-- A job carries the interface language of the message that started it (#11). The Worker
-- forwards the web's `x-akb-lang` header; a job made with none, such as a plan's next step,
-- takes its task's or discussion's last one. The Runner ends the prompt in that language.

alter table cloud.runner_jobs add column lang text check (lang in ('en', 'zh'));

create index runner_jobs_task_seq on cloud.runner_jobs (task_id, seq) where task_id is not null;
create index runner_jobs_discussion_seq on cloud.runner_jobs (discussion_id, seq) where discussion_id is not null;

create function cloud.runner_job_lang() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_said text := nullif(current_setting('request.headers', true), '')::json ->> 'x-akb-lang';
begin
  if new.lang is not null then return new; end if;
  if v_said in ('en', 'zh') then
    new.lang := v_said;
  elsif new.task_id is not null then
    new.lang := (select j.lang from cloud.runner_jobs j where j.task_id = new.task_id order by j.seq desc limit 1);
  elsif new.discussion_id is not null then
    new.lang := (select j.lang from cloud.runner_jobs j where j.discussion_id = new.discussion_id order by j.seq desc limit 1);
  end if;
  return new;
end;
$$;

create trigger runner_job_lang before insert on cloud.runner_jobs
  for each row execute function cloud.runner_job_lang();

-- 0094's, with the language.
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
    'lang', p_job.lang,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;
