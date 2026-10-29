-- A plan's task limit counts running tasks only (#2209). A task is always made; past the limit it
-- stays queued, and a Runner is handed its step once a running task of the same payer ends,
-- earliest made first. The plan's numbers live in the Worker, which passes each payer's limit to
-- `list_runner_jobs` and `claim_runner_job` as `{account: limit}`.

-- The last limit the Worker passed, so a task can say it waits for a slot.
alter table cloud.accounts add column running_limit integer;

create or replace function cloud.v1_open_tasks(p_account uuid) returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
  where w.account_id = p_account and t.status = 'running';
$$;

-- Running places left on the payer's plan; null when no limit was passed for it.
create function cloud.v1_slots_left(p_account uuid, p_limits jsonb) returns integer
language sql stable security definer set search_path = '' as $$
  select (p_limits ->> p_account::text)::integer - cloud.v1_open_tasks(p_account);
$$;

create function cloud.v1_note_limits(p_limits jsonb) returns void
language sql security definer set search_path = '' as $$
  update cloud.accounts a set running_limit = l.value::integer
    from jsonb_each_text(coalesce(p_limits, '{}')) l
   where a.id = l.key::uuid and a.running_limit is distinct from l.value::integer;
$$;

create function cloud.v1_waiting_for_slot(t cloud.tasks) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when t.status = 'queued' and t.run then coalesce((
    select a.running_limit <= cloud.v1_open_tasks(a.id) from cloud.accounts a where a.id = cloud.v1_payer_of(t.workspace_id)), false)
    else false end;
$$;

-- 0090's, saying when it waits for a slot.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing, 'resume', cloud.v1_resume_json(t), 'waiting_for_slot', cloud.v1_waiting_for_slot(t));
$$;

-- A task starting or ending running that fills or frees the payer's plan retells its queued tasks.
create function cloud.running_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payer uuid := cloud.v1_payer_of(new.workspace_id);
  v_limit integer := (select a.running_limit from cloud.accounts a where a.id = v_payer);
  v_now integer;
  t cloud.tasks;
begin
  if v_limit is null or (old.status = 'running') = (new.status = 'running') then return null; end if;
  v_now := cloud.v1_open_tasks(v_payer);
  if (v_now >= v_limit) = (v_now + case when new.status = 'running' then -1 else 1 end >= v_limit) then return null; end if;
  for t in select x.* from cloud.tasks x join cloud.v1_workspaces w on w.id = x.workspace_id
           where w.account_id = v_payer and x.status = 'queued' and x.run loop
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  end loop;
  return null;
end;
$$;
create trigger running_changed after update of status on cloud.tasks for each row execute function cloud.running_changed();

-- ---------------------------------------------------------------------------
-- Making a task: no longer refused for the tasks it has
-- ---------------------------------------------------------------------------

drop function api.v1_create_task(uuid, jsonb, jsonb, integer, integer);

-- 0104's, with no task limit.
create function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  m jsonb := p_fields -> 'metadata';
  v_project text := p_fields ->> 'project';
  v_ws text;
begin
  v_ws := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_fields #>> '{context,workflow}' is not null then
    if p_workflow ->> 'id' <> 'wf_builtin_workflow_builder' then
      perform cloud.v1_refuse('Only the Workflow builder changes a workflow.');
    end if;
    if not exists (select 1 from cloud.workflows w where w.id = p_fields #>> '{context,workflow}' and w.workspace_id = v_ws) then
      perform cloud.v1_missing('workflow');
    end if;
  end if;
  if coalesce((p_fields ->> 'skip_plan')::boolean, false) and not coalesce((p_fields ->> 'run')::boolean, false) then
    raise exception 'skip_plan needs run.' using errcode = 'AKB28';
  end if;
  if p_fields ? 'runtime' then perform cloud.v1_own_runtime(p_account, p_fields ->> 'runtime'); end if;
  if (p_workflow ->> 'builtin')::boolean then
    if not cloud.v1_installed(v_ws, p_workflow ->> 'id') then perform cloud.v1_missing('workflow'); end if;
    v := cloud.v1_builtin_version(p_workflow);
  else
    select v2.* into v from cloud.workflows w
      join cloud.workflow_versions v2 on v2.workflow_id = w.id and v2.version = w.version
     where w.id = p_workflow ->> 'id' and w.workspace_id = v_ws;
    if not found then perform cloud.v1_missing('workflow'); end if;
  end if;
  insert into cloud.tasks (id, account_id, workspace_id, project_id, workflow, workflow_version, title, request, source,
                           source_context, context, run, runtime, skip_plan, images, machine_id)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime',
          coalesce((p_fields ->> 'skip_plan')::boolean, false), coalesce(p_fields -> 'images', '[]'),
          case when coalesce((p_fields ->> 'run')::boolean, false)
            then cloud.v1_task_machine(p_account, v_ws, v_project, (p_fields ->> 'machine')::uuid) end)
  returning * into t;
  if jsonb_typeof(m) = 'object' then
    update cloud.tasks set card_metadata = jsonb_strip_nulls(jsonb_build_object(
        'priority', m -> 'priority', 'roi', m -> 'roi', 'modules', m -> 'modules',
        'related', case when m ? 'related' then cloud.v1_task_refs(t, m -> 'related', 'related') end,
        'blocked_by', case when m ? 'blocked_by' then cloud.v1_task_refs(t, m -> 'blocked_by', 'blocked_by') end))
    where id = t.id returning * into t;
  end if;
  if t.run then
    j := cloud.v1_dispatch_flow(t.id, 'create', t.request);
    perform cloud.v1_refuse_removed(j.id, v_ws);
    insert into cloud.task_chats (task_id, account_id, job_id) values (t.id, p_account, j.id);
    insert into cloud.task_chat_messages (id, task_id, account_id, role, body, image_names)
    values (cloud.v1_id('msg'), t.id, p_account, 'user', coalesce(nullif(btrim(t.request), ''), t.title),
            cloud.v1_image_names(t.images));
    perform cloud.v1_chat_changed(t.id, p_account);
    select * into t from cloud.tasks where id = t.id;
  end if;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

