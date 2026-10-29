-- The web's interface language, kept on the account (#47). A job made with no request language,
-- such as a plan's next step, takes its task's or discussion's starter's, before its last job's.
-- Cloud writes the language line itself; the Runner and the plugins pass it on as it is.

alter table cloud.accounts add column lang text check (lang in ('en', 'zh'));

create function api.v1_set_language(p_account uuid, p_lang text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_lang is null or p_lang not in ('en', 'zh') then perform cloud.v1_refuse('Language must be en or zh.'); end if;
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.accounts set lang = p_lang where id = p_account;
  return jsonb_build_object('lang', p_lang);
end;
$$;

create or replace function cloud.runner_job_lang() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_said text := nullif(current_setting('request.headers', true), '')::json ->> 'x-akb-lang';
begin
  if new.lang is not null then return new; end if;
  if v_said in ('en', 'zh') then
    new.lang := v_said;
  elsif new.task_id is not null then
    new.lang := coalesce(
      (select a.lang from cloud.tasks t join cloud.accounts a on a.id = t.account_id where t.id = new.task_id),
      (select j.lang from cloud.runner_jobs j where j.task_id = new.task_id order by j.seq desc limit 1));
  elsif new.discussion_id is not null then
    new.lang := coalesce(
      (select a.lang from cloud.discussions d join cloud.accounts a on a.id = d.account_id where d.id = new.discussion_id),
      (select j.lang from cloud.runner_jobs j where j.discussion_id = new.discussion_id order by j.seq desc limit 1));
  else
    new.lang := (select a.lang from cloud.accounts a where a.id = new.owner_id);
  end if;
  return new;
end;
$$;

-- The line every prompt a job's agent is given ends with; empty when no language is known.
create function cloud.language_line(p_lang text) returns text
language sql immutable set search_path = '' as $$
  select case p_lang when 'zh' then '请用中文回复和写作。' when 'en' then 'Reply and write in English.' else '' end;
$$;

-- 0106's, with `prompt` ending in the language line and `languageLine` for the runs akb makes.
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
    'prompt', case when p_job.test or p_job.flow is not null or p_job.review is not null or p_job.agent is not null
                     or cloud.language_line(p_job.lang) = '' then p_job.prompt
                   else concat_ws(E'\n\n', nullif(p_job.prompt, ''), cloud.language_line(p_job.lang)) end,
    'languageLine', case when p_job.test then '' else cloud.language_line(p_job.lang) end,
    'attachments', p_job.attachments,
    'state', case when cloud.runner_job_interrupted(p_job) then 'interrupted' else p_job.state end,
    'outcome', p_job.outcome,
    'reason', p_job.reason,
    'leaseExpiresAt', p_job.lease_expires_at,
    'createdAt', p_job.created_at,
    'finishedAt', p_job.finished_at
  );
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname = 'v1_set_language')
       or (n.nspname = 'cloud' and p.proname = 'language_line')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
