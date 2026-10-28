-- A card's approvals come from the previews it chose and their `after` (#2154).
--
-- - **Stages**: the board writes how many approvals a card makes as `stages` beside the previews
--   it chose; a workflow version no longer counts rounds.
-- - **Index**: a card's `previews` and `stages` reach the task's metadata as its `phase` does.

/** How many approvals a card makes: its `stages`, 1 when it has none. */
create or replace function cloud.v1_card_stages(t cloud.tasks) returns integer language sql stable set search_path = '' as $$
  select least(greatest(coalesce((t.card_metadata ->> 'stages')::integer, 1), 1), 20);
$$;

/** The approval a card is on: its `phase`, kept inside its stages. */
create or replace function cloud.v1_card_phase(t cloud.tasks) returns integer language sql stable set search_path = '' as $$
  select least(greatest(coalesce((t.card_metadata ->> 'phase')::integer, 1), 1), cloud.v1_card_stages(t));
$$;

create or replace function cloud.v1_add_workflow_version(w cloud.workflows, p_fields jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.workflow_versions (id, workflow_id, account_id, workspace_id, version, name, description, lands, files)
  values (cloud.v1_id('wfv'), w.id, w.account_id, w.workspace_id, w.version, w.name, w.description, coalesce((p_fields ->> 'lands')::boolean, false), p_fields -> 'files');
  delete from cloud.workflow_versions v
   where v.workflow_id = w.id and v.version < w.version
     and not exists (select 1 from cloud.tasks t where t.workflow_version = v.id);
end;
$$;

create or replace function cloud.v1_builtin_version(p_workflow jsonb) returns cloud.workflow_versions
language plpgsql security definer set search_path = '' as $$
declare
  v cloud.workflow_versions;
begin
  perform pg_advisory_xact_lock(hashtext('workflow_versions:' || (p_workflow ->> 'id')));
  select * into v from cloud.workflow_versions
   where account_id is null and workflow_id = p_workflow ->> 'id' and hash = p_workflow ->> 'hash';
  if found then return v; end if;
  insert into cloud.workflow_versions (id, workflow_id, version, hash, name, description, lands, files)
  values (cloud.v1_id('wfv'), p_workflow ->> 'id',
          coalesce((select max(o.version) + 1 from cloud.workflow_versions o
                     where o.account_id is null and o.workflow_id = p_workflow ->> 'id'), 1),
          p_workflow ->> 'hash', p_workflow ->> 'name', coalesce(p_workflow ->> 'description', ''),
          coalesce((p_workflow ->> 'lands')::boolean, false),
          p_workflow -> 'files')
  returning * into v;
  return v;
end;
$$;

/** An approved stage: the next one, else the workflow's end — on to the build, or done. */
create or replace function cloud.v1_after_approval(p_task text) returns void language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
  v_more boolean;
  v_status text;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.workflow_version is null then return; end if;
  select * into v from cloud.workflow_versions where id = t.workflow_version;
  v_more := cloud.v1_card_stages(t) > t.review_phase;
  if v_more then
    update cloud.tasks set card_metadata = card_metadata || jsonb_build_object('phase', t.review_phase + 1)
    where id = p_task returning * into t;
    v_status := 'queued';
  else
    v_status := case when v.lands then 'queued' else 'done' end;
  end if;
  if t.run and v_status = 'queued' then
    perform cloud.v1_dispatch_flow(p_task, case when v_more then 'approve' else 'implement' end);
    select * into t from cloud.tasks where id = p_task;
  else
    if v_status = 'done' and t.workflow ->> 'id' = 'wf_builtin_workflow_builder' then perform cloud.v1_save_built(t); end if;
    update cloud.tasks set status = v_status, updated_at = now(),
      result = case when t.run and v_status = 'done' then (
        select j.reply from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null and j.state = 'finished'
        order by j.seq desc limit 1) else result end
    where id = p_task returning * into t;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- The version a task runs on, with the approval its card is on and the previews it chose.
create or replace function api.v1_task_workflow(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.workflow_versions;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select * into t from cloud.tasks where id = p_task;
  select * into v from cloud.workflow_versions where id = t.workflow_version;
  if not found then perform cloud.v1_missing('workflow version for this task'); end if;
  return jsonb_build_object('object', 'workflow_version', 'project', t.project_id, 'workflow', v.workflow_id,
    'builtin', v.account_id is null, 'version', v.version, 'name', v.name, 'description', v.description,
    'round', cloud.v1_card_phase(t), 'rounds', cloud.v1_card_stages(t), 'previews', t.card_metadata -> 'previews',
    'lands', v.lands, 'files', v.files);
end;
$$;

-- 0091's index, also keeping a card's previews and stages.
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
          else (card_metadata - array['phases', 'phase', 'previews', 'stages', 'blocked_by', 'related', 'schedule'])
            || jsonb_strip_nulls(jsonb_build_object('phase', e #> '{front,phase}', 'previews', e #> '{front,previews}',
                 'stages', e #> '{front,stages}'))
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

alter table cloud.workflow_versions drop column rounds;
