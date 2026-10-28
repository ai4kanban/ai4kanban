-- One card per task (#2036): a task's card is saved over in place, and a checkpoint reviews
-- the task's current card instead of a version it was bound to.
--
-- - **`tasks.card_version` stays a revision**: a write names the one it was made on, so one
--   writer never overwrites another; no earlier card can be read back.
-- - **A new card is a new review**: saving one moves on `review_revision` of every checkpoint
--   of the task that is submitted and not approved.
-- - **Earlier versions are dropped**: each task keeps its latest card only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.task_cards (
  task_id text primary key references cloud.tasks (id) on delete cascade,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  body text not null check (octet_length(body) <= 262144),
  metadata jsonb not null default '{}',
  -- A path the body names → `{ artifact, version? }` on the same task.
  assets jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table cloud.task_cards enable row level security;

insert into cloud.task_cards (task_id, account_id, body, metadata, assets, updated_at)
select v.task_id, v.account_id, v.body, v.metadata, v.assets, v.created_at
from cloud.card_versions v join cloud.tasks t on t.id = v.task_id and t.card_version = v.version;

drop function cloud.v1_card_version_json(cloud.card_versions);
drop function api.v1_create_card_version(uuid, text, jsonb, integer, integer);
drop function api.v1_card_version(uuid, text, integer);
drop table cloud.card_versions;

alter table cloud.task_checkpoints drop column card_version;
alter table cloud.checkpoint_revisions drop column card_version;
alter table cloud.decisions drop column card_version;

-- ---------------------------------------------------------------------------
-- What each resource reads as
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_checkpoint_json(c cloud.task_checkpoints) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'object', 'checkpoint', 'task', c.task_id, 'position', c.position,
    'key', c.key, 'title', c.title, 'artifact_type', c.definition -> 'artifact_type',
    'question', coalesce(c.review ->> 'question', c.definition ->> 'question', ''),
    'options', c.review -> 'options',
    'acceptance', coalesce(c.definition ->> 'acceptance', ''),
    'review_revision', c.review_revision,
    'status', c.status, 'created_at', cloud.v1_ts(c.created_at), 'updated_at', cloud.v1_ts(c.updated_at));
$$;

create or replace function cloud.v1_decision_json(d cloud.decisions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'object', 'decision', 'checkpoint', d.checkpoint_id,
    'artifact', d.artifact_id, 'artifact_version', d.artifact_version, 'decision', d.decision,
    'comment', d.comment, 'decided_by', d.decided_by, 'review_revision', d.review_revision,
    'created_at', cloud.v1_ts(d.created_at));
$$;

create function cloud.v1_card_json(k cloud.task_cards, p_version integer) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'card', 'task', k.task_id, 'version', p_version, 'body', k.body,
    'metadata', k.metadata, 'assets', k.assets, 'updated_at', cloud.v1_ts(k.updated_at));
$$;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

