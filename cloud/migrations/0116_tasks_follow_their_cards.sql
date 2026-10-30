-- A Runner's board writes outside a job, and its tasks follow their cards there (#59): a card
-- archived or rejected on the board ends the task as the web's buttons would, a changed workflow
-- moves it, and a task waiting on review asks the card's question. Removing a running task stops
-- its step first.

-- 0066's: with no job, a computer of the caller's writes the project's board on its own.
create or replace function api.v1_board_job(p_account uuid, p_project text, p_job uuid, p_machine uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_project);
  if p_job is null then
    if not exists (select 1 from cloud.runners r where r.owner_id = p_account and r.machine_id = p_machine) then
      raise exception 'This computer is not one of yours.' using errcode = 'AKB21';
    end if;
    return jsonb_build_object('job', null, 'task', null);
  end if;
  j := cloud.held_runner_job(p_account, p_machine, p_job);
  if j.id is null then
    raise exception 'This job has ended or moved to another computer.' using errcode = 'AKB21';
  end if;
  if coalesce((select t.project_id from cloud.tasks t where t.id = j.task_id), j.project_id) is distinct from p_project then
    raise exception 'This job is not on this project.' using errcode = 'AKB21';
  end if;
  return jsonb_build_object('job', j.id, 'task', j.task_id);
end;
$$;

/** The task's waiting steps end with `p_reason`, and the chats they answered fail. */
create function cloud.v1_end_waiting(p_task text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h cloud.task_chats;
  v_ended uuid[];
begin
  with ended as (
    update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = p_reason, finished_at = now(), updated_at = now()
    where task_id = p_task and state = 'waiting' returning id
  ) select coalesce(array_agg(id), '{}') into v_ended from ended;
  for h in
    update cloud.task_chats c set job_id = null, failure = 'failed', updated_at = now()
     where c.task_id = p_task and c.job_id = any (v_ended)
    returning c.*
  loop
    perform cloud.v1_chat_changed(h.task_id, h.account_id);
  end loop;
end;
$$;

/** A task removed: a running step asked to stop, waiting ones ended. `job` is the running step
 *  whose Runner is told over its log. */
create function cloud.v1_cancel(p_account uuid, p_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs := cloud.v1_flow_job(p_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if j.state = 'claimed' then
    update cloud.runner_jobs set stop_requested = true, updated_at = now() where id = j.id;
  end if;
  perform cloud.v1_end_waiting(p_id, 'Cancelled.');
  update cloud.tasks set status = 'cancelled', cancel_reason = v_reason, cancelled_by = p_account,
    cancel_reviewed = case when v_reason is not null then false end, updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.cancelled', cloud.v1_task_json(t));
  return jsonb_build_object('result', cloud.v1_task_json(t),
    'job', case when j.state = 'claimed' and coalesce((select r.protocol from cloud.runners r
                where r.owner_id = coalesce(j.claimed_by, j.owner_id) and r.machine_id = j.claimed_machine), 0) >= 10 then j.id end);
end;
$$;

-- 0076's, stopping a running step instead of refusing; answers `{ result, job }` as a stop does.
create or replace function api.v1_cancel_task(p_account uuid, p_id text, p_daily_write_budget integer, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform 1 from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  return cloud.v1_cancel(p_account, p_id, p_reason);
end;
$$;

/** What a task waiting on review asks: the card's question `r` when it has one, else whether to
 *  approve the plan, in the request's language. */
create function cloud.v1_review_of(t cloud.tasks, r jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when jsonb_typeof(r) = 'object' then jsonb_build_object('question', r ->> 'question',
      'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'approve', false) order by o.n)
                  from jsonb_array_elements_text(r -> 'options') with ordinality o(label, n)),
      'card_question', (r ->> 'position')::integer)
    when concat(t.request, t.title) ~ '[一-鿿]' then
      '{"question": "批准这份方案？", "options": [{"label": "确认", "approve": true}, {"label": "需要修改", "approve": false}]}'
    else '{"question": "Approve this plan?", "options": [{"label": "Approve", "approve": true},
           {"label": "Request changes", "approve": false}]}' end;
$$;

-- 0104's: a task already ended keeps its status; a build that ended it by landing still names
-- where it landed and what it said.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
  v_by uuid := coalesce(j.claimed_by, j.owner_id);
  v_build boolean := (j.flow ->> 'verb' = 'implement' or (j.flow ->> 'verb' = 'create' and (j.flow ->> 'skip_plan')::boolean))
    and jsonb_typeof(r) is distinct from 'object';
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if j.outcome = 'conflict' or t.status in ('failed', 'cancelled') then return; end if;
  if t.status = 'done' and not (j.outcome = 'done' and v_build) then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'stopped' then
    update cloud.tasks set status = 'stopped', updated_at = now() where id = t.id returning * into t;
  elsif j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif v_build then
    update cloud.tasks set status = 'done', result = coalesce(j.reply, case when t.status = 'done' then result end), updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = v_by and x.machine_id = j.claimed_machine), ''))
        when t.status = 'done' then landing end,
      landed_owner = case when jsonb_typeof(l) = 'object' then v_by when t.status = 'done' then landed_owner end,
      landed_machine = case when jsonb_typeof(l) = 'object' then j.claimed_machine when t.status = 'done' then landed_machine end
     where id = t.id returning * into t;
  else
    perform cloud.v1_submit_draft(t.id, cloud.v1_review_of(t, r));
    return;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

