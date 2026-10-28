-- Task dependencies and groups (#2064): a card's `blocked_by`, `related` and `schedule` and its
-- group root's `## Todo` work as on a local board. The card file is the source; its index here
-- keeps the references as task keys.
--
-- - **A task that ends is handed to the Worker**: `done` or `cancelled` files the task in
--   `task_endings`, and the Worker rewrites the project's cards by the board's own rules
--   (`cloud/src/v1/endings.ts`).
-- - **A blocked task waits**: a step dispatched while the card names an open blocker is held
--   on the task and started once the last blocker ends.

alter table cloud.tasks add column held_flow jsonb;

create table cloud.task_endings (
  task_id text primary key references cloud.tasks (id) on delete cascade,
  -- Ended by its group closing: its own group root is not chased further.
  closing boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table cloud.task_endings enable row level security;

create function cloud.task_ended() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.task_endings (task_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger task_ended after update of status on cloud.tasks for each row
  when (new.status in ('done', 'cancelled') and old.status not in ('done', 'cancelled'))
  execute function cloud.task_ended();

-- ---------------------------------------------------------------------------
-- The references a card holds
-- ---------------------------------------------------------------------------

create function cloud.v1_task_key(t cloud.tasks) returns text language sql stable set search_path = '' as $$
  select p.prefix || '-' || t.number from cloud.projects p where p.id = t.project_id;
$$;

-- A card's numbers (`[3, 5]`, as the board writes them) as this project's task keys.
create function cloud.v1_card_keys(p_project text, p_refs jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(case when jsonb_typeof(r.value) = 'number' then to_jsonb(p.prefix || '-' || (r.value #>> '{}'))
                                 else r.value end order by r.n), '[]')
  from jsonb_array_elements(case when jsonb_typeof(p_refs) = 'array' then p_refs else '[]' end) with ordinality r(value, n),
       cloud.projects p
  where p.id = p_project;
$$;

-- `blocked_by`, `related` and `schedule` as the card file says them.
create function cloud.v1_card_links(p_project text, p_links jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select case when jsonb_typeof(p_links) <> 'object' then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object(
    'blocked_by', cloud.v1_card_keys(p_project, p_links -> 'blocked_by'),
    'related', cloud.v1_card_keys(p_project, p_links -> 'related'),
    'schedule', case when jsonb_typeof(p_links -> 'schedule') = 'object' then p_links -> 'schedule' end)) end;
$$;

-- The tasks a card waits on: named in its `blocked_by`, in its project, and not ended. A key
-- naming no task is no blocker, as an id no longer on a local board is none.
create function cloud.v1_open_blockers(t cloud.tasks) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(b.id order by b.number), '{}') from cloud.tasks b
  where b.project_id = t.project_id and b.id <> t.id and b.status not in ('done', 'cancelled')
    and cloud.v1_task_key(b) in (
      select upper(x) from jsonb_array_elements_text(
        case when jsonb_typeof(t.card_metadata -> 'blocked_by') = 'array' then t.card_metadata -> 'blocked_by' else '[]' end) x);
$$;

-- 0066's index, keeping what the file does not say: a write from a job no longer drops the
-- metadata a `PUT` set, such as `parent`.
create or replace function cloud.v1_index_cards(p_project text, p_cards jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  t cloud.tasks;
  v_cp text;
  n integer := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(p_cards, '[]')) loop
    select * into t from cloud.tasks where id = e ->> 'task' and project_id = p_project for update;
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
            || cloud.v1_card_links(p_project, e -> 'links') end,
        updated_at = now()
      where id = t.id returning * into t;
      for v_cp in
        select c.id from cloud.task_checkpoints c
        where c.task_id = t.id and c.status not in ('pending', 'approved') order by c.position
      loop
        perform cloud.v1_revise(v_cp);
      end loop;
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

-- `PUT /v1/tasks/{id}/card`'s `blocked_by`: keys or ids of tasks in the card's project, as the
-- numbers the card file holds.
create function api.v1_card_numbers(p_account uuid, p_task text, p_refs jsonb) returns jsonb
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
    where b.project_id = t.project_id and (b.id = v_ref or cloud.v1_task_key(b) = upper(v_ref));
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

-- ---------------------------------------------------------------------------
-- A blocked task waits
-- ---------------------------------------------------------------------------

-- 0065's dispatch: a task with an open blocker holds the step instead, and gets no job.
create or replace function cloud.v1_dispatch_flow(p_task text, p_verb text, p_text text default null) returns cloud.runner_jobs
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  f cloud.project_folders;
  r cloud.runtimes;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if p_verb <> 'create' and cardinality(cloud.v1_open_blockers(t)) > 0 then
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
            'text', nullif(btrim(coalesce(p_text, '')), ''), 'title', case when p_verb = 'create' then t.title end)))
  returning * into j;
  perform cloud.hint_runner(t.account_id, j.id);
  update cloud.tasks set status = 'queued', held_flow = null, failure = null, result = null, updated_at = now()
  where id = p_task;
  return j;
end;
$$;

-- An unblocked task starts: the step it held, else the card's `schedule` action, with the
-- schedule's notes after the held text. Nothing while a blocker is open or a step is running.
create function api.v1_release_task(p_task text, p_action text, p_notes text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  j cloud.runner_jobs;
  v_verb text;
begin
  perform cloud.v1_lock(cloud.v1_task_workspace(p_task));
  select * into t from cloud.tasks where id = p_task for update;
  if t.id is null or not t.run or t.status in ('done', 'cancelled') or (cloud.v1_flow_job(t.id)).id is not null
     or cardinality(cloud.v1_open_blockers(t)) > 0 then
    return jsonb_build_object('started', false);
  end if;
  v_verb := coalesce(t.held_flow ->> 'verb', case when p_action in ('implement', 'refine', 'revise') then p_action end);
  if v_verb is null then return jsonb_build_object('started', false); end if;
  j := cloud.v1_dispatch_flow(t.id, v_verb,
    nullif(concat_ws(E'\n\n', t.held_flow ->> 'text', nullif(btrim(coalesce(p_notes, '')), '')), ''));
  select * into t from cloud.tasks where id = p_task;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  return jsonb_build_object('started', j.id is not null, 'verb', v_verb);
end;
$$;

-- ---------------------------------------------------------------------------
-- A task that ends
-- ---------------------------------------------------------------------------

-- Up to `p_limit` endings to handle; one claimed and not finished within ten minutes is handed out again.
create function api.v1_take_endings(p_limit integer) returns jsonb
language sql security definer set search_path = '' as $$
  with taken as (
    update cloud.task_endings e set claimed_at = now()
    where e.task_id in (
      select x.task_id from cloud.task_endings x
      where x.claimed_at is null or x.claimed_at < now() - interval '10 minutes'
      order by x.created_at limit p_limit for update skip locked)
    returning e.task_id, e.closing, e.created_at)
  select coalesce(jsonb_agg(jsonb_build_object('task', task_id, 'closing', closing) order by created_at), '[]') from taken;
$$;

create function api.v1_ending_done(p_task text) returns void
language sql security definer set search_path = '' as $$
  delete from cloud.task_endings where task_id = p_task;
$$;

-- What the Worker needs to rewrite the cards an ended task leaves behind: the task, its group
-- root, and every task of the project with a card.
create function api.v1_ending(p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_parent text;
begin
  select * into t from cloud.tasks where id = p_task;
  if t.id is null then return null; end if;
  select b.id into v_parent from cloud.tasks b
  where b.project_id = t.project_id and b.id <> t.id
    and (b.id = t.card_metadata ->> 'parent' or cloud.v1_task_key(b) = upper(t.card_metadata ->> 'parent'));
  return jsonb_build_object(
    'task', p_task, 'key', cloud.v1_task_key(t), 'number', t.number, 'title', t.title, 'status', t.status, 'project', t.project_id,
    'account', t.account_id, 'path', t.card_path, 'parent', v_parent,
    'cards', (select coalesce(jsonb_agg(jsonb_build_object('task', b.id, 'number', b.number, 'status', b.status,
                'path', b.card_path, 'busy', (cloud.v1_flow_job(b.id)).id is not null) order by b.number), '[]')
              from cloud.tasks b where b.project_id = t.project_id and b.card_path is not null));
end;
$$;

-- A group root whose last subtask ended, closed as done; its own ending follows.
create function api.v1_close_group(p_task text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_lock(cloud.v1_task_workspace(p_task));
  select * into t from cloud.tasks where id = p_task for update;
  if t.id is null or t.status in ('done', 'cancelled') then return jsonb_build_object('closed', false); end if;
  update cloud.runner_jobs set state = 'finished', outcome = 'failed', reason = 'Cancelled.', finished_at = now(),
    updated_at = now()
  where task_id = p_task and state = 'waiting';
  update cloud.tasks set status = 'done', held_flow = null, updated_at = now() where id = p_task returning * into t;
  update cloud.task_endings set closing = true where task_id = p_task;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
  return jsonb_build_object('closed', true);
end;
$$;

revoke all on function api.v1_card_numbers(uuid, text, jsonb) from public;
grant execute on function api.v1_card_numbers(uuid, text, jsonb) to service_role;
revoke all on function api.v1_release_task(text, text, text) from public;
grant execute on function api.v1_release_task(text, text, text) to service_role;
revoke all on function api.v1_take_endings(integer) from public;
grant execute on function api.v1_take_endings(integer) to service_role;
revoke all on function api.v1_ending_done(text) from public;
grant execute on function api.v1_ending_done(text) to service_role;
revoke all on function api.v1_ending(text) from public;
grant execute on function api.v1_ending(text) to service_role;
revoke all on function api.v1_close_group(text) from public;
grant execute on function api.v1_close_group(text) to service_role;