drop function api.v1_start_idea(uuid, text, text, text, jsonb, integer, integer, integer, boolean, uuid);

-- 0104's, with no task limit.
create function api.v1_start_idea(
  p_account uuid, p_discussion text, p_idea text, p_project text, p_workflow jsonb, p_daily_write_budget integer,
  p_expected_version integer default null, p_skip_plan boolean default false, p_machine uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.discussions := cloud.v1_own_discussion(p_account, p_discussion);
  i cloud.discussion_ideas;
  t cloud.tasks;
  v_task jsonb;
  v_job uuid;
begin
  perform cloud.v1_write(p_account, d.workspace_id, p_daily_write_budget);
  select * into d from cloud.discussions where id = p_discussion for update;
  if d.request_id is not null then
    select * into t from cloud.tasks where id = (
      select x.task_id from cloud.discussion_ideas x where x.id = p_idea and x.discussion_id = d.id and x.state = 'started');
    if t.id is not null then return cloud.v1_task_json(t); end if;
    if d.version is distinct from p_expected_version then
      raise exception 'The ideas changed since version %; read them and start again.', p_expected_version using errcode = 'AKB27';
    end if;
  end if;
  i := cloud.v1_open_idea(d, p_idea);
  if p_workflow ->> 'id' is distinct from i.workflow then perform cloud.v1_refuse('This idea''s workflow has changed.'); end if;
  v_task := api.v1_create_task(p_account, jsonb_strip_nulls(jsonb_build_object(
      'title', i.title,
      'request', btrim(concat(i.outcome, E'\n\n## Done when\n' || (
        select string_agg('- ' || btrim(a), E'\n' order by n) from jsonb_array_elements_text(i.acceptance) with ordinality x(a, n))),
        E'\n'),
      'workspace', d.workspace_id, 'project', coalesce(p_project, d.project_id), 'source', 'web', 'run', true, 'skip_plan', p_skip_plan,
      'runtime', (select x.id from cloud.runtimes x where x.id = d.runtime and x.account_id = p_account),
      'machine', p_machine)),
    p_workflow, p_daily_write_budget);
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

-- ---------------------------------------------------------------------------
-- The Runner: a queued task's step waits for a running place
-- ---------------------------------------------------------------------------

-- Whose plan the Worker must read for this Runner's jobs: payers of queued tasks' waiting steps it
-- may be handed, or of the one job named.
create function api.runner_job_payers(p_subject uuid, p_machine uuid, p_job uuid default null) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(distinct cloud.v1_payer_of(t.workspace_id)), '[]'::json)
  from cloud.runner_jobs j join cloud.tasks t on t.id = j.task_id
  where j.state = 'waiting' and j.flow is not null and t.status = 'queued'
    and case when p_job is not null then j.id = p_job
             else (j.owner_id = p_subject or j.machine_id = p_machine and cloud.runner_job_host(j) = p_subject)
                  and (j.machine_id is null or j.machine_id = p_machine) end;
$$;

drop function api.list_runner_jobs(uuid, uuid);