/** The tasks whose cards a Runner wrote, brought to them: `[{ number, archived, rejected, reason,
 *  workflow?: { name, definition? }, review }]`. Archived and rejected is the web's Remove,
 *  archived alone done; `workflow` names the card's, a built-in's with its definition; `review` is
 *  the card's first open question with options, asked by a task waiting on review. A task already
 *  ended is left. Answers the running steps asked to stop. */
create function api.v1_follow_cards(p_account uuid, p_project text, p_cards jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  t cloud.tasks;
  v cloud.workflow_versions;
  w jsonb;
  v_review jsonb;
  v_done jsonb;
  v_changed boolean;
  v_stop uuid[] := '{}';
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_project);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  for e in select * from jsonb_array_elements(coalesce(p_cards, '[]')) loop
    select * into t from cloud.tasks where project_id = p_project and number = (e ->> 'number')::integer for update;
    if t.id is null or t.status in ('done', 'cancelled') then continue; end if;

    if coalesce((e ->> 'archived')::boolean, false) then
      if coalesce((e ->> 'rejected')::boolean, false) then
        v_done := cloud.v1_cancel(p_account, t.id, e ->> 'reason');
        if v_done ->> 'job' is not null then v_stop := v_stop || (v_done ->> 'job')::uuid; end if;
      else
        perform cloud.v1_end_waiting(t.id, 'Archived.');
        update cloud.tasks set status = 'done', updated_at = now() where id = t.id returning * into t;
        perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
      end if;
      continue;
    end if;

    w := e -> 'workflow';
    v := null;
    v_changed := false;
    if jsonb_typeof(w -> 'definition') = 'object' then
      if w #>> '{definition,id}' is distinct from t.workflow ->> 'id' and cloud.v1_installed(t.workspace_id, w #>> '{definition,id}') then
        v := cloud.v1_builtin_version(w -> 'definition');
      end if;
    elsif w ->> 'name' is not null then
      select v2.* into v from cloud.workflows x
        join cloud.workflow_versions v2 on v2.workflow_id = x.id and v2.version = x.version
       where x.workspace_id = t.workspace_id and x.id is distinct from t.workflow ->> 'id'
         and btrim(regexp_replace(lower(x.id), '[^a-z0-9]+', '-', 'g'), '-') = w ->> 'name';
    end if;
    if v.id is not null then
      update cloud.tasks set workflow = jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version),
        workflow_version = v.id, updated_at = now()
      where id = t.id returning * into t;
      v_changed := true;
    end if;

    if t.status = 'waiting_review' then
      v_review := case when jsonb_typeof(e -> 'review') = 'object' or t.review ? 'card_question'
        then cloud.v1_review_of(t, e -> 'review') end;
      if v_review is not null and v_review is distinct from t.review then
        update cloud.tasks set review = v_review, review_at = now(), updated_at = now() where id = t.id returning * into t;
        v_changed := true;
      end if;
    end if;
    if v_changed then
      perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
    end if;
  end loop;
  return jsonb_build_object('stop', to_jsonb(v_stop));
end;
$$;
