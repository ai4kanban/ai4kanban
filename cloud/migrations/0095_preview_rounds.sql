-- A workflow previews in rounds, then lands or ends (#2152).
--
-- - **Rounds**: a workflow version says how many preview rounds its cards go through; a card's
--   `phase` is the round it is on. Cards no longer name their phases.
-- - **Lands**: whether approving the last round builds the card or ends the task — `delivers` gone.

alter table cloud.workflow_versions
  add column rounds integer not null default 1 check (rounds between 1 and 20),
  add column lands boolean not null default true;
update cloud.workflow_versions set lands = delivers <> 'plan';
alter table cloud.workflow_versions drop column delivers;

create or replace function cloud.v1_add_workflow_version(w cloud.workflows, p_fields jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.workflow_versions (id, workflow_id, account_id, workspace_id, version, name, description, rounds, lands, files)
  values (cloud.v1_id('wfv'), w.id, w.account_id, w.workspace_id, w.version, w.name, w.description,
          coalesce((p_fields ->> 'rounds')::integer, 1), coalesce((p_fields ->> 'lands')::boolean, false), p_fields -> 'files');
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
  insert into cloud.workflow_versions (id, workflow_id, version, hash, name, description, rounds, lands, files)
  values (cloud.v1_id('wfv'), p_workflow ->> 'id',
          coalesce((select max(o.version) + 1 from cloud.workflow_versions o
                     where o.account_id is null and o.workflow_id = p_workflow ->> 'id'), 1),
          p_workflow ->> 'hash', p_workflow ->> 'name', coalesce(p_workflow ->> 'description', ''),
          coalesce((p_workflow ->> 'rounds')::integer, 1), coalesce((p_workflow ->> 'lands')::boolean, false),
          p_workflow -> 'files')
  returning * into v;
  return v;
end;
$$;

/** The round a card is on: its `phase`, kept inside its workflow's rounds. */
create or replace function cloud.v1_card_phase(t cloud.tasks) returns integer language sql stable set search_path = '' as $$
  select least(greatest(coalesce((t.card_metadata ->> 'phase')::integer, 1), 1),
               coalesce((select v.rounds from cloud.workflow_versions v where v.id = t.workflow_version), 1));
$$;

create or replace function cloud.v1_review_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('status', t.review_status, 'phase', t.review_phase, 'revision', t.review_revision,
    'question', coalesce(t.review ->> 'question', ''), 'options', t.review -> 'options',
    'card_question', t.review -> 'card_question', 'updated_at', cloud.v1_ts(t.review_at));
$$;

create or replace function cloud.v1_alert_json(a cloud.alerts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'alert', 'kind', a.kind, 'task', a.task_id,
    'task_title', t.title, 'project', t.project_id, 'phase', a.phase,
    'comment', case when m.id is null then null else jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body) end,
    'channel', a.channel, 'read', a.read_at is not null, 'created_at', cloud.v1_ts(a.created_at))
  from cloud.tasks t
  left join cloud.comments m on m.id = a.comment_id
  where t.id = a.task_id;
$$;

create or replace function api.runner_inbox(p_subject uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'review', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, t.review_phase phase, t.review_at at,
               (select a.id from cloud.alerts a where a.task_id = t.id and a.kind = 'review' and a.read_at is null
                 order by a.id desc limit 1) alert
          from cloud.tasks t
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and t.review_status = 'ready' and cloud.v1_in(p_subject, t.workspace_id)
           and t.status not in ('done', 'failed', 'cancelled')
         order by t.review_at desc limit 200) x), '[]'::json),
    'running', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, cloud.v1_card_phase(t) phase,
               t.created_at at, null::text alert
          from cloud.tasks t
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and t.status = 'running' and cloud.v1_in(p_subject, t.workspace_id)
         order by t.created_at desc limit 200) x), '[]'::json)
  );
$$;

/** An approved round: the next one, else the workflow's end — on to the build, or done. */
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
  v_more := v.rounds > t.review_phase;
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

-- The version a task runs on, with the round its card is on.
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
    'round', cloud.v1_card_phase(t), 'rounds', v.rounds, 'lands', v.lands, 'files', v.files);
end;
$$;

drop function cloud.v1_phase_title(cloud.tasks, integer);
drop function cloud.v1_card_phases(jsonb);
