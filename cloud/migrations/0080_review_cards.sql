-- Review cards, drop checkpoints (#2103): the task carries its own review.
--
-- - **The review**: `tasks.review_status` (null until a draft is submitted), `review_phase`,
--   `review` (question, options, card_question), `review_revision` and `review_at`. A phase is
--   the card's `phases`/`phase`; it has no row of its own. The revision only grows.
-- - **What hangs off it**: comments, decisions, artifacts and alerts record the `phase` they
--   were made in; a share link is the task's. Revision snapshots are per task and phase.
-- - **Events**: `review.ready`, `review.updated`, `review.approved`, `review.changes_requested`.
-- - **Migrated**: a task's review is its `ready` checkpoint, else its last one past `pending`;
--   every row keeps its checkpoint's position as its phase, and share-link tokens stay valid.

-- ---------------------------------------------------------------------------
-- What goes away
-- ---------------------------------------------------------------------------

drop function api.v1_list_checkpoints(uuid, text);
drop function api.v1_checkpoint(uuid, text);
drop function api.v1_update_checkpoint(uuid, text, jsonb, integer);
drop function api.v1_create_comment(uuid, text, text, jsonb, integer);
drop function api.v1_list_comments(uuid, text, text, integer);
drop function api.v1_create_decision(uuid, text, jsonb, jsonb, integer);
drop function api.v1_list_decisions(uuid, text, text, integer);
drop function api.v1_create_share_link(uuid, text, jsonb, text, integer);
drop function api.v1_list_share_links(uuid, text);
drop function cloud.v1_after_approval(cloud.task_checkpoints);
drop function cloud.v1_reviewed_artifacts(cloud.task_checkpoints);
drop function cloud.v1_checkpoint_json(cloud.task_checkpoints);
drop function cloud.v1_comment_json(cloud.checkpoint_comments);
drop function cloud.v1_revise(text);
drop function cloud.raise_alert(cloud.tasks, text, text, text);
drop function cloud.read_alerts_where(uuid, text, text, text);
drop trigger checkpoint_alerts on cloud.task_checkpoints;
drop trigger checkpoint_alerts_born on cloud.task_checkpoints;
drop function cloud.checkpoint_alerts();

-- ---------------------------------------------------------------------------
-- The task's review
-- ---------------------------------------------------------------------------

alter table cloud.tasks
  add column review_status text check (review_status in ('ready', 'approved', 'changes_requested')),
  add column review_phase integer,
  add column review jsonb,
  add column review_revision integer not null default 0,
  add column review_at timestamptz,
  add constraint tasks_review_phase_check check ((review_status is null) = (review_phase is null));

update cloud.tasks t set
  review_status = c.status,
  review_phase = c.position,
  review = case when c.review ? 'question' or nullif(c.definition ->> 'question', '') is null then c.review
    else coalesce(c.review, '{}') || jsonb_build_object('question', c.definition ->> 'question') end,
  review_at = c.updated_at
from (
  select distinct on (x.task_id) x.* from cloud.task_checkpoints x
  where x.status <> 'pending'
  order by x.task_id, x.status = 'ready' desc, x.position desc
) c
where c.task_id = t.id;

-- The highest a task's checkpoints reached, so a new revision never repeats an old one.
update cloud.tasks t set review_revision = r.n
from (select task_id, max(review_revision) n from cloud.task_checkpoints group by task_id) r
where r.task_id = t.id and r.n > 0;

create table cloud.review_revisions (
  task_id text not null references cloud.tasks(id) on delete cascade,
  phase integer not null,
  revision integer not null,
  account_id uuid not null references cloud.accounts(id) on delete cascade,
  artifacts jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (task_id, phase, revision)
);
alter table cloud.review_revisions enable row level security;

insert into cloud.review_revisions (task_id, phase, revision, account_id, artifacts, created_at)
select c.task_id, c.position, r.revision, r.account_id, r.artifacts, r.created_at
from cloud.checkpoint_revisions r join cloud.task_checkpoints c on c.id = r.checkpoint_id;

-- ---------------------------------------------------------------------------
-- Comments, decisions, artifacts, alerts and share links
-- ---------------------------------------------------------------------------

alter table cloud.checkpoint_comments rename to comments;
alter table cloud.comments rename constraint checkpoint_comments_pkey to comments_pkey;
alter table cloud.comments rename constraint checkpoint_comments_body_check to comments_body_check;
alter table cloud.comments rename constraint checkpoint_comments_account_id_fkey to comments_account_id_fkey;
alter table cloud.comments rename constraint checkpoint_comments_task_id_fkey to comments_task_id_fkey;
alter table cloud.comments add column phase integer;
update cloud.comments m set phase = c.position from cloud.task_checkpoints c where c.id = m.checkpoint_id;
alter table cloud.comments alter column phase set not null, drop column checkpoint_id;
create index comments_task on cloud.comments (task_id, id);

alter table cloud.decisions add column task_id text references cloud.tasks(id) on delete cascade, add column phase integer;
alter table cloud.decisions disable trigger decisions_immutable;
update cloud.decisions d set task_id = c.task_id, phase = c.position from cloud.task_checkpoints c where c.id = d.checkpoint_id;
alter table cloud.decisions enable trigger decisions_immutable;
alter table cloud.decisions alter column task_id set not null, alter column phase set not null, drop column checkpoint_id;
create index decisions_task on cloud.decisions (task_id, id);

alter table cloud.artifacts add column phase integer;
update cloud.artifacts a set phase = c.position from cloud.task_checkpoints c where c.id = a.checkpoint_id;
alter table cloud.artifacts drop column checkpoint_id;

alter table cloud.alerts add column phase integer;
update cloud.alerts a set phase = c.position from cloud.task_checkpoints c where c.id = a.checkpoint_id;
alter table cloud.alerts drop column checkpoint_id;

alter table cloud.share_links add column task_id text references cloud.tasks(id) on delete cascade;
update cloud.share_links l set task_id = c.task_id from cloud.task_checkpoints c where c.id = l.checkpoint_id;
alter table cloud.share_links alter column task_id set not null, drop column checkpoint_id;
create index share_links_task on cloud.share_links (task_id, id);

drop table cloud.checkpoint_revisions;
drop table cloud.task_checkpoints;

-- ---------------------------------------------------------------------------
-- Shapes
-- ---------------------------------------------------------------------------

/** The phase a card is on: its `phase`, kept inside its `phases`; 1 without phases. */
create function cloud.v1_card_phase(t cloud.tasks) returns integer language sql immutable set search_path = '' as $$
  select case when p is null then 1
    else least(greatest(coalesce((t.card_metadata ->> 'phase')::integer, 1), 1), jsonb_array_length(p)) end
  from cloud.v1_card_phases(t.card_metadata) p;
$$;

/** A phase's name, from the card's `phases`; null on a card without them. */
create function cloud.v1_phase_title(t cloud.tasks, p_phase integer) returns text language sql immutable set search_path = '' as $$
  select cloud.v1_card_phases(t.card_metadata) ->> (p_phase - 1);
$$;

create function cloud.v1_review_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('status', t.review_status, 'phase', t.review_phase,
    'phase_title', cloud.v1_phase_title(t, t.review_phase), 'revision', t.review_revision,
    'question', coalesce(t.review ->> 'question', ''), 'options', t.review -> 'options',
    'card_question', t.review -> 'card_question', 'updated_at', cloud.v1_ts(t.review_at));
$$;

/** What a `review.*` event carries. */
create function cloud.v1_review_event(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'review', 'task', t.id) || cloud.v1_review_json(t);
$$;

-- 0078's, with `review`.
create or replace function cloud.v1_task_fields_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'workspace', t.workspace_id, 'project', t.project_id,
    'workflow', t.workflow, 'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'context', t.context,
    'status', t.status, 'card_version', nullif(t.card_version, 0), 'runtime', t.runtime,
    'run', cloud.v1_run_json(t), 'result', t.result, 'failure', t.failure,
    'review', cloud.v1_review_json(t),
    'last_job', (select j.id from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null order by j.seq desc limit 1),
    'discussion', t.discussion_id,
    'cancel_reason', t.cancel_reason,
    'cancelled_by', (select a.handle from cloud.accounts a where a.id = t.cancelled_by),
    'created_by', (select a.handle from cloud.accounts a where a.id = t.account_id),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create function cloud.v1_comment_json(m cloud.comments) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'object', 'comment', 'task', m.task_id, 'phase', m.phase,
    'body', m.body, 'author', m.author, 'created_at', cloud.v1_ts(m.created_at));
