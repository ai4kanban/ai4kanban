-- Where a task's work landed (#2109): the commit its build landed as, the branch, and the
-- computer, named as it was when the task finished. The diff is never stored: a page asks for
-- it, the computer holding the commit is hinted, and its answer goes straight back to the page.
--
-- - **`landing`**: `{commit, branch, machine}`, what the task JSON shows.
-- - **`landed_owner`, `landed_machine`**: whose Runner on which computer to ask for the diff.

alter table cloud.tasks add column landing jsonb, add column landed_owner uuid, add column landed_machine uuid;

-- 0059's, keeping a landed build's commit.
create or replace function cloud.v1_finish_flow(j cloud.runner_jobs, p_report jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  r jsonb := p_report -> 'review';
  l jsonb := p_report -> 'landing';
  v_card integer := case when jsonb_typeof(p_report -> 'card') = 'number' then (p_report ->> 'card')::integer end;
begin
  select * into t from cloud.tasks where id = j.task_id for update;
  if t.status in ('done', 'failed', 'cancelled') or j.outcome = 'conflict' then return; end if;
  if v_card > 0 then update cloud.tasks set run_card = v_card where id = t.id returning * into t; end if;
  if j.outcome = 'failed' then
    update cloud.tasks set status = 'failed', failure = coalesce(j.reason, 'The run failed.'), updated_at = now()
     where id = t.id returning * into t;
  elsif j.flow ->> 'verb' = 'implement' and jsonb_typeof(r) is distinct from 'object' then
    update cloud.tasks set status = 'done', result = j.reply, updated_at = now(),
      landing = case when jsonb_typeof(l) = 'object' then jsonb_build_object('commit', l ->> 'commit',
        'branch', coalesce(l ->> 'branch', ''),
        'machine', coalesce((select x.machine_name from cloud.runners x where x.owner_id = j.owner_id and x.machine_id = j.claimed_machine), '')) end,
      landed_owner = case when jsonb_typeof(l) = 'object' then j.owner_id end,
      landed_machine = case when jsonb_typeof(l) = 'object' then j.claimed_machine end
     where id = t.id returning * into t;
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

-- 0052's, with the landing.
create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select cloud.v1_task_fields_json(t)
    || jsonb_build_object('key', (select p.prefix from cloud.projects p where p.id = t.project_id) || '-' || t.number,
         'landing', t.landing);
$$;

-- Where to ask for a task's diff: null when it landed nothing; `online` when the computer
-- holding the commit is its owner's connected Runner.
create function api.v1_task_landing(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select * into t from cloud.tasks where id = p_task;
  if t.landing is null then return null; end if;
  return jsonb_build_object('commit', t.landing ->> 'commit', 'project', t.project_id,
    'owner', t.landed_owner, 'machine', t.landed_machine,
    'online', exists (select 1 from cloud.runners x
                       where x.owner_id = t.landed_owner and x.machine_id = t.landed_machine and x.live_until > now()));
end;
$$;
revoke all on function api.v1_task_landing(uuid, text) from public;
grant execute on function api.v1_task_landing(uuid, text) to service_role;

-- Ask the Runner for a commit's diff, answered under `p_request`.
create function api.hint_runner_diff(p_owner uuid, p_request text, p_project text, p_commit text) returns void
language sql security definer set search_path = '' as $$
  select cloud.hint_desktop(p_owner, 'diff', jsonb_build_object('diff', p_request, 'project', p_project, 'commit', p_commit));
$$;
revoke all on function api.hint_runner_diff(uuid, text, text, text) from public;
grant execute on function api.hint_runner_diff(uuid, text, text, text) to service_role;
