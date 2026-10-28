-- Sort triage in Cloud (#2124): the Worker judges each new item once and lands one of three
-- ends — a task made of it, a dismissal with its reason, or left open for the user.
--
-- - **`judged_at`**: set whatever the end, a failure included, so an item is judged once.
--   Items already waiting are the user's: the migration marks them judged.
-- - **A Cloud dismissal is not learned from**: `dismissed_by` and `reviewed` stay null.

alter table cloud.triage_items add column judged_at timestamptz;
update cloud.triage_items set judged_at = now();
create index triage_items_unjudged on cloud.triage_items (created_at) where judged_at is null and state = 'open';

-- 0076's create; a new item says so in `created`, which the Worker strips.
create or replace function api.v1_create_triage(p_account uuid, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_target(p_account, p_fields ->> 'workspace', v_project);
  v_source text := p_fields ->> 'source_task';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if v_source is not null then perform cloud.v1_workspace_of(p_account, 'task', v_source); end if;
  v_project := coalesce(v_project, cloud.v1_inbox(v_ws));
  insert into cloud.triage_items (id, workspace_id, project_id, created_by, title, body, source_task)
  values (cloud.v1_id('tri'), v_ws, v_project, p_account, p_fields ->> 'title', coalesce(p_fields ->> 'text', ''), v_source)
  on conflict (project_id, (coalesce(source_task, '')), title) do nothing
  returning * into i;
  if i.id is null then
    select * into i from cloud.triage_items x
     where x.project_id = v_project and coalesce(x.source_task, '') = coalesce(v_source, '') and x.title = p_fields ->> 'title';
    return cloud.v1_triage_json(i);
  end if;
  perform cloud.v1_emit(v_ws, 'triage.created', cloud.v1_triage_json(i));
  return cloud.v1_triage_json(i) || '{"created": true}';
end;
$$;

-- What the hourly run judges: items `waitUntil` did not get to, oldest first.
create function api.v1_triage_unjudged(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.id order by x.created_at, x.id), '[]') from (
    select i.id, i.created_at from cloud.triage_items i
     where i.judged_at is null and i.state = 'open' and i.created_at < now() - interval '10 minutes'
     order by i.created_at, i.id limit p_limit
  ) x;
$$;

-- One item waiting to be judged, with whom it is judged for and the workflows it may become;
-- null once it is judged or sorted. `seen` is handed back to `v1_sort_triage`.
create function api.v1_triage_to_sort(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'workspace', i.workspace_id, 'project', i.project_id, 'owner', w.account_id,
    'title', i.title, 'text', i.body, 'source_task', i.source_task, 'seen', i.updated_at,
    'installed', coalesce((select jsonb_agg(x.workflow_id order by x.workflow_id) from cloud.workflow_installs x
                            where x.workspace_id = i.workspace_id), '[]'),
    'workflows', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'description', f.description) order by f.id)
                            from cloud.workflows f where f.workspace_id = i.workspace_id), '[]'))
  from cloud.triage_items i join cloud.v1_workspaces w on w.id = i.workspace_id
  where i.id = p_id and i.state = 'open' and i.judged_at is null;
$$;

-- Land a judgement: `p_outcome` is `card`, `dismiss` or `open`. Dropped (null) when the item
-- was judged already, or changed since `p_seen`. A task that cannot be made leaves it open.
create function api.v1_sort_triage(p_id text, p_seen timestamptz, p_outcome text, p_reason text, p_task jsonb,
                                   p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i cloud.triage_items;
  v_owner uuid;
  v_task jsonb;
begin
  if p_outcome not in ('card', 'dismiss', 'open') then perform cloud.v1_refuse('That is not a triage outcome.'); end if;
  select w.account_id into v_owner from cloud.triage_items x join cloud.v1_workspaces w on w.id = x.workspace_id where x.id = p_id;
  if v_owner is null then return null; end if;
  -- The workspace before the row, as every user write takes them.
  perform cloud.v1_write(v_owner, (select x.workspace_id from cloud.triage_items x where x.id = p_id), p_daily_write_budget);
  select * into i from cloud.triage_items where id = p_id for update;
  if i.state <> 'open' or i.judged_at is not null or i.updated_at <> p_seen then return null; end if;
  update cloud.triage_items set judged_at = now() where id = p_id;
  if p_outcome = 'dismiss' then
    update cloud.triage_items set state = 'dismissed', dismissed_reason = nullif(btrim(p_reason), ''), dismissed_at = now(),
      updated_at = now()
    where id = p_id returning * into i;
    perform cloud.v1_emit(i.workspace_id, 'triage.updated', cloud.v1_triage_json(i));
  elsif p_outcome = 'card' then
    begin
      v_task := api.v1_create_task(v_owner, p_task || jsonb_build_object('triage', p_id), p_workflow, p_daily_write_budget, p_max_tasks);
    exception when others then
      raise warning 'triage %: no task made: %', p_id, sqlerrm;
    end;
  end if;
  return jsonb_build_object('outcome', case when p_outcome = 'card' and v_task is null then 'open' else p_outcome end,
                            'task', v_task, 'workspace', i.workspace_id, 'owner', v_owner);
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  foreach f in array array[
    'api.v1_create_triage(uuid, jsonb, integer)'::regprocedure,
    'api.v1_triage_unjudged(integer)'::regprocedure,
    'api.v1_triage_to_sort(text)'::regprocedure,
    'api.v1_sort_triage(text, timestamptz, text, text, jsonb, jsonb, integer, integer)'::regprocedure
  ]
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$grants$;