$$;

create or replace function cloud.v1_decision_json(d cloud.decisions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'object', 'decision', 'task', d.task_id, 'phase', d.phase,
    'artifact', d.artifact_id, 'artifact_version', d.artifact_version, 'decision', d.decision,
    'comment', d.comment, 'decided_by', d.decided_by, 'review_revision', d.review_revision,
    'created_at', cloud.v1_ts(d.created_at));
$$;

create or replace function cloud.v1_artifact_json(a cloud.artifacts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'artifact', 'task', a.task_id, 'phase', a.phase,
    'type', a.type, 'name', a.name, 'latest_version', nullif(a.latest_version, 0),
    'created_at', cloud.v1_ts(a.created_at), 'updated_at', cloud.v1_ts(a.updated_at));
$$;

create or replace function cloud.v1_share_link_json(l cloud.share_links) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'object', 'share_link', 'task', l.task_id, 'access', l.access,
    'expires_at', cloud.v1_ts(l.expires_at), 'revoked', l.revoked_at is not null,
    'active', l.revoked_at is null and l.expires_at > now(), 'created_at', cloud.v1_ts(l.created_at));
$$;

create or replace function cloud.v1_alert_json(a cloud.alerts) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'object', 'alert', 'kind', a.kind, 'task', a.task_id,
    'task_title', t.title, 'project', t.project_id, 'phase', a.phase,
    'phase_title', cloud.v1_phase_title(t, a.phase),
    'comment', case when m.id is null then null else jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body) end,
    'channel', a.channel, 'read', a.read_at is not null, 'created_at', cloud.v1_ts(a.created_at))
  from cloud.tasks t
  left join cloud.comments m on m.id = a.comment_id
  where t.id = a.task_id;