-- 0104's, handing a queued task's step over only while its payer has a running place, earliest
-- task first.
create function api.list_runner_jobs(p_subject uuid, p_machine uuid, p_running_limits jsonb default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_runner cloud.runners := cloud.runner_for(p_subject, p_machine);
begin
  if v_runner.owner_id is null then return '[]'::json; end if;
  perform cloud.v1_requeue_lapsed(p_subject);
  perform cloud.v1_note_limits(p_running_limits);
  return coalesce((
    select json_agg(cloud.runner_job_json(v.j) order by (v.j).created_at, (v.j).seq)
    from (
      select j, x.payer, case when x.payer is not null
        then row_number() over (partition by x.payer order by t.created_at, t.id) end as place
      from cloud.runner_jobs j
      left join cloud.tasks t on t.id = j.task_id
      cross join lateral (select case when j.state = 'waiting' and j.flow is not null and t.status = 'queued'
                                      then cloud.v1_payer_of(t.workspace_id) end as payer) x
      where (j.owner_id = p_subject or j.machine_id = p_machine and cloud.runner_job_host(j) = p_subject
             or j.claimed_by = p_subject)
        and (j.machine_id is null or j.machine_id = p_machine)
        and (j.agent is null or v_runner.protocol >= 6 and exists (select 1 from cloud.project_folders f
                                        where f.project_id = j.project_id and f.machine_id = p_machine))
        and ((j.state = 'waiting' and not cloud.runner_job_queued(j) and not cloud.runner_job_removed(j, p_machine))
             or (j.state = 'claimed' and j.claimed_machine = p_machine and coalesce(j.claimed_by, j.owner_id) = p_subject
                 and not cloud.runner_job_interrupted(j)))
    ) v
    where v.payer is null or v.place <= coalesce(cloud.v1_slots_left(v.payer, p_running_limits), v.place)
  ), '[]'::json);
end;
$$;

drop function api.claim_runner_job(uuid, uuid, uuid, integer, integer);

-- 0104's, refusing a queued task's step while its payer's running places are full.
create function api.claim_runner_job(
  p_subject uuid,
  p_machine uuid,
  p_job uuid,
  p_lease_seconds integer,
  p_daily_write_budget integer,
  p_running_limits jsonb default null
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job cloud.runner_jobs;
  t cloud.tasks;
  v_payer uuid;
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then
    return json_build_object('claimed', false, 'reason', 'This computer is not your connected Runner.');
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job;
  if v_job.id is null then
    return json_build_object('claimed', false, 'reason', 'There is no such job.');
  end if;
  if v_job.owner_id <> p_subject
     and (v_job.machine_id is distinct from p_machine or cloud.runner_job_host(v_job) is distinct from p_subject) then
    perform cloud.require_owner(v_job.owner_id, p_subject);
  end if;
  if v_job.task_id is not null then
    if not cloud.v1_in(p_subject, cloud.v1_task_workspace(v_job.task_id)) then
      return json_build_object('claimed', false, 'reason', 'There is no such job.');
    end if;
    perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id));
    -- Every Runner claiming for this payer waits here, so two never take its last place.
    v_payer := cloud.v1_payer_of(cloud.v1_task_workspace(v_job.task_id));
    perform pg_advisory_xact_lock(hashtextextended('cloud.v1:' || v_payer::text, 0));
    select * into t from cloud.tasks where id = v_job.task_id for update;
  end if;
  select * into v_job from cloud.runner_jobs where id = p_job for update;
  if v_job.state <> 'waiting' then
    return json_build_object('claimed', false, 'reason', 'That job has already been taken.');
  end if;
  if v_job.machine_id is not null and v_job.machine_id <> p_machine then
    return json_build_object('claimed', false, 'reason', 'That job runs on another computer.');
  end if;
  if cloud.runner_job_removed(v_job, p_machine) then
    return json_build_object('claimed', false, 'reason', 'This computer was removed from that workspace.');
  end if;
  if cloud.runner_job_queued(v_job) then
    return json_build_object('claimed', false, 'reason', 'An earlier job of this task has not ended.');
  end if;
  perform cloud.v1_note_limits(p_running_limits);
  if v_job.flow is not null and t.status = 'queued' and cloud.v1_slots_left(v_payer, p_running_limits) <= 0 then
    return json_build_object('claimed', false, 'reason', 'The plan''s running tasks are all in use.');
  end if;

  perform cloud.count_write(p_daily_write_budget);
  update cloud.runner_jobs
     set state = 'claimed',
         claimed_machine = p_machine,
         claimed_by = p_subject,
         lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 60)),
         updated_at = now()
   where id = p_job
  returning * into v_job;
  if v_job.flow is not null then
    update cloud.tasks set status = 'running', updated_at = now() where id = v_job.task_id and status = 'queued'
    returning * into t;
    if found then perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t)); end if;
  end if;
  return json_build_object('claimed', true, 'job', cloud.runner_job_json(v_job));
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname in ('v1_create_task', 'v1_start_idea', 'runner_job_payers', 'list_runner_jobs', 'claim_runner_job'))
       or (n.nspname = 'cloud' and p.proname in ('v1_slots_left', 'v1_note_limits', 'v1_waiting_for_slot', 'running_changed'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
