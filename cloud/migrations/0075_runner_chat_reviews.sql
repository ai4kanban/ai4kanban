-- Chat memory reviewed on the Runner (#2065).
--
-- - **A chat belongs to the computer that answered it last**: `task_chats.machine_id`, set as
--   its job is claimed. Only that Runner reviews the task's conversation.
-- - **The Runner asks for its own review job**: pinned to it and carrying the tasks, so the
--   review writes the board back like any job.
-- - **Task chats are kept 30 days**: `api.sweep_task_chats` drops older messages and the chats
--   they leave empty; the Runner keeps its own copy as long.

alter table cloud.task_chats add column machine_id uuid;
alter table cloud.runner_jobs add column review jsonb;

create function cloud.note_chat_machine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cloud.task_chats set machine_id = new.claimed_machine where job_id = new.id;
  return null;
end;
$$;

create trigger runner_jobs_chat_machine after update of claimed_machine on cloud.runner_jobs
  for each row when (new.claimed_machine is not null and new.claimed_machine is distinct from old.claimed_machine)
  execute function cloud.note_chat_machine();

-- A chat's job carries the message it answers; a review job its tasks.
create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'model', p_job.model,
    'test', p_job.test,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', p_job.project_dir,
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
      where h.job_id = p_job.id limit 1),
    'review', p_job.review,
    'stage', p_job.stage,
    'flow', p_job.flow,
    'number', (select t.number from cloud.tasks t where t.id = p_job.task_id),
    'workflow', (select v.workflow_id from cloud.tasks t join cloud.workflow_versions v on v.id = t.workflow_version
                 where t.id = p_job.task_id),
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

-- The archived tasks whose chat this computer answered last, within the days kept.
create function api.runner_chats(p_subject uuid, p_machine uuid, p_days integer) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('task', t.id, 'project', t.project_id) order by t.id)
    from (select distinct on (h.task_id) h.task_id, h.machine_id from cloud.task_chats h
          where h.updated_at > now() - make_interval(days => p_days)
          order by h.task_id, h.updated_at desc) h
    join cloud.tasks t on t.id = h.task_id
    where h.machine_id = p_machine and t.account_id = p_subject and t.project_id is not null
      and t.card_path like '.archive/%'
  ), '[]'::json);
end;
$$;

-- A review of these tasks' chats, run by this computer on the project's board. One at a time
-- per project: a review still going is answered instead.
create function api.dispatch_runner_review(p_subject uuid, p_machine uuid, p_project text, p_tasks text[],
                                           p_runtime text, p_model text, p_daily_write_budget integer)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_job cloud.runner_jobs;
  v_tasks text[];
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    perform cloud.v1_refuse('This computer is not your connected Runner.');
  end if;
  if not exists (select 1 from cloud.projects where id = p_project and account_id = p_subject) then
    perform cloud.v1_missing('project');
  end if;
  select j.* into v_job from cloud.runner_jobs j
   where j.owner_id = p_subject and j.project_id = p_project and j.review is not null and j.state <> 'finished'
     and not cloud.runner_job_interrupted(j)
   limit 1;
  if found then return cloud.runner_job_json(v_job); end if;
  v_tasks := array(select t.id from cloud.tasks t
                    where t.id = any(p_tasks) and t.project_id = p_project and t.account_id = p_subject order by t.id);
  if cardinality(v_tasks) = 0 then perform cloud.v1_missing('task'); end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, prompt, review)
  values (p_subject, p_runtime, p_model, p_project,
          (select f.path from cloud.project_folders f where f.project_id = p_project and f.machine_id = p_machine),
          p_machine, 'Review chat memory.', jsonb_build_object('tasks', to_jsonb(v_tasks)))
  returning * into v_job;
  perform cloud.hint_runner(p_subject, v_job.id);
  return cloud.runner_job_json(v_job);
end;
$$;

-- Messages past the days kept, and the chats idle as long that are left with none.
create function api.sweep_task_chats(p_days integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_messages integer;
  v_chats integer;
begin
  delete from cloud.task_chat_messages where created_at < now() - make_interval(days => p_days);
  get diagnostics v_messages = row_count;
  delete from cloud.task_chats h
   where h.job_id is null and h.updated_at < now() - make_interval(days => p_days)
     and not exists (select 1 from cloud.task_chat_messages m where m.task_id = h.task_id and m.account_id = h.account_id);
  get diagnostics v_chats = row_count;
  return jsonb_build_object('messages', v_messages, 'chats', v_chats);
end;
$$;

revoke all on function cloud.note_chat_machine() from public;
revoke all on function cloud.runner_job_json(cloud.runner_jobs) from public;
revoke all on function api.runner_chats(uuid, uuid, integer) from public;
revoke all on function api.dispatch_runner_review(uuid, uuid, text, text[], text, text, integer) from public;
revoke all on function api.sweep_task_chats(integer) from public;
grant execute on function api.runner_chats(uuid, uuid, integer) to service_role;
grant execute on function api.dispatch_runner_review(uuid, uuid, text, text[], text, text, integer) to service_role;
grant execute on function api.sweep_task_chats(integer) to service_role;