$$;

-- ---------------------------------------------------------------------------
-- What is under review
-- ---------------------------------------------------------------------------

/** The artifacts an API task submitted for the phase under review. A Runner task's review is
 *  its card alone. */
create function cloud.v1_phase_artifacts(t cloud.tasks) returns setof text language sql stable security definer
set search_path = '' as $$
  select a.id from cloud.artifacts a where a.task_id = t.id and a.phase = t.review_phase and not t.run;
$$;

create function cloud.v1_reviewed_artifacts(t cloud.tasks) returns setof text language sql stable security definer
set search_path = '' as $$
  select cloud.v1_phase_artifacts(t)
  union
  select a.id from jsonb_each(t.card_assets) e, cloud.artifacts a
   where a.id = e.value ->> 'artifact' and a.task_id = t.id;
$$;

/** The reviewed content changed: a new revision, and a snapshot of what it holds. */
create function cloud.v1_revise(p_task text) returns cloud.tasks language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  update cloud.tasks set review_revision = review_revision + 1, review_at = now()
  where id = p_task returning * into t;
  insert into cloud.review_revisions (task_id, phase, revision, account_id, artifacts)
  values (t.id, t.review_phase, t.review_revision, t.account_id, coalesce((
    select jsonb_agg(jsonb_build_object('artifact', a.id, 'version', a.latest_version) order by a.id)
    from cloud.artifacts a where a.id in (select cloud.v1_phase_artifacts(t)) and a.latest_version > 0), '[]'));
  perform cloud.v1_emit(t.workspace_id, 'review.updated', cloud.v1_review_event(t));
  return t;
end;
$$;

