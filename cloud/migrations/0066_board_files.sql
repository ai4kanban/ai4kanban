-- Board files per project in a Durable Object (#2081): a task's card, a project's memory and the
-- workflow files it runs on are files in the project's `Board`, not rows here. `tasks` keeps an
-- index of each card — where it is, its `seq` as `card_version`, the drafting stages and the
-- assets it shows — written by the Worker as a board write lands.
--
-- - **Parked, not lost**: the cards and project memory move to `cloud.board_import`, which
--   `scripts/board-import.mjs` writes into each project's `Board` and empties.
-- - **A push belongs to a job**: `v1_board_job` lets a Runner write only while it holds the job.
-- - **A lapsed lease runs again**: a task's job whose lease ran out is finished and dispatched
--   once more, at the head of the task's queue, sharing its one retry with a conflict. A retry
--   that lapses fails its task as an interrupted one did.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.tasks
  add column card_path text,
  add column card_status text,
  add column card_metadata jsonb not null default '{}',
  add column card_assets jsonb not null default '{}';

create table cloud.board_import (
  project_id text not null references cloud.projects (id) on delete cascade,
  path text not null,
  content text not null,
  primary key (project_id, path)
);
alter table cloud.board_import enable row level security;

insert into cloud.board_import (project_id, path, content)
select t.project_id,
       case when t.status = 'done' then '.archive/' else 'todo/' end || t.number || '-' || replace(t.id, '_', '-') || '.md',
       k.body
from cloud.task_cards k join cloud.tasks t on t.id = k.task_id;

insert into cloud.board_import (project_id, path, content)
select t.project_id, 'assets/' || t.id || '.json', jsonb_pretty(k.assets) || E'\n'
from cloud.task_cards k join cloud.tasks t on t.id = k.task_id
where k.assets <> '{}';

insert into cloud.board_import (project_id, path, content)
select m.project_id, 'memory/' || m.name, m.body
from cloud.memories m where m.scope = 'project' and m.project_id is not null
on conflict do nothing;

update cloud.tasks t
   set card_path = case when t.status = 'done' then '.archive/' else 'todo/' end || t.number || '-' || replace(t.id, '_', '-') || '.md',
       card_metadata = k.metadata,
       card_assets = k.assets
  from cloud.task_cards k where k.task_id = t.id;

delete from cloud.memories where scope = 'project';

drop function api.v1_commit_files(uuid, text, jsonb, jsonb, integer);
drop function api.v1_save_card(uuid, text, jsonb, integer, integer);
drop function api.v1_card(uuid, text);
drop function cloud.v1_write_card(text, jsonb);
drop function cloud.v1_card_json(cloud.task_cards, integer);
drop function cloud.v1_card_phases(cloud.task_cards);
drop function cloud.v1_reviewed_artifacts(cloud.task_checkpoints);
drop table cloud.task_cards;

-- ---------------------------------------------------------------------------
-- The card index
-- ---------------------------------------------------------------------------

create function cloud.v1_card_phases(p_metadata jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_metadata -> 'phases') = 'array' and jsonb_array_length(p_metadata -> 'phases') > 0
    then p_metadata -> 'phases' end;
$$;

create function cloud.v1_card_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'card', 'task', t.id, 'project', t.project_id, 'path', t.card_path,
    'version', t.card_version, 'metadata', t.card_metadata, 'assets', t.card_assets, 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create function cloud.v1_reviewed_artifacts(c cloud.task_checkpoints) returns setof text
language sql stable security definer set search_path = '' as $$
  select a.id from cloud.artifacts a where a.checkpoint_id = c.id
  union
  select a.id from cloud.tasks t, jsonb_each(t.card_assets) e, cloud.artifacts a
   where t.id = c.task_id and a.id = e.value ->> 'artifact' and a.task_id = c.task_id;
$$;

-- Only the asset entries naming a version of an artifact on the task, or its latest.
create function cloud.v1_card_assets(p_task text, p_assets jsonb) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}') from jsonb_each(coalesce(p_assets, '{}')) e
  where jsonb_typeof(e.value) = 'object' and exists (
    select 1 from cloud.artifacts a
    where a.id = e.value ->> 'artifact' and a.task_id = p_task
      and (e.value -> 'version' is null or (jsonb_typeof(e.value -> 'version') = 'number'
           and (e.value ->> 'version')::integer between 1 and a.latest_version)));
$$;