create function api.v1_save_card(
  p_account uuid, p_task text, p_fields jsonb, p_base integer, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  k cloud.task_cards;
  v_bad text;
  v_cp text;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into t from cloud.tasks where id = p_task and account_id = p_account for update;
  if not found then perform cloud.v1_missing('task'); end if;
  perform cloud.v1_task_open(p_task);
  if t.card_version <> p_base then
    perform cloud.v1_refuse(format('The card is at version %s now; read it and write against that.', t.card_version));
  end if;
  select e.key into v_bad from jsonb_each(coalesce(p_fields -> 'assets', '{}')) e
  where not exists (
    select 1 from cloud.artifacts a
    where a.id = e.value ->> 'artifact' and a.task_id = p_task
      and (e.value -> 'version' is null or (e.value ->> 'version')::integer between 1 and a.latest_version))
  limit 1;
  if v_bad is not null then
    raise exception 'The asset % names no artifact version on this task.', v_bad using errcode = 'AKB20';
  end if;
  insert into cloud.task_cards (task_id, account_id, body, metadata, assets)
  values (p_task, p_account, p_fields ->> 'body', coalesce(p_fields -> 'metadata', '{}'), coalesce(p_fields -> 'assets', '{}'))
  on conflict (task_id) do update set body = excluded.body, metadata = excluded.metadata, assets = excluded.assets,
    updated_at = now()
  returning * into k;
  update cloud.tasks set card_version = card_version + 1, updated_at = now() where id = p_task returning * into t;
  for v_cp in
    select c.id from cloud.task_checkpoints c
    where c.task_id = p_task and c.status not in ('pending', 'approved') order by c.position
  loop
    perform cloud.v1_revise(v_cp);
  end loop;
  perform cloud.v1_emit(p_account, 'card.updated', cloud.v1_card_json(k, t.card_version) - 'body');
  return cloud.v1_card_json(k, t.card_version);
end;
$$;

create function api.v1_card(p_account uuid, p_task text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  k cloud.task_cards;
begin
  select * into k from cloud.task_cards where task_id = p_task and account_id = p_account;
  if not found then perform cloud.v1_missing('card'); end if;
  return cloud.v1_card_json(k, (select t.card_version from cloud.tasks t where t.id = p_task));
end;
$$;

-- ---------------------------------------------------------------------------
-- What a checkpoint holds up for review
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_revise(p_checkpoint text) returns cloud.task_checkpoints
language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
begin
  update cloud.task_checkpoints set review_revision = review_revision + 1, updated_at = now()
  where id = p_checkpoint returning * into c;
  insert into cloud.checkpoint_revisions (checkpoint_id, revision, account_id, artifacts)
  values (c.id, c.review_revision, c.account_id, coalesce((
    select jsonb_agg(jsonb_build_object('artifact', a.id, 'version', a.latest_version) order by a.id)
    from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));
  perform cloud.v1_emit(c.account_id, 'checkpoint.updated', cloud.v1_checkpoint_json(c));
  return c;
end;
$$;

create or replace function api.v1_update_checkpoint(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  v_review jsonb;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  perform cloud.v1_task_open(c.task_id);
  if c.status = 'approved' then perform cloud.v1_refuse('This checkpoint is already approved.'); end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position < c.position and e.status <> 'approved'
  ) then
    perform cloud.v1_refuse('An earlier checkpoint is not approved yet.');
  end if;
  v_review := case when p_fields ? 'question' or p_fields ? 'options'
    then jsonb_strip_nulls(jsonb_build_object('question', p_fields -> 'question', 'options', p_fields -> 'options'))
    else c.review end;

  if v_review is distinct from c.review then
    update cloud.task_checkpoints set review = v_review where id = c.id;
    c := cloud.v1_revise(c.id);
  end if;
  if c.status <> 'ready' and exists (
    select 1 from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0
  ) then
    update cloud.task_checkpoints set status = 'ready', updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(p_account, 'checkpoint.ready', cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_checkpoint_json(c);
end;
$$;

create or replace function api.v1_create_decision(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_actor jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  d cloud.decisions;
  v_artifact text := p_fields ->> 'artifact';
  v_version integer := (p_fields ->> 'artifact_version')::integer;
  v_revision integer := (p_fields ->> 'review_revision')::integer;
  v_status text;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account for update;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  perform cloud.v1_task_open(c.task_id);
  if c.status = 'pending' then
    perform cloud.v1_refuse('Nothing has been submitted to this checkpoint yet.');
  end if;
  if exists (
    select 1 from cloud.task_checkpoints e
    where e.task_id = c.task_id and e.position > c.position and e.status <> 'pending'
  ) then
    perform cloud.v1_refuse('A later checkpoint has already moved on.');
  end if;
  if v_revision is null and exists (select 1 from cloud.task_cards k where k.task_id = c.task_id) then
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
  if not exists (
    select 1 from cloud.artifact_versions v join cloud.artifacts a on a.id = v.artifact_id
    where v.artifact_id = v_artifact and v.version = v_version and a.checkpoint_id = c.id
  ) then
    perform cloud.v1_missing('artifact version on this checkpoint');
  end if;

  insert into cloud.decisions (id, account_id, checkpoint_id, artifact_id, artifact_version, decision, comment,
                               decided_by, review_revision)
  values (cloud.v1_id('dec'), p_account, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision)
  returning * into d;
  perform cloud.v1_emit(p_account, 'decision.created', cloud.v1_decision_json(d));

  v_status := case d.decision when 'approve' then 'approved' else 'changes_requested' end;
  if c.status <> v_status then
    update cloud.task_checkpoints set status = v_status, updated_at = now() where id = c.id returning * into c;
    perform cloud.v1_emit(p_account, 'checkpoint.' || v_status, cloud.v1_checkpoint_json(c));
  end if;
  return cloud.v1_decision_json(d);
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared review: the task's current card
-- ---------------------------------------------------------------------------

create or replace function api.v1_shared(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  k cloud.task_cards;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;
  select * into k from cloud.task_cards where task_id = c.task_id;

  v_out := jsonb_build_object(
    'object', 'shared_review',
    'role', v_role,
    'me', case when p_subject is null then null else jsonb_build_object('email', lower(p_email),
            'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end,
    'link', jsonb_build_object('id', l.id, 'access', l.access, 'expires_at', cloud.v1_ts(l.expires_at))
            || case when v_role = 'editor' then jsonb_build_object('emails', to_jsonb(l.emails)) else '{}' end,
    'owner', (select jsonb_build_object('handle', a.handle, 'name', a.name, 'avatar_url', a.avatar_url)
              from cloud.accounts a where a.id = l.account_id),
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'workflow', t.workflow ->> 'name',
              'project', (select p.name from cloud.projects p where p.id = t.project_id)),
    'checkpoint', case when v_role = 'viewer' then cloud.v1_checkpoint_json(c) - 'status' else cloud.v1_checkpoint_json(c) end,
    'card', case when k.task_id is null then null else jsonb_build_object('version', t.card_version, 'body', k.body,
              'metadata', k.metadata, 'assets', k.assets) end,
    'artifacts', coalesce((
      select jsonb_agg(cloud.v1_artifact_json(a) || jsonb_build_object('versions', coalesce((
        select jsonb_agg(cloud.v1_version_json(av) #- '{file,url}' order by av.version)
        from cloud.artifact_versions av
        where av.artifact_id = a.id and (av.version = a.latest_version or av.version in (
          select (e.value ->> 'version')::integer from jsonb_each(coalesce(k.assets, '{}')) e
          where e.value ->> 'artifact' = a.id))), '[]')) order by a.id)
      from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));

  if v_role = 'viewer' then return v_out; end if;
  return v_out || jsonb_build_object(
    'decisions', coalesce((select jsonb_agg(cloud.v1_decision_json(d) order by d.id)
                           from cloud.decisions d where d.checkpoint_id = c.id), '[]'),
    'comments', coalesce((select jsonb_agg(cloud.v1_comment_json(m) order by m.id)
                          from cloud.checkpoint_comments m where m.checkpoint_id = c.id), '[]'),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision', r.revision, 'created_at', cloud.v1_ts(r.created_at))
                                            order by r.revision)
                           from cloud.checkpoint_revisions r where r.checkpoint_id = c.id), '[]'));
end;
$$;

create or replace function api.v1_shared_decide(
  p_hash text, p_subject uuid, p_email text, p_picked integer, p_text text, p_revision integer,
  p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
  c cloud.task_checkpoints;
  v_option jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_fields jsonb;
begin
  select * into c from cloud.task_checkpoints where id = v ->> 'checkpoint';
  if not exists (select 1 from cloud.task_cards k where k.task_id = c.task_id) then
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
  return jsonb_build_object('account', v -> 'account', 'result',
    api.v1_create_decision((v ->> 'account')::uuid, c.id, v_fields || jsonb_build_object('review_revision', p_revision),
                           v -> 'author', p_daily_write_budget));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function cloud.v1_card_json(cloud.task_cards, integer) from public;
revoke all on function api.v1_save_card(uuid, text, jsonb, integer, integer) from public;
revoke all on function api.v1_card(uuid, text) from public;
grant execute on function api.v1_save_card(uuid, text, jsonb, integer, integer) to service_role;
grant execute on function api.v1_card(uuid, text) to service_role;