/** A card push or a rebuilt workflow is a new revision of a review still open. */
create or replace function cloud.v1_index_cards(p_project text, p_cards jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  t cloud.tasks;
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

create or replace function api.runner_built_workflow(p_subject uuid, p_machine uuid, p_job uuid, p_built jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_job cloud.runner_jobs := cloud.held_runner_job(p_subject, p_machine, p_job);
  t cloud.tasks;
begin
  if v_job.id is null or v_job.task_id is null then return false; end if;
  perform cloud.v1_lock(cloud.v1_task_workspace(v_job.task_id));
  select * into t from cloud.tasks where id = v_job.task_id for update;
  if t.workflow ->> 'id' is distinct from 'wf_builtin_workflow_builder' or t.status in ('done', 'failed', 'cancelled') then
    return false;
  end if;
  if t.built is not distinct from p_built then return true; end if;
  update cloud.tasks set built = p_built, updated_at = now() where id = t.id returning * into t;
  if t.review_status in ('ready', 'changes_requested') then perform cloud.v1_revise(t.id); end if;
  return true;
end;
$$;

create or replace function cloud.artifact_revises() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where id = new.task_id;
  if new.latest_version > old.latest_version and t.review_status in ('ready', 'changes_requested')
     and new.id in (select cloud.v1_phase_artifacts(t)) then
    perform cloud.v1_revise(t.id);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submitting and deciding
-- ---------------------------------------------------------------------------

/** A finished draft goes up for review on the card's phase. */
create or replace function cloud.v1_submit_draft(p_task text, p_review jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.status in ('done', 'failed', 'cancelled') then return; end if;
  update cloud.tasks set review_status = 'ready', review_phase = cloud.v1_card_phase(t),
    review = coalesce(p_review, case when review_phase = cloud.v1_card_phase(t) then review end), review_at = now()
  where id = p_task;
  t := cloud.v1_revise(p_task);
  perform cloud.v1_emit(t.workspace_id, 'review.ready', cloud.v1_review_event(t));
  update cloud.tasks set status = 'waiting_review', updated_at = now() where id = p_task returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

/** An approved phase: the next one, else the workflow's end — done, or on to the build. */
create function cloud.v1_after_approval(p_task text) returns void language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_phases jsonb;
  v_more boolean;
  v_status text;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.workflow_version is null then return; end if;
  v_phases := cloud.v1_card_phases(t.card_metadata);
  v_more := v_phases is not null and jsonb_array_length(v_phases) > t.review_phase;
  if v_more then
    update cloud.tasks set card_metadata = card_metadata || jsonb_build_object('phase', t.review_phase + 1)
    where id = p_task returning * into t;
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
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

create function api.v1_create_decision(p_account uuid, p_task text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d cloud.decisions;
  t cloud.tasks;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_card boolean;
  v_status text;
  v_text text;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task for update;
  perform cloud.v1_task_open(t.id);
  if t.run and (cloud.v1_flow_job(t.id)).id is not null then
    perform cloud.v1_refuse('The agent is still working on this task.');
  end if;
  if t.review_status is null then
    perform cloud.v1_refuse('Nothing has been submitted for review yet.');
  end if;
  v_card := t.card_path is not null;
  if v_revision is null and v_card then
    perform cloud.v1_refuse('This task has a card: name the review_revision you reviewed.');
  end if;
  if v_revision is not null and v_revision <> t.review_revision then
    raise exception 'This task has changed since it was opened. Reload it and review again.'
      using errcode = 'AKB26', detail = 'review_outdated';
  end if;

  if v_artifact is null then
    select v.artifact_id, v.version into v_artifact, v_version
    from cloud.artifact_versions v
    where v.artifact_id in (select cloud.v1_phase_artifacts(t)) order by v.created_at desc, v.version desc limit 1;
  elsif v_version is null then
    select a.latest_version into v_version from cloud.artifacts a
    where a.id = v_artifact and a.id in (select cloud.v1_phase_artifacts(t));
  end if;
  -- A card review with nothing attached decides on the card alone.
  if not (v_artifact is null and p_fields ->> 'artifact' is null and v_card) and not exists (
    select 1 from cloud.artifact_versions v
    where v.artifact_id = v_artifact and v.version = v_version and v.artifact_id in (select cloud.v1_phase_artifacts(t))
  ) then
    perform cloud.v1_missing('artifact version under review');
  end if;

  insert into cloud.decisions (id, account_id, task_id, phase, artifact_id, artifact_version, decision, comment,
                               decided_by, review_revision)
  values (cloud.v1_id('dec'), t.account_id, t.id, t.review_phase, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, t.review_revision)
  returning * into d;
  perform cloud.v1_emit(v_ws, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if t.review_status <> v_status then
    update cloud.tasks set review_status = v_status, review_at = now() where id = t.id returning * into t;
    perform cloud.v1_emit(v_ws, 'review.' || v_status, cloud.v1_review_event(t));
    if v_status = 'approved' then
      perform cloud.v1_after_approval(t.id);
    elsif t.run then
      v_text := d.comment;
      if t.review ? 'card_question' and strpos(v_text, t.review ->> 'question') = 0 then
        v_text := concat_ws(E'\n\n', t.review ->> 'question', nullif(v_text, ''));
      end if;
      -- A build held on a question carries on with the answer.
      perform cloud.v1_dispatch_flow(t.id, case
        when not t.review ? 'card_question' then 'revise'
        when (select j.flow ->> 'verb' from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null
               order by j.seq desc limit 1) = 'implement' then 'implement'
        else 'resolve' end, v_text);
      select * into t from cloud.tasks where id = t.id;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    end if;
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

create function api.v1_list_decisions(p_account uuid, p_task text, p_after text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select d.id, cloud.v1_decision_json(d) j, row_number() over (order by d.id) n
      from cloud.decisions d
      where d.task_id = p_task and (p_after is null or d.id > p_after)
      order by d.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

/** The question the open review asks. Changing it is a new revision; a review sent back is up
 *  again once something is attached. */
create function api.v1_update_review(p_account uuid, p_task text, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_review jsonb;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task for update;
  perform cloud.v1_task_open(t.id);
  if t.review_status is null then perform cloud.v1_refuse('Nothing has been submitted for review yet.'); end if;
  if t.review_status = 'approved' then perform cloud.v1_refuse('This review is already approved.'); end if;
  v_review := case when p_fields ? 'question' or p_fields ? 'options'
    then jsonb_strip_nulls(jsonb_build_object('question', p_fields -> 'question', 'options', p_fields -> 'options'))
    else t.review end;

  if v_review is distinct from t.review then
    update cloud.tasks set review = v_review where id = t.id;
    t := cloud.v1_revise(t.id);
  end if;
  if t.review_status <> 'ready' and exists (
    select 1 from cloud.artifacts a where a.id in (select cloud.v1_phase_artifacts(t)) and a.latest_version > 0
  ) then
    update cloud.tasks set review_status = 'ready', review_at = now() where id = t.id returning * into t;
    perform cloud.v1_emit(v_ws, 'review.ready', cloud.v1_review_event(t));
  end if;
  return cloud.v1_review_event(t);
end;
$$;

-- 0047's, without the checkpoint rule: done needs the open review approved.
create or replace function api.v1_update_task(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_status text := p_fields ->> 'status';
  v_project text := p_fields ->> 'project';
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_id);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_id for update;
  perform cloud.v1_task_open(p_id);
  if v_project is not null and not exists (select 1 from cloud.projects where id = v_project and workspace_id = v_ws) then
    perform cloud.v1_missing('project');
  end if;
  if v_status = 'done' and t.review_status is distinct from 'approved' and t.review_status is not null then
    perform cloud.v1_refuse('The review must be approved before the task is done.');
  end if;
  update cloud.tasks set
    title = coalesce(p_fields ->> 'title', title),
    status = coalesce(v_status, status),
    project_id = coalesce(v_project, project_id),
    updated_at = now()
  where id = p_id returning * into t;
  perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

-- ---------------------------------------------------------------------------
-- Artifacts
-- ---------------------------------------------------------------------------

create or replace function api.v1_create_artifact(p_account uuid, p_task text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_task_open(p_task);
  insert into cloud.artifacts (id, account_id, task_id, phase, type, name)
  select cloud.v1_id('art'), t.account_id, p_task, cloud.v1_card_phase(t), p_fields ->> 'type', coalesce(p_fields ->> 'name', '')
  from cloud.tasks t where t.id = p_task
  returning * into a;
  perform cloud.v1_emit(v_ws, 'artifact.created', cloud.v1_artifact_json(a));
  return cloud.v1_artifact_json(a);
end;
$$;

/** A new version of an artifact under review puts a review sent back up again. */
create or replace function api.v1_create_artifact_version(
  p_account uuid, p_artifact text, p_content jsonb, p_upload text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  t cloud.tasks;
  u cloud.artifact_uploads;
  v cloud.artifact_versions;
  v_file jsonb;
  v_reviewed boolean;
  v_ws text := cloud.v1_workspace_of(p_account, 'artifact', p_artifact);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact for update;
  perform cloud.v1_task_open(a.task_id);
  select * into t from cloud.tasks where id = a.task_id for update;
  v_reviewed := t.review_status = 'changes_requested' and a.id in (select cloud.v1_phase_artifacts(t));

  if p_upload is not null then
    update cloud.artifact_uploads set used_at = now()
    where id = p_upload and artifact_id = p_artifact and uploaded_at is not null and used_at is null
    returning * into u;
    if not found then perform cloud.v1_refuse('That upload is unfinished, or already used.'); end if;
    v_file := jsonb_build_object('key', u.object_key, 'size', u.size, 'content_type', u.content_type);
  end if;

  insert into cloud.artifact_versions (artifact_id, version, account_id, content, file)
  values (a.id, a.latest_version + 1, a.account_id, case when v_file is null then p_content end, v_file)
  returning * into v;
  update cloud.artifacts set latest_version = v.version, updated_at = now() where id = a.id;
  perform cloud.v1_emit(v_ws, 'artifact.version_created', cloud.v1_version_json(v));

  if v_reviewed then
    update cloud.tasks set review_status = 'ready', review_at = now() where id = t.id returning * into t;
    perform cloud.v1_emit(v_ws, 'review.ready', cloud.v1_review_event(t));
  end if;
  return cloud.v1_version_json(v);
end;
$$;

-- ---------------------------------------------------------------------------
-- Comments and share links
-- ---------------------------------------------------------------------------

create function api.v1_create_comment(p_account uuid, p_task text, p_body text, p_author jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m cloud.comments;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  insert into cloud.comments (id, account_id, task_id, phase, body, author)
  select cloud.v1_id('cmt'), t.account_id, t.id, cloud.v1_card_phase(t), p_body, p_author
  from cloud.tasks t where t.id = p_task
  returning * into m;
  perform cloud.v1_emit(v_ws, 'comment.created', cloud.v1_comment_json(m));
  return cloud.v1_comment_json(m);
end;
$$;

create function api.v1_list_comments(p_account uuid, p_task text, p_after text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select m.id, cloud.v1_comment_json(m) j, row_number() over (order by m.id) n
      from cloud.comments m
      where m.task_id = p_task and (p_after is null or m.id > p_after)
      order by m.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

create function api.v1_create_share_link(p_account uuid, p_task text, p_fields jsonb, p_hash text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  if p_fields ->> 'access' = 'link' then perform cloud.v1_require_owner(p_account, v_ws); end if;
  insert into cloud.share_links (id, account_id, task_id, token_hash, access, expires_at)
  values (cloud.v1_id('shr'), p_account, p_task, p_hash, coalesce(p_fields ->> 'access', 'invited'),
          now() + make_interval(days => coalesce((p_fields ->> 'expires_in_days')::integer, 7)))
  returning * into l;
  perform cloud.v1_emit(v_ws, 'share_link.created', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create function api.v1_list_share_links(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_share_link_json(l) order by l.id)
    from cloud.share_links l where l.task_id = p_task), '[]'), 'next', null);
end;
$$;

create or replace function cloud.v1_workspace_of(p_account uuid, p_kind text, p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  v := case p_kind
    when 'workspace' then (select w.id from cloud.v1_workspaces w where w.id = p_id)
    when 'project' then (select p.workspace_id from cloud.projects p where p.id = p_id)
    when 'workflow' then (select w.workspace_id from cloud.workflows w where w.id = p_id)
    when 'task' then cloud.v1_task_workspace(p_id)
    when 'memory' then (select m.workspace_id from cloud.memories m where m.id = p_id)
    when 'artifact' then (select cloud.v1_task_workspace(a.task_id) from cloud.artifacts a where a.id = p_id)
    when 'upload' then (select cloud.v1_task_workspace(a.task_id)
                          from cloud.artifact_uploads u join cloud.artifacts a on a.id = u.artifact_id where u.id = p_id)
    when 'share link' then (select cloud.v1_task_workspace(l.task_id) from cloud.share_links l where l.id = p_id)
  end;
  if v is null or not cloud.v1_in(p_account, v) then perform cloud.v1_missing(p_kind); end if;
  return v;
end;
$$;

create or replace function api.v1_add_guest(p_account uuid, p_task text, p_email text, p_daily_write_budget integer,
                                            p_share_hash text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g cloud.task_guests;
  v_ws text := cloud.v1_workspace_of(p_account, 'task', p_task);
  v_expires timestamptz;
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.v1_require_owner(p_account, v_ws);
  if p_share_hash is not null then
    select l.expires_at into v_expires from cloud.share_links l
    where l.token_hash = p_share_hash and l.task_id = p_task and l.revoked_at is null and l.expires_at > now();
    if v_expires is null then
      raise exception 'That share link is not an open link of this task.' using errcode = 'AKB28';
    end if;
  end if;
  select * into g from cloud.task_guests where task_id = p_task and email = lower(btrim(p_email));
  if found then return jsonb_build_object('guest', cloud.v1_guest_json(g), 'invite', null); end if;
  if (select count(*) from cloud.task_guests where task_id = p_task) >= 50 then
    perform cloud.v1_refuse('A task takes at most 50 guests.');
  end if;
  insert into cloud.task_guests (task_id, email) values (p_task, lower(btrim(p_email))) returning * into g;
  perform cloud.v1_emit(v_ws, 'guest.added', cloud.v1_guest_json(g));
  return jsonb_build_object('guest', cloud.v1_guest_json(g), 'invite', case when v_expires is not null then
    jsonb_build_object(
      'inviter', (select coalesce(nullif(btrim(a.name), ''), a.handle) from cloud.accounts a where a.id = p_account),
      'title', (select t.title from cloud.tasks t where t.id = p_task),
      'expires_at', cloud.v1_ts(v_expires)) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- The shared review
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_share_access(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l cloud.share_links;
  t cloud.tasks;
  v_role text;
begin
  select * into l from cloud.share_links where token_hash = p_hash;
  if not found then
    raise exception 'This link is not valid.' using errcode = 'AKB24', detail = 'invalid';
  end if;
  if l.revoked_at is not null then
    raise exception 'This link has been revoked.' using errcode = 'AKB24', detail = 'revoked';
  end if;
  if l.expires_at <= now() then
    raise exception 'This link has expired.' using errcode = 'AKB24', detail = 'expired';
  end if;
  select * into t from cloud.tasks where id = l.task_id;
  v_role := cloud.v1_role(p_subject, t.workspace_id);
  if v_role is null and p_subject is not null and p_email is not null
    and exists (select 1 from cloud.task_guests g where g.task_id = t.id and g.email = lower(p_email)) then
    v_role := 'guest';
  end if;
  if v_role is null and l.access <> 'link' then
    if p_subject is null then
      raise exception 'Sign in to open this review.' using errcode = 'AKB25', detail = 'sign_in_required';
    end if;
    raise exception 'This email is not invited to this review.' using errcode = 'AKB25', detail = 'not_invited';
  end if;
  return jsonb_build_object('link', l.id, 'workspace', t.workspace_id, 'task', t.id,
    'role', v_role,
    'account', case when v_role in ('owner', 'member') then p_subject else cloud.v1_payer_of(t.workspace_id) end);
end;
$$;

create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  t cloud.tasks;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into t from cloud.tasks where id = l.task_id;

  v_out := jsonb_build_object(
    'object', 'shared_review',
    'role', v_role,
    'me', case when p_subject is null then null else jsonb_build_object('email', lower(p_email),
            'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end,
    'link', jsonb_build_object('id', l.id, 'access', l.access, 'expires_at', cloud.v1_ts(l.expires_at)),
    'owner', (select jsonb_build_object('handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url)
              from cloud.accounts a where a.id = t.account_id),
    'workspace', (select jsonb_build_object('id', w.id, 'name', w.name) from cloud.v1_workspaces w
                  where w.id = t.workspace_id and v_role in ('owner', 'member')),
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'review', case when v_role is null then cloud.v1_review_json(t) - 'status' else cloud.v1_review_json(t) end,
    'card', case when t.card_path is null then null else jsonb_build_object('version', t.card_version,
              'project', t.project_id, 'path', t.card_path, 'metadata', t.card_metadata, 'assets', t.card_assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(t.card_assets) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.id in (select cloud.v1_reviewed_artifacts(t)) and a.latest_version > 0), '[]'));

  if v_role is null then return v_out; end if;
  v_out := v_out || jsonb_build_object(
    'decisions', coalesce((select jsonb_agg(cloud.v1_decision_json(d) order by d.id)
                           from cloud.decisions d where d.task_id = t.id), '[]'),
    'comments', coalesce((select jsonb_agg(cloud.v1_comment_json(m) order by m.id)
                          from cloud.comments m where m.task_id = t.id), '[]'),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision', r.revision, 'phase', r.phase,
                                              'created_at', cloud.v1_ts(r.created_at)) order by r.revision, r.phase)
                           from cloud.review_revisions r where r.task_id = t.id), '[]'));
  if v_role <> 'owner' then return v_out; end if;
  return v_out || jsonb_build_object('guests', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = t.id), '[]'));
end;
$$;

create or replace function api.v1_shared_comment(p_hash text, p_subject uuid, p_email text, p_body text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
begin
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_comment((v ->> 'account')::uuid, v ->> 'task', p_body, v -> 'author', p_daily_write_budget));
end;
$$;

create or replace function api.v1_shared_decide(
  p_hash text, p_subject uuid, p_email text, p_picked integer, p_text text, p_revision integer, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_member(p_hash, p_subject, p_email);
  t cloud.tasks;
  v_option jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_fields jsonb;
begin
  v := v || jsonb_build_object('author', cloud.v1_reviewer(v ->> 'role', p_subject, p_email));
  select * into t from cloud.tasks where id = v ->> 'task';
  if t.card_path is null then
    raise exception 'This task has no full card to review yet.' using errcode = 'AKB26', detail = 'card_missing';
  end if;
  if p_picked is null then
    if v_text is null then perform cloud.v1_refuse('Write what should change.'); end if;
    v_fields := jsonb_build_object('decision', 'request_changes', 'comment', v_text);
  else
    v_option := coalesce(t.review -> 'options', '[{"label": "Approve", "approve": true}]') -> p_picked;
    if v_option is null or p_picked < 0 then perform cloud.v1_refuse('No option has this number.'); end if;
    v_fields := jsonb_build_object(
      'decision', case when coalesce((v_option ->> 'approve')::boolean, false) then 'approve' else 'request_changes' end,
      'comment', concat_ws(E'\n\n', v_option ->> 'label', v_text));
  end if;
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_decision((v ->> 'account')::uuid, t.id, v_fields || jsonb_build_object('review_revision', p_revision),
                           v -> 'author', p_daily_write_budget));
end;
$$;

create or replace function api.v1_shared_file(p_hash text, p_subject uuid, p_email text, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  t cloud.tasks;
  v_file jsonb;
begin
  select * into t from cloud.tasks where id = v ->> 'task';
  select av.file into v_file from cloud.artifact_versions av
   where av.artifact_id = p_artifact and av.version = p_version and av.artifact_id in (select cloud.v1_reviewed_artifacts(t));
  if not found then perform cloud.v1_missing('artifact version under review'); end if;
  return jsonb_build_object('stored', v_file);
end;
$$;

create or replace function api.v1_shared_component(p_hash text, p_subject uuid, p_email text, p_name text, p_version text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  t cloud.tasks;
  v cloud.component_versions;
begin
  select * into t from cloud.tasks where id = s ->> 'task';
  select cv.* into v
  from cloud.component_versions cv join cloud.components c on c.id = cv.component_id
  where c.name = p_name and cv.version = p_version and exists (
    select 1 from cloud.artifact_versions av
    where av.artifact_id in (select cloud.v1_reviewed_artifacts(t)) and av.component_version = cv.hash);
  if not found then perform cloud.v1_missing('component under review'); end if;
  if v.deleted_at is not null then
    raise exception 'This component has been removed.' using errcode = 'AKB20';
  end if;
  return cloud.v1_component_version_json(v) || jsonb_build_object('stored', v.hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- Alerts and the Runner's inbox
-- ---------------------------------------------------------------------------

create function cloud.raise_alert(p_task cloud.tasks, p_kind text, p_phase integer, p_comment text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r cloud.runners;
  a cloud.alerts;
  v_desktop boolean;
begin
  if not cloud.v1_in(p_task.account_id, p_task.workspace_id) then return; end if;
  select * into r from cloud.runners where owner_id = p_task.account_id and live_until > now() and notify;
  v_desktop := r.owner_id is not null and not exists (
    select 1 from cloud.project_folders f
     where f.project_id = p_task.project_id and f.machine_id = r.machine_id and not f.notify);
  insert into cloud.alerts (id, account_id, kind, task_id, phase, comment_id, channel, machine_id)
  values (cloud.v1_id('alr'), p_task.account_id, p_kind, p_task.id, p_phase, p_comment,
          case when v_desktop then 'desktop' else 'web' end, case when v_desktop then r.machine_id end)
  returning * into a;
  perform cloud.v1_emit(p_task.workspace_id, 'alert.created', cloud.v1_alert_json(a), a.account_id);
  if v_desktop then perform cloud.hint_desktop(a.account_id, 'alert', jsonb_build_object('alertId', a.id)); end if;
end;
$$;

create function cloud.read_alerts_where(p_account uuid, p_task text, p_phase integer, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
begin
  for a in update cloud.alerts set read_at = now()
            where account_id = p_account and task_id = p_task and read_at is null
              and (p_phase is null or phase = p_phase)
              and (p_kind is null or kind = p_kind)
            returning * loop
    perform cloud.v1_emit(cloud.v1_task_workspace(p_task), 'alert.read', cloud.v1_alert_json(a), p_account);
  end loop;
end;
$$;

create function cloud.review_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status is not distinct from old.review_status then return null; end if;
  if new.review_status = 'ready' then
    perform cloud.raise_alert(new, 'review', new.review_phase);
  elsif old.review_status = 'ready' then
    -- Decided: there is nothing left to review.
    perform cloud.read_alerts_where(new.account_id, new.id, old.review_phase, null);
  end if;
  perform cloud.hint_desktop(new.account_id, 'inbox', jsonb_build_object('taskId', new.id));
  return null;
end;
$$;

create trigger review_alerts after update of review_status on cloud.tasks
for each row execute function cloud.review_alerts();

create or replace function cloud.comment_alerts() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  select * into t from cloud.tasks where id = new.task_id;
  if new.author ->> 'kind' = 'reviewer' or (new.author ->> 'kind' = 'user'
     and new.author ->> 'handle' is distinct from (select a.handle from cloud.accounts a where a.id = t.account_id)) then
    perform cloud.raise_alert(t, 'comment', new.phase, new.id);
  else
    perform cloud.read_alerts_where(t.account_id, new.task_id, new.phase, 'comment');
  end if;
  return null;
end;
$$;

create or replace function api.v1_read_alert(p_account uuid, p_id text, p_daily_write_budget integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a cloud.alerts;
  v_ws text;
begin
  select * into a from cloud.alerts where id = p_id and account_id = p_account;
  v_ws := cloud.v1_task_workspace(a.task_id);
  if a.id is null or not cloud.v1_in(p_account, v_ws) then perform cloud.v1_missing('alert'); end if;
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  perform cloud.read_alerts_where(p_account, a.task_id, a.phase, a.kind);
  perform cloud.hint_desktop(p_account, 'inbox', jsonb_build_object('taskId', a.task_id));
  select * into a from cloud.alerts where id = p_id;
  return cloud.v1_alert_json(a);
end;
$$;

create or replace function api.runner_inbox(p_subject uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'review', coalesce((
      select json_agg(x order by x.at desc) from (
        select t.id task, t.title, p.id project, p.name project_name, t.review_phase phase,
               cloud.v1_phase_title(t, t.review_phase) detail, t.review_at at,
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
               cloud.v1_phase_title(t, cloud.v1_card_phase(t)) detail, t.created_at at, null::text alert
          from cloud.tasks t
          left join cloud.projects p on p.id = t.project_id
         where t.account_id = p_subject and t.status = 'running' and cloud.v1_in(p_subject, t.workspace_id)
         order by t.created_at desc limit 200) x), '[]'::json)
  );
$$;

create or replace function api.v1_delete_expired(p_account uuid, p_days integer, p_tasks text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tasks text[];
  v_named text[];
  v_events integer;
  v_deleted integer;
  v_jobs integer;
begin
  select coalesce(array_agg(t.id), '{}') into v_tasks from cloud.tasks t join cloud.v1_workspaces w on w.id = t.workspace_id
   where w.account_id = p_account and t.id = any(p_tasks) and t.status in ('done', 'failed', 'cancelled')
     and t.updated_at < now() - make_interval(days => p_days);
  select v_tasks || coalesce((select array_agg(id) from cloud.artifacts where task_id = any(v_tasks)), '{}')
    into v_named;
  delete from cloud.api_events
   where workspace_id in (select w.id from cloud.v1_workspaces w where w.account_id = p_account)
     and (data ->> 'id' = any(v_named) or data ->> 'task' = any(v_named) or data ->> 'artifact' = any(v_named));
  get diagnostics v_events = row_count;
  delete from cloud.tasks where id = any(v_tasks);
  get diagnostics v_deleted = row_count;
  delete from cloud.runner_jobs
   where owner_id = p_account and state = 'finished' and finished_at < now() - make_interval(days => p_days);
  get diagnostics v_jobs = row_count;
  return jsonb_build_object('tasks', v_deleted, 'events', v_events, 'jobs', v_jobs);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname like 'v1\_%') or (n.nspname = 'cloud' and p.proname like 'v1\_%')
       or p.oid::regprocedure::text in ('cloud.raise_alert(cloud.tasks,text,integer,text)',
                                        'cloud.read_alerts_where(uuid,text,integer,text)', 'cloud.review_alerts()')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