-- What a board write changed, one entry per card file or assets list, deletions first:
-- `{ task, path, seq, deleted?, front?, metadata? }` for a card, `{ task, assets }` for its assets.
create function cloud.v1_index_cards(p_project text, p_cards jsonb) returns integer
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
        card_metadata = coalesce(e -> 'metadata', jsonb_strip_nulls(jsonb_build_object(
          'phases', e #> '{front,phases}', 'phase', e #> '{front,phase}'))),
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

create function api.v1_index_cards(p_account uuid, p_project text, p_cards jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'project', p_project), p_daily_write_budget);
  return jsonb_build_object('indexed', cloud.v1_index_cards(p_project, p_cards));
end;
$$;

create function api.v1_card(p_account uuid, p_task text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t cloud.tasks;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select * into t from cloud.tasks where id = p_task;
  if t.card_path is null then perform cloud.v1_missing('card'); end if;
  return cloud.v1_card_json(t);
end;
$$;

-- Where a card is written from outside a job: its file, or the one it gets. Its assets must
-- name the task's own artifact versions.
create function api.v1_card_place(p_account uuid, p_task text, p_assets jsonb, p_daily_write_budget integer) returns jsonb
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
  return cloud.v1_card_json(t) || jsonb_build_object('path',
    coalesce(t.card_path, 'todo/' || t.number || '-' || replace(t.id, '_', '-') || '.md'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Board writes
-- ---------------------------------------------------------------------------

-- A Runner writes a project's board only while it holds a job of that project.
create function api.v1_board_job(p_account uuid, p_project text, p_job uuid, p_machine uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
begin
  perform cloud.v1_workspace_of(p_account, 'project', p_project);
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

-- The parked files of one project, for scripts/board-import.mjs.
create function api.v1_board_import(p_project text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('path', b.path, 'content', b.content) order by b.path), '[]')
  from cloud.board_import b where b.project_id = p_project;
$$;

create function api.v1_board_imported(p_project text, p_cards jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from cloud.board_import where project_id = p_project;
  return jsonb_build_object('indexed', cloud.v1_index_cards(p_project, p_cards));
end;
$$;

-- ---------------------------------------------------------------------------
-- A lapsed lease
-- ---------------------------------------------------------------------------

create function cloud.v1_requeue_lapsed(p_owner uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  j cloud.runner_jobs;
  r cloud.runner_jobs;
  n integer := 0;
begin
  for j in
    select * from cloud.runner_jobs x
    where x.task_id is not null and x.attempt < 2 and cloud.runner_job_interrupted(x)
      and (p_owner is null or x.owner_id = p_owner)
    order by x.seq for update skip locked
  loop
    perform cloud.v1_lock(cloud.v1_task_workspace(j.task_id));
    update cloud.runner_jobs x set state = 'finished', outcome = 'failed', reason = 'The Runner stopped before this step finished.',
      finished_at = now(), updated_at = now()
    where x.id = j.id and cloud.runner_job_interrupted(x);
    if not found then continue; end if;
    insert into cloud.runner_jobs (owner_id, runtime, model, project_id, project_dir, machine_id, task_id, stage, flow,
                                   attempt, resume, prompt, attachments)
    values (j.owner_id, j.runtime, j.model, j.project_id, j.project_dir, j.machine_id,
            j.task_id, j.stage, j.flow, 2, j.resume, j.prompt, j.attachments)
    returning * into r;
    perform cloud.hint_runner(j.owner_id, r.id);
    update cloud.task_chats set job_id = r.id, updated_at = now() where job_id = j.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- What read task_cards
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_after_approval(c cloud.task_checkpoints) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_phases jsonb;
  v_more boolean;
  v_status text;
begin
  select * into t from cloud.tasks where id = c.task_id for update;
  if t.workflow_version is null then return; end if;
  v_phases := cloud.v1_card_phases(t.card_metadata);
  v_more := v_phases is not null and jsonb_array_length(v_phases) > c.position;
  if v_more then
    update cloud.tasks set card_metadata = card_metadata || jsonb_build_object('phase', c.position + 1)
    where id = c.task_id returning * into t;
    v_status := 'queued';
  elsif exists (select 1 from cloud.task_checkpoints e where e.task_id = c.task_id and e.status <> 'approved') then
    v_status := 'queued';
  else
    v_status := case (select v.delivers from cloud.workflow_versions v where v.id = t.workflow_version)
      when 'plan' then 'done' else 'queued' end;
  end if;
  if t.run and v_status = 'queued' then
    perform cloud.v1_dispatch_flow(c.task_id, case when v_more then 'approve' else 'implement' end);
    select * into t from cloud.tasks where id = c.task_id;
  else
    update cloud.tasks set status = v_status, updated_at = now(),
      result = case when t.run and v_status = 'done' then (
        select j.reply from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null and j.state = 'finished'
        order by j.seq desc limit 1) else result end
    where id = c.task_id returning * into t;
  end if;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$$;

-- A pinned version moves the card's pin with it; the Worker writes the assets file after.
create or replace function api.v1_save_artifact_version(p_account uuid, p_artifact text, p_content jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  t cloud.tasks;
  v jsonb;
begin
  perform cloud.v1_require_owner(p_account, cloud.v1_workspace_of(p_account, 'artifact', p_artifact));
  v := api.v1_create_artifact_version(p_account, p_artifact, p_content, null, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact;
  select * into t from cloud.tasks where id = a.task_id for update;
  if exists (select 1 from jsonb_each(t.card_assets) e where e.value ->> 'artifact' = a.id and e.value ? 'version') then
    update cloud.tasks set card_assets = (
      select jsonb_object_agg(e.key, case when e.value ->> 'artifact' = a.id and e.value ? 'version'
                                         then e.value || jsonb_build_object('version', v -> 'version') else e.value end)
      from jsonb_each(t.card_assets) e), updated_at = now()
    where id = t.id returning * into t;
    perform cloud.v1_emit(t.workspace_id, 'card.updated', cloud.v1_card_json(t));
  end if;
  return v;
end;
$$;

create or replace function api.v1_create_decision(p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  t cloud.tasks;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_card boolean;
  v_status text;
  v_text text;
  v_ws text := cloud.v1_workspace_of(p_account, 'checkpoint', p_checkpoint);
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint for update;
  perform cloud.v1_task_open(c.task_id);
  select * into t from cloud.tasks where id = c.task_id;
  if t.run and (cloud.v1_flow_job(t.id)).id is not null then
    perform cloud.v1_refuse('The agent is still working on this task.');
  end if;
  if c.status = 'pending' then
    perform cloud.v1_refuse('Nothing has been submitted to this checkpoint yet.');
  end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position > c.position and e.status <> 'pending'
  ) then
    perform cloud.v1_refuse('A later checkpoint has already moved on.');
  end if;
  v_card := exists (select 1 from cloud.tasks k where k.id = c.task_id and k.card_path is not null);
  if v_revision is null and v_card then
    perform cloud.v1_refuse('This task has a card: name the review_revision you reviewed.');
  end if;
  if v_revision is not null and v_revision <> c.review_revision then
    raise exception 'This checkpoint has changed since it was opened. Reload it and review again.'
      using errcode = 'AKB26', detail = 'review_outdated';
  end if;

  if v_artifact is null then
    select v.artifact_id, v.version into v_artifact, v_version
    from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where a.checkpoint_id = c.id order by v.created_at desc, v.version desc limit 1;
  elsif v_version is null then
    select a.latest_version into v_version from cloud.artifacts a where a.id = v_artifact and a.checkpoint_id = c.id;
  end if;
  -- A card review with nothing attached decides on the card alone.
  if not (v_artifact is null and p_fields ->> 'artifact' is null and v_card) and not exists (
    select 1 from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where v.artifact_id = v_artifact and v.version = v_version and a.checkpoint_id = c.id
  ) then
    perform cloud.v1_missing('artifact version on this checkpoint');
  end if;

  insert into cloud.decisions (id, account_id, checkpoint_id, artifact_id, artifact_version, decision, comment,
                               decided_by, review_revision)
  values (cloud.v1_id('dec'), c.account_id, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision)
  returning * into d;
  perform cloud.v1_emit(v_ws, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(v_ws, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
    if v_status = 'approved' then
      perform cloud.v1_after_approval(c);
    elsif t.run then
      v_text := d.comment;
      if c.review ? 'card_question' and strpos(v_text, c.review ->> 'question') = 0 then
        v_text := concat_ws(E'\n\n', c.review ->> 'question', nullif(v_text, ''));
      end if;
      -- A build held on a question carries on with the answer.
      perform cloud.v1_dispatch_flow(t.id, case
        when not c.review ? 'card_question' then 'revise'
        when (select j.flow ->> 'verb' from cloud.runner_jobs j where j.task_id = t.id and j.flow is not null
               order by j.seq desc limit 1) = 'implement' then 'implement'
        else 'resolve' end, v_text);
      select * into t from cloud.tasks where id = c.task_id;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
    end if;
  end if;
  return cloud.v1_decision_json(d);
end;
$function$;

create or replace function api.v1_shared_decide(p_hash text, p_subject uuid, p_email text, p_picked integer, p_text text, p_revision integer, p_daily_write_budget integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
  c cloud.task_checkpoints;
  v_option jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_fields jsonb;
begin
  select * into c from cloud.task_checkpoints where id = v ->> 'checkpoint';
  if not exists (select 1 from cloud.tasks k where k.id = c.task_id and k.card_path is not null) then
    raise exception 'This checkpoint has no full card to review yet.' using errcode = 'AKB26', detail = 'card_missing';
  end if;
  if p_picked is null then
    if v_text is null then perform cloud.v1_refuse('Write what should change.'); end if;
    v_fields := jsonb_build_object('decision', 'request_changes', 'comment', v_text);
  else
    v_option := coalesce(c.review -> 'options', '[{"label": "Approve", "approve": true}]') -> p_picked;
    if v_option is null or p_picked < 0 then perform cloud.v1_refuse('No option has this number.'); end if;
    v_fields := jsonb_build_object(
      'decision', case when coalesce((v_option ->> 'approve')::boolean, false) then 'approve' else 'request_changes' end,
      'comment', concat_ws(E'\n\n', v_option ->> 'label', v_text));
  end if;
  return jsonb_build_object('workspace', v -> 'workspace', 'result',
    api.v1_create_decision((v ->> 'account')::uuid, c.id, v_fields || jsonb_build_object('review_revision', p_revision),
                           v -> 'author', p_daily_write_budget));
end;
$function$;

create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path = ''
as $function$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;

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
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'checkpoint', case when v_role is null then cloud.v1_checkpoint_json(c) - 'status' else cloud.v1_checkpoint_json(c) end,
    'card', case when t.card_path is null then null else jsonb_build_object('version', t.card_version,
              'project', t.project_id, 'path', t.card_path, 'metadata', t.card_metadata, 'assets', t.card_assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(t.card_assets) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.id in (select cloud.v1_reviewed_artifacts(c)) and a.latest_version > 0), '[]'));

  if v_role is null then return v_out; end if;
  v_out := v_out || jsonb_build_object(
    'decisions', coalesce((select jsonb_agg(cloud.v1_decision_json(d) order by d.id)
                           from cloud.decisions d where d.checkpoint_id = c.id), '[]'),
    'comments', coalesce((select jsonb_agg(cloud.v1_comment_json(m) order by m.id)
                          from cloud.checkpoint_comments m where m.checkpoint_id = c.id), '[]'),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision', r.revision, 'created_at', cloud.v1_ts(r.created_at))
                                            order by r.revision)
                           from cloud.checkpoint_revisions r where r.checkpoint_id = c.id), '[]'));
  if v_role <> 'owner' then return v_out; end if;
  return v_out || jsonb_build_object('guests', coalesce((
    select jsonb_agg(cloud.v1_guest_json(g) order by g.created_at, g.email)
    from cloud.task_guests g where g.task_id = t.id), '[]'));
end;
$function$;

create or replace function cloud.v1_submit_draft(p_task text, p_review jsonb DEFAULT NULL::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  t cloud.tasks;
  c cloud.task_checkpoints;
  v_phases jsonb;
  v_n integer := 1;
  v_key text := 'plan';
  v_title text;
begin
  select * into t from cloud.tasks where id = p_task for update;
  if t.status in ('done', 'failed', 'cancelled') then return; end if;
  v_phases := cloud.v1_card_phases(t.card_metadata);
  v_title := t.title;
  if v_phases is not null then
    v_n := least(greatest(coalesce((t.card_metadata ->> 'phase')::integer, 1), 1), jsonb_array_length(v_phases));
    v_key := 'phase-' || v_n;
    v_title := v_phases ->> (v_n - 1);
  end if;

  delete from cloud.task_checkpoints where task_id = p_task and position > v_n;
  select * into c from cloud.task_checkpoints where task_id = p_task and position = v_n for update;
  if found then
    update cloud.task_checkpoints set key = v_key, title = v_title, status = 'ready', review = coalesce(p_review, review),
      updated_at = now() where id = c.id;
  else
    insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition, status, review)
    values (cloud.v1_id('cp'), t.account_id, p_task, v_n, v_key, v_title, '{}', 'ready', p_review)
    returning * into c;
  end if;
  c := cloud.v1_revise(c.id);
  perform cloud.v1_emit(t.workspace_id, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  update cloud.tasks set status = 'waiting_review', updated_at = now() where id = p_task returning * into t;
  perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
end;
$function$;

create or replace function api.v1_task_workflow(p_account uuid, p_task text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path = ''
as $function$
declare
  v cloud.workflow_versions;
begin
  perform cloud.v1_workspace_of(p_account, 'task', p_task);
  select v2.* into v from cloud.tasks t join cloud.workflow_versions v2 on v2.id = t.workflow_version where t.id = p_task;
  if not found then perform cloud.v1_missing('workflow version for this task'); end if;
  return jsonb_build_object('object', 'workflow_version', 'project', (select t.project_id from cloud.tasks t where t.id = p_task), 'workflow', v.workflow_id, 'builtin', v.account_id is null,
    'version', v.version, 'name', v.name, 'description', v.description, 'delivers', v.delivers, 'files', v.files);
end;
$function$;

create or replace function cloud.runner_job_json(p_job cloud.runner_jobs)
 returns json
 language sql
 stable
 set search_path = ''
as $function$
  select json_build_object(
    'id', p_job.id,
    'runtime', p_job.runtime,
    'model', p_job.model,
    'test', p_job.test,
    'project', coalesce(p_job.project_id, (select t.project_id from cloud.tasks t where t.id = p_job.task_id)),
    'projectDir', p_job.project_dir,
    'task', p_job.task_id,
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
$function$;

create or replace function api.v1_delete_project(p_account uuid, p_id text, p_daily_write_budget integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  p cloud.projects;
  m cloud.memories;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_id);
  v_inbox text;
  v_moved jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_id for update;
  if p.inbox then perform cloud.v1_refuse('The inbox cannot be deleted.'); end if;
  if exists (select 1 from cloud.tasks where project_id = p_id) then
    if not (select personal from cloud.v1_workspaces where id = v_ws) then
      perform cloud.v1_refuse('This project still has tasks. Move them to another project first.');
    end if;
    v_inbox := cloud.v1_inbox(v_ws);
    for t in select * from cloud.tasks where project_id = p_id order by number for update loop
      update cloud.tasks set project_id = v_inbox, updated_at = now() where id = t.id returning * into t;
      perform cloud.v1_emit(v_ws, 'task.updated', cloud.v1_task_json(t));
      if t.card_path is not null then v_moved := v_moved || jsonb_build_object('task', t.id, 'path', t.card_path); end if;
    end loop;
  end if;
  for m in delete from cloud.memories where project_id = p_id returning * loop
    perform cloud.v1_emit(v_ws, 'memory.deleted', cloud.v1_memory_json(m));
  end loop;
  delete from cloud.projects where id = p_id;
  perform cloud.v1_emit(v_ws, 'project.deleted', cloud.v1_project_json(p));
  return jsonb_build_object('id', p.id, 'object', 'project', 'deleted', true, 'moved', v_moved, 'inbox', v_inbox);
end;
$function$;

create or replace function api.list_runner_jobs(p_subject uuid, p_machine uuid)
 returns json
 language plpgsql
 security definer
 set search_path = ''
as $function$
begin
  if (cloud.runner_for(p_subject, p_machine)).owner_id is null then return '[]'::json; end if;
  perform cloud.v1_requeue_lapsed(p_subject);
  return coalesce((
    select json_agg(cloud.runner_job_json(j) order by j.created_at, j.seq)
    from cloud.runner_jobs j
    where j.owner_id = p_subject
      and (j.machine_id is null or j.machine_id = p_machine)
      and ((j.state = 'waiting' and not cloud.runner_job_queued(j))
           or (j.state = 'claimed' and j.claimed_machine = p_machine and not cloud.runner_job_interrupted(j)))
  ), '[]'::json);
end;
$function$;

create or replace function cloud.v1_fail_interrupted(p_owner uuid DEFAULT NULL::uuid)
 returns integer
 language plpgsql
 security definer
 set search_path = ''
as $function$
declare
  v_id text;
  t cloud.tasks;
  n integer := 0;
begin
  perform cloud.v1_requeue_lapsed(p_owner);
  for v_id in
    select x.id from cloud.tasks x
    where x.run and x.status in ('queued', 'running') and (p_owner is null or x.account_id = p_owner)
      and exists (select 1 from cloud.runner_jobs j where j.task_id = x.id and j.flow is not null
                  and cloud.runner_job_interrupted(j))
  loop
    perform cloud.v1_lock(cloud.v1_task_workspace(v_id));
    select * into t from cloud.tasks where id = v_id for update;
    if t.status not in ('queued', 'running') or (cloud.v1_flow_job(v_id)).id is not null then continue; end if;
    update cloud.tasks set status = 'failed', failure = 'The Runner stopped before this step finished.', updated_at = now()
     where id = v_id returning * into t;
    perform cloud.v1_emit(t.workspace_id, 'task.updated', cloud.v1_task_json(t));
    n := n + 1;
  end loop;
  return n;
end;
$function$;
