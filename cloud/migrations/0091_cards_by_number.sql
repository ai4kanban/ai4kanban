-- Cards named by their task's number (#2108): `todo/12-pricing.md`, or a group's
-- `todo/12-pricing/root.md`, is the card of the project's task 12. A card file no longer carries
-- its task id.
--
-- - **Indexed by number**: a board write names each card by `number`; an assets list and a card
--   written outside a job still name the task.
-- - **A subtask's group is its parent**: a card under a group folder indexes that folder's task
--   as `parent`, so the group closes as on a local board.
-- - **A new task takes its card's fields**: `metadata` on create (`priority`, `roi`, `modules`,
--   `related`, `blocked_by`) is kept on the task and handed to the job that writes its card. A
--   task with an open blocker holds even its first step until the last blocker ends.

-- Refs of tasks in the task's project — ids, keys or numbers — as their keys.
create function cloud.v1_task_refs(t cloud.tasks, p_refs jsonb, p_field text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ref text;
  b cloud.tasks;
  v_out jsonb := '[]';
begin
  for v_ref in select jsonb_array_elements_text(coalesce(p_refs, '[]')) loop
    select x.* into b from cloud.tasks x
    where x.project_id = t.project_id and (x.id = v_ref or cloud.v1_task_key(x) = upper(v_ref) or x.number::text = v_ref);
    if b.id is null then
      raise exception 'metadata.% names %, which is not a task in this project.', p_field, v_ref using errcode = 'AKB28';
    end if;
    if b.id = t.id then
      raise exception 'A task cannot name itself in metadata.%.', p_field using errcode = 'AKB28';
    end if;
    v_out := v_out || to_jsonb(cloud.v1_task_key(b));
  end loop;
  return v_out;
end;
$$;

-- 0080's index: a card found by its task's number, and a subtask's group as its `parent`.
create or replace function cloud.v1_index_cards(p_project text, p_cards jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  t cloud.tasks;
  n integer := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(p_cards, '[]')) loop
    select * into t from cloud.tasks
    where project_id = p_project and case when e ? 'task' then id = e ->> 'task' else number = (e ->> 'number')::integer end
    for update;
    if t.id is null then continue; end if;
    if e ? 'path' and coalesce((e ->> 'deleted')::boolean, false) then
      if t.card_path = e ->> 'path' then
        update cloud.tasks set card_path = null, updated_at = now() where id = t.id returning * into t;
      end if;
    elsif e ? 'path' then
      update cloud.tasks set
        card_path = e ->> 'path',
        card_version = (e ->> 'seq')::integer,
        title = coalesce(nullif(left(btrim(e #>> '{front,title}'), 200), ''), title),
        card_status = case when e ->> 'path' like '.archive/%' then 'archived' else e #>> '{front,status}' end,
        card_metadata = case when e ? 'metadata' then cloud.v1_card_links(p_project, e -> 'links') || (e -> 'metadata')
          else (card_metadata - array['phases', 'phase', 'blocked_by', 'related', 'schedule'])
            || jsonb_strip_nulls(jsonb_build_object('phases', e #> '{front,phases}', 'phase', e #> '{front,phase}'))
            || cloud.v1_card_links(p_project, e -> 'links') end
          || case when e ? 'parent' then jsonb_build_object('parent', cloud.v1_card_keys(p_project, jsonb_build_array(e -> 'parent')) ->> 0)
             else '{}' end,
        updated_at = now()
      where id = t.id returning * into t;
      if t.review_status in ('ready', 'changes_requested') then t := cloud.v1_revise(t.id); end if;
    end if;
    if e ? 'assets' then
      update cloud.tasks set card_assets = cloud.v1_card_assets(t.id, e -> 'assets'), updated_at = now()
      where id = t.id returning * into t;
    end if;
    perform cloud.v1_emit(t.workspace_id, 'card.updated', cloud.v1_card_json(t));
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 0084's: each card found by its project and number.
create or replace function api.v1_board_moved(p_workspace text, p_cards jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update cloud.tasks t set card_version = (e ->> 'seq')::integer
    from jsonb_array_elements(coalesce(p_cards, '[]')) e
   where t.project_id = e ->> 'project' and t.number = (e ->> 'number')::integer and t.card_path = e ->> 'path'
     and t.workspace_id = p_workspace;
  get diagnostics n = row_count;
  insert into cloud.dropped_boards (board) select p.id from cloud.projects p where p.workspace_id = p_workspace
  on conflict do nothing;
  delete from cloud.board_import i using cloud.projects p where p.id = i.project_id and p.workspace_id = p_workspace;
  delete from cloud.board_moves where workspace_id = p_workspace;
  return jsonb_build_object('indexed', n);
end;
$$;

-- 0070's, also taking a task's number.
create or replace function api.v1_card_numbers(p_account uuid, p_task text, p_refs jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_ref text;
  v_number integer;
  v_out jsonb := '[]';
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select * into t from cloud.tasks where id = p_task;
  for v_ref in select jsonb_array_elements_text(coalesce(p_refs, '[]')) loop
    select b.number into v_number from cloud.tasks b
    where b.project_id = t.project_id and (b.id = v_ref or cloud.v1_task_key(b) = upper(v_ref) or b.number::text = v_ref);
    if v_number is null then
      raise exception 'metadata.blocked_by names %, which is not a task in this project.', v_ref using errcode = 'AKB28';
    end if;
    if v_number = t.number then
      raise exception 'A task cannot be blocked by itself.' using errcode = 'AKB28';
    end if;
    v_out := v_out || to_jsonb(v_number);
  end loop;
  return v_out;
end;
$$;

-- A card's file as a board names one: its number and its title's slug, as `akb raw create` writes it.
create function cloud.v1_card_file(t cloud.tasks) returns text language sql immutable set search_path = '' as $$
  select 'todo/' || t.number || '-'
    || coalesce(nullif(rtrim(left(btrim(regexp_replace(lower(t.title), '[^a-z0-9]+', '-', 'g'), '-'), 60), '-'), ''), 'task')
    || '.md';
$$;

-- 0066's, writing a new card under its number and title.
create or replace function api.v1_card_place(p_account uuid, p_task text, p_assets jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_bad text;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'task', p_task), p_daily_write_budget);
  perform cloud.v1_task_open(p_task);
  select e.key into v_bad from jsonb_each(coalesce(p_assets, '{}')) e
  where not cloud.v1_card_assets(p_task, jsonb_build_object(e.key, e.value)) ? e.key limit 1;
  if v_bad is not null then
    raise exception 'The asset % names no artifact version on this task.', v_bad using errcode = 'AKB20';
  end if;
  select * into t from cloud.tasks where id = p_task;
  return cloud.v1_card_json(t) || jsonb_build_object('path', coalesce(t.card_path, cloud.v1_card_file(t)));
end;
$$;

-- 0084's: a moved card names the number its task has in the project it moved to.
create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_unfiled text;
  v_moved jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p.unfiled then perform cloud.v1_refuse('This project cannot be deleted.'); end if;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    if not (select personal from cloud.v1_workspaces where id = v_ws) then
      perform cloud.v1_refuse('This project still has tasks. Move them to another project first.');
    end if;
    v_unfiled := cloud.v1_unfiled(v_ws);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_unfiled, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
      if t.card_path is not null then
        v_moved := v_moved || jsonb_build_object('task', t.id, 'path', t.card_path, 'number', t.number);
      end if;
    end loop;
  end if;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true, 'moved', v_moved, 'unfiled', v_unfiled);
end;
$$;

-- 0078's create, keeping `metadata` as the task's card fields before its first step.
create or replace function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  j cloud.runner_jobs;
  i cloud.triage_items;
  m jsonb := p_fields -> 'metadata';
  v_project text := p_fields ->> 'project';
  v_ws text;
begin
  if p_fields ? 'triage' then
    i := cloud.v1_triage_item(p_account, p_fields ->> 'triage');
    v_project := coalesce(v_project, i.project_id);
  end if;
  v_ws := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if i.id is not null then
    select * into i from cloud.triage_items where id = i.id for update;
    if i.workspace_id <> v_ws then perform cloud.v1_missing('triage item'); end if;
    if i.state <> 'open' then perform cloud.v1_refuse('This triage item is not waiting to be sorted.'); end if;
  end if;
  if p_fields #>> '{context,workflow}' is not null then
    if p_workflow ->> 'id' <> 'wf_builtin_workflow_builder' then
      perform cloud.v1_refuse('Only the Workflow builder changes a workflow.');
    end if;
    if not exists (select 1 from cloud.workflows w where w.id = p_fields #>> '{context,workflow}' and w.workspace_id = v_ws) then
      perform cloud.v1_missing('workflow');
    end if;
  end if;
  if p_max_tasks is not null and coalesce((p_fields ->> 'run')::boolean, false)
     and cloud.v1_open_tasks((select w.account_id from cloud.v1_workspaces w where w.id = v_ws)) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
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
                           source_context, context, run, runtime)
  values (cloud.v1_id('task'), p_account, v_ws, v_project,
          jsonb_build_object('id', v.workflow_id, 'name', v.name, 'version', v.version), v.id,
          p_fields ->> 'title', coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'), coalesce(p_fields -> 'context', '{}'),
          coalesce((p_fields ->> 'run')::boolean, false), p_fields ->> 'runtime')
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
    insert into cloud.task_chats (task_id, account_id, job_id) values (t.id, p_account, j.id);
    insert into cloud.task_chat_messages (id, task_id, account_id, role, body)
    values (cloud.v1_id('msg'), t.id, p_account, 'user', coalesce(nullif(btrim(t.request), ''), t.title));
    perform cloud.v1_chat_changed(t.id, p_account);
    select * into t from cloud.tasks where id = t.id;
  end if;
  perform cloud.v1_emit(v_ws, 'task.created', cloud.v1_task_json(t));
  if i.id is not null then
    update cloud.triage_items set state = 'carded', task_id = t.id, updated_at = now() where id = i.id returning * into i;
    perform cloud.v1_emit(v_ws, 'triage.updated', cloud.v1_triage_json(i));
  end if;
  return cloud.v1_task_json(t);
end;
$$;

-- 0070's dispatch: the first step waits on an open blocker too, and hands the job its card fields.
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
            'metadata', case when p_verb = 'create' then nullif(t.card_metadata
              - array['phases', 'phase', 'schedule', 'parent', 'source'], '{}') end)))
  returning * into j;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', held_flow = null, failure = null, result = null, updated_at = now()
  where id = p_task;
  return j;
end;
$$;

-- A task with no card yet starts its first step once its last blocker ends: nothing else
-- releases it, since the Worker releases cards it can read.
create function cloud.release_held_creates() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  w cloud.tasks;
  j cloud.runner_jobs;
begin
  for w in select * from cloud.tasks x
    where x.project_id = new.project_id and x.run and x.status = 'queued' and x.card_path is null
      and x.held_flow ->> 'verb' = 'create'
    order by x.number for update
  loop
    if cardinality(cloud.v1_open_blockers(w)) > 0 then continue; end if;
    j := cloud.v1_dispatch_flow(w.id, 'create', w.held_flow ->> 'text');
    update cloud.task_chats set job_id = j.id where task_id = w.id and job_id is null;
    select * into w from cloud.tasks where id = w.id;
    perform cloud.v1_emit(w.workspace_id, 'task.updated', cloud.v1_task_json(w));
  end loop;
  return null;
end;
$$;

create trigger release_held_creates after update of status on cloud.tasks for each row
  when (new.status in ('done', 'cancelled') and old.status not in ('done', 'cancelled'))
  execute function cloud.release_held_creates();
