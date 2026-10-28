-- Checkpoint review over share links (#2019): a task's full card, what a checkpoint holds up
-- for review, comments, and the links a reviewer opens without an account.
--
-- - **A card version never changes**: a task's card is saved whole, against the version it was
--   written on, so one writer never overwrites another.
-- - **What is under review has a revision**: binding a card version or a new version of one of
--   the checkpoint's artifacts moves `review_revision` on and logs what it now holds; a decision
--   on a checkpoint holding a card names the revision it was made on.
-- - **A link is only its token's hash**: every shared read and write resolves the hash here,
--   checks the link is live and who may use it, and reaches nothing outside its checkpoint.
-- - **Comments are for people**: an API key's feed leaves `comment.created` out.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB24  a share link that cannot be used: `detail` is `invalid`, `expired` or `revoked`.
-- AKB25  a link used without the right to: `detail` is `sign_in_required`, `not_invited` or
--        `view_only`.
-- AKB26  a decision on what is no longer under review (`review_outdated`), or on a checkpoint
--        holding no card (`card_missing`): `detail` says which.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table cloud.tasks add column card_version integer not null default 0;

create table cloud.card_versions (
  task_id text not null references cloud.tasks (id) on delete cascade,
  version integer not null check (version > 0),
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  body text not null check (octet_length(body) <= 262144),
  metadata jsonb not null default '{}',
  -- A path the body names → `{ artifact, version? }` on the same task.
  assets jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (task_id, version)
);
alter table cloud.card_versions enable row level security;
create trigger card_versions_immutable before update on cloud.card_versions
  for each row execute function cloud.v1_immutable();

-- `review` is `{ question?, options? }`, the choice put to the reviewer.
alter table cloud.task_checkpoints
  add column card_version integer,
  add column review jsonb,
  add column review_revision integer not null default 0;

create table cloud.checkpoint_revisions (
  checkpoint_id text not null references cloud.task_checkpoints (id) on delete cascade,
  revision integer not null,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  card_version integer,
  artifacts jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (checkpoint_id, revision)
);
alter table cloud.checkpoint_revisions enable row level security;

alter table cloud.decisions add column review_revision integer, add column card_version integer;

create table cloud.share_links (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  checkpoint_id text not null references cloud.task_checkpoints (id) on delete cascade,
  token_hash text not null unique,
  access text not null default 'invited' check (access in ('invited', 'link')),
  emails text[] not null default '{}',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index share_links_checkpoint on cloud.share_links (checkpoint_id, id);
alter table cloud.share_links enable row level security;

create table cloud.checkpoint_comments (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  task_id text not null references cloud.tasks (id) on delete cascade,
  checkpoint_id text not null references cloud.task_checkpoints (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and octet_length(body) <= 16384),
  author jsonb not null,
  created_at timestamptz not null default now()
);
create index checkpoint_comments_checkpoint on cloud.checkpoint_comments (checkpoint_id, id);
alter table cloud.checkpoint_comments enable row level security;

-- ---------------------------------------------------------------------------
-- What each resource reads as
-- ---------------------------------------------------------------------------

create or replace function cloud.v1_task_json(t cloud.tasks) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'object', 'task', 'project', t.project_id, 'workflow', t.workflow,
    'title', t.title, 'request', t.request, 'source', t.source, 'source_context', t.source_context,
    'status', t.status, 'card_version', nullif(t.card_version, 0),
    'created_at', cloud.v1_ts(t.created_at), 'updated_at', cloud.v1_ts(t.updated_at));
$$;

create or replace function cloud.v1_checkpoint_json(c cloud.task_checkpoints) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'object', 'checkpoint', 'task', c.task_id, 'position', c.position,
    'key', c.key, 'title', c.title, 'artifact_type', c.definition -> 'artifact_type',
    'question', coalesce(c.review ->> 'question', c.definition ->> 'question', ''),
    'options', c.review -> 'options',
    'acceptance', coalesce(c.definition ->> 'acceptance', ''),
    'card_version', c.card_version, 'review_revision', c.review_revision,
    'status', c.status, 'created_at', cloud.v1_ts(c.created_at), 'updated_at', cloud.v1_ts(c.updated_at));
$$;

create or replace function cloud.v1_decision_json(d cloud.decisions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'object', 'decision', 'checkpoint', d.checkpoint_id,
    'artifact', d.artifact_id, 'artifact_version', d.artifact_version, 'decision', d.decision,
    'comment', d.comment, 'decided_by', d.decided_by, 'review_revision', d.review_revision,
    'card_version', d.card_version, 'created_at', cloud.v1_ts(d.created_at));
$$;

create function cloud.v1_card_version_json(v cloud.card_versions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'card_version', 'task', v.task_id, 'version', v.version, 'body', v.body,
    'metadata', v.metadata, 'assets', v.assets, 'created_at', cloud.v1_ts(v.created_at));
$$;

create function cloud.v1_share_link_json(l cloud.share_links) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'object', 'share_link', 'checkpoint', l.checkpoint_id, 'access', l.access,
    'emails', to_jsonb(l.emails), 'expires_at', cloud.v1_ts(l.expires_at), 'revoked', l.revoked_at is not null,
    'active', l.revoked_at is null and l.expires_at > now(), 'created_at', cloud.v1_ts(l.created_at));
$$;

create function cloud.v1_comment_json(m cloud.checkpoint_comments) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'object', 'comment', 'task', m.task_id, 'checkpoint', m.checkpoint_id,
    'body', m.body, 'author', m.author, 'created_at', cloud.v1_ts(m.created_at));
$$;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

create function api.v1_create_card_version(
  p_account uuid, p_task text, p_fields jsonb, p_base integer, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v cloud.card_versions;
  v_bad text;
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
  insert into cloud.card_versions (task_id, version, account_id, body, metadata, assets)
  values (p_task, t.card_version + 1, p_account, p_fields ->> 'body', coalesce(p_fields -> 'metadata', '{}'),
          coalesce(p_fields -> 'assets', '{}'))
  returning * into v;
  update cloud.tasks set card_version = v.version, updated_at = now() where id = p_task;
  perform cloud.v1_emit(p_account, 'card_version.created', cloud.v1_card_version_json(v) - 'body');
  return cloud.v1_card_version_json(v);
end;
$$;

create function api.v1_card_version(p_account uuid, p_task text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.card_versions;
begin
  select * into v from cloud.card_versions where task_id = p_task and version = p_version and account_id = p_account;
  if not found then perform cloud.v1_missing('card version'); end if;
  return cloud.v1_card_version_json(v);
end;
$$;

-- ---------------------------------------------------------------------------
-- What a checkpoint holds up for review
-- ---------------------------------------------------------------------------

-- The next revision, logged with what it holds, and told.
create function cloud.v1_revise(p_checkpoint text) returns cloud.task_checkpoints
language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
begin
  update cloud.task_checkpoints set review_revision = review_revision + 1, updated_at = now()
  where id = p_checkpoint returning * into c;
  insert into cloud.checkpoint_revisions (checkpoint_id, revision, account_id, card_version, artifacts)
  values (c.id, c.review_revision, c.account_id, c.card_version, coalesce((
    select jsonb_agg(jsonb_build_object('artifact', a.id, 'version', a.latest_version) order by a.id)
    from cloud.artifacts a where a.checkpoint_id = c.id and a.latest_version > 0), '[]'));
  perform cloud.v1_emit(c.account_id, 'checkpoint.updated', cloud.v1_checkpoint_json(c));
  return c;
end;
$$;

create function cloud.artifact_revises() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.checkpoint_id is not null and new.latest_version > old.latest_version then
    perform cloud.v1_revise(new.checkpoint_id);
  end if;
  return null;
end;
$$;
create trigger artifact_revises after update of latest_version on cloud.artifacts
  for each row execute function cloud.artifact_revises();

create function api.v1_update_checkpoint(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  v_version integer := (p_fields ->> 'card_version')::integer;
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
  if not exists (select 1 from cloud.card_versions where task_id = c.task_id and version = v_version) then
    raise exception 'No card version % on this task.', v_version using errcode = 'AKB20';
  end if;
  v_review := case when p_fields ? 'question' or p_fields ? 'options'
    then jsonb_strip_nulls(jsonb_build_object('question', p_fields -> 'question', 'options', p_fields -> 'options'))
    else c.review end;

  if v_version is distinct from c.card_version or v_review is distinct from c.review then
    update cloud.task_checkpoints set card_version = v_version, review = v_review where id = c.id;
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

-- 0047's, now holding a decision to the revision it was made on.
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
  if c.card_version is not null and v_revision is null then
    perform cloud.v1_refuse('This checkpoint holds a card: name the review_revision you reviewed.');
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
                               decided_by, review_revision, card_version)
  values (cloud.v1_id('dec'), p_account, c.id, v_artifact, v_version, p_fields ->> 'decision',
          coalesce(p_fields ->> 'comment', ''), p_actor, c.review_revision, c.card_version)
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
-- Comments
-- ---------------------------------------------------------------------------

create function api.v1_create_comment(
  p_account uuid, p_checkpoint text, p_body text, p_author jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.task_checkpoints;
  m cloud.checkpoint_comments;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into c from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account;
  if not found then perform cloud.v1_missing('checkpoint'); end if;
  insert into cloud.checkpoint_comments (id, account_id, task_id, checkpoint_id, body, author)
  values (cloud.v1_id('cmt'), p_account, c.task_id, c.id, p_body, p_author)
  returning * into m;
  perform cloud.v1_emit(p_account, 'comment.created', cloud.v1_comment_json(m));
  return cloud.v1_comment_json(m);
end;
$$;

create function api.v1_list_comments(p_account uuid, p_checkpoint text, p_after text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account) then
    perform cloud.v1_missing('checkpoint');
  end if;
  return (
    select jsonb_build_object(
      'data', coalesce(jsonb_agg(x.j order by x.id) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
      'next', case when count(*) > cloud.v1_limit(p_limit) then max(x.id) filter (where x.n <= cloud.v1_limit(p_limit)) end)
    from (
      select m.id, cloud.v1_comment_json(m) j, row_number() over (order by m.id) n
      from cloud.checkpoint_comments m
      where m.checkpoint_id = p_checkpoint and (p_after is null or m.id > p_after)
      order by m.id limit cloud.v1_limit(p_limit) + 1
    ) x);
end;
$$;

-- `p_hidden`: event types this reader is not shown.
drop function api.v1_list_events(uuid, bigint, integer);

create function api.v1_list_events(p_account uuid, p_after bigint, p_limit integer, p_hidden text[] default '{}')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', coalesce(jsonb_agg(x.j order by x.seq) filter (where x.n <= cloud.v1_limit(p_limit)), '[]'),
    'next', case when count(*) > cloud.v1_limit(p_limit)
      then 'evt_' || max(x.seq) filter (where x.n <= cloud.v1_limit(p_limit)) end)
  from (
    select e.seq, cloud.v1_event_json(e) j, row_number() over (order by e.seq) n
    from cloud.api_events e
    where e.account_id = p_account and e.seq > coalesce(p_after, 0) and not (e.type = any(coalesce(p_hidden, '{}')))
    order by e.seq limit cloud.v1_limit(p_limit) + 1
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- Share links, as the account manages them
-- ---------------------------------------------------------------------------

create function cloud.v1_emails(p_list jsonb) returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct lower(btrim(e)) order by lower(btrim(e))), '{}')
  from jsonb_array_elements_text(coalesce(p_list, '[]')) e where btrim(e) <> '';
$$;

create function api.v1_create_share_link(
  p_account uuid, p_checkpoint text, p_fields jsonb, p_hash text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if not exists (select 1 from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account) then
    perform cloud.v1_missing('checkpoint');
  end if;
  insert into cloud.share_links (id, account_id, checkpoint_id, token_hash, access, emails, expires_at)
  values (cloud.v1_id('shr'), p_account, p_checkpoint, p_hash, coalesce(p_fields ->> 'access', 'invited'),
          cloud.v1_emails(p_fields -> 'emails'),
          now() + make_interval(days => coalesce((p_fields ->> 'expires_in_days')::integer, 7)))
  returning * into l;
  if l.access = 'invited' and cardinality(l.emails) = 0 then
    perform cloud.v1_refuse('An invited link needs at least one email.');
  end if;
  perform cloud.v1_emit(p_account, 'share_link.created', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create function api.v1_update_share_link(p_account uuid, p_id text, p_fields jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into l from cloud.share_links where id = p_id and account_id = p_account for update;
  if not found then perform cloud.v1_missing('share link'); end if;
  if l.revoked_at is not null then perform cloud.v1_refuse('This link has been revoked.'); end if;
  if l.expires_at <= now() then perform cloud.v1_refuse('This link has expired.'); end if;
  update cloud.share_links set
    access = coalesce(p_fields ->> 'access', access),
    emails = case when p_fields ? 'emails' then cloud.v1_emails(p_fields -> 'emails') else emails end,
    updated_at = now()
  where id = p_id returning * into l;
  if l.access = 'invited' and cardinality(l.emails) = 0 then
    perform cloud.v1_refuse('An invited link needs at least one email.');
  end if;
  perform cloud.v1_emit(p_account, 'share_link.updated', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

create function api.v1_list_share_links(p_account uuid, p_checkpoint text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from cloud.task_checkpoints where id = p_checkpoint and account_id = p_account) then
    perform cloud.v1_missing('checkpoint');
  end if;
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(cloud.v1_share_link_json(l) order by l.id)
    from cloud.share_links l where l.checkpoint_id = p_checkpoint), '[]'), 'next', null);
end;
$$;

create function api.v1_revoke_share_link(p_account uuid, p_id text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l cloud.share_links;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.share_links set revoked_at = coalesce(revoked_at, now()), updated_at = now()
  where id = p_id and account_id = p_account returning * into l;
  if not found then perform cloud.v1_missing('share link'); end if;
  perform cloud.v1_emit(p_account, 'share_link.revoked', cloud.v1_share_link_json(l));
  return cloud.v1_share_link_json(l);
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared review: what one link reaches
-- ---------------------------------------------------------------------------

-- The live link a token's hash names, and who the caller is to it: `editor` for the account
-- itself, `reviewer` for an invited email, `viewer` on a `link` link. Raises otherwise.
create function cloud.v1_share_access(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l cloud.share_links;
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
  if p_subject is not null and p_subject = l.account_id then
    v_role := 'editor';
  elsif l.access = 'link' then
    v_role := 'viewer';
  elsif p_subject is null then
    raise exception 'Sign in to open this review.' using errcode = 'AKB25', detail = 'sign_in_required';
  elsif p_email is null or not (lower(p_email) = any(l.emails)) then
    raise exception 'This email is not invited to this review.' using errcode = 'AKB25', detail = 'not_invited';
  else
    v_role := 'reviewer';
  end if;
  return jsonb_build_object('link', l.id, 'account', l.account_id, 'checkpoint', l.checkpoint_id, 'role', v_role);
end;
$$;

-- Who a comment or decision through a link names.
create function cloud.v1_reviewer(p_role text, p_subject uuid, p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_role = 'editor'
    then jsonb_build_object('kind', 'user', 'handle', (select a.handle from cloud.accounts a where a.id = p_subject))
    else jsonb_build_object('kind', 'reviewer', 'email', lower(p_email),
           'handle', (select a.handle from cloud.attested(p_subject) a limit 1)) end;
$$;

create function cloud.v1_share_writer(p_hash text, p_subject uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
begin
  if v ->> 'role' = 'viewer' then
    raise exception 'This link is view only.' using errcode = 'AKB25', detail = 'view_only';
  end if;
  return v || jsonb_build_object('author', cloud.v1_reviewer(v ->> 'role', p_subject, p_email));
end;
$$;

-- A viewer gets the card and the previews; an editor or reviewer also the history.
create function api.v1_shared(p_hash text, p_subject uuid, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_role text := v ->> 'role';
  l cloud.share_links;
  c cloud.task_checkpoints;
  t cloud.tasks;
  k cloud.card_versions;
  v_out jsonb;
begin
  select * into l from cloud.share_links where id = v ->> 'link';
  select * into c from cloud.task_checkpoints where id = l.checkpoint_id;
  select * into t from cloud.tasks where id = c.task_id;
  select * into k from cloud.card_versions where task_id = c.task_id and version = c.card_version;

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
    'card', case when k.task_id is null then null else jsonb_build_object('version', k.version, 'body', k.body,
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

-- Where a file of the link's own checkpoint sits in R2.
create function api.v1_shared_file(p_hash text, p_subject uuid, p_email text, p_artifact text, p_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v_file jsonb;
begin
  select av.file into v_file
  from cloud.artifact_versions av join cloud.artifacts a on a.id = av.artifact_id
  where av.artifact_id = p_artifact and av.version = p_version and a.checkpoint_id = v ->> 'checkpoint';
  if not found then perform cloud.v1_missing('artifact version on this checkpoint'); end if;
  return jsonb_build_object('stored', v_file);
end;
$$;

-- The writes answer `{ account, result }`, so the Worker can tell the account's streams.
create function api.v1_shared_comment(p_hash text, p_subject uuid, p_email text, p_body text, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := cloud.v1_share_writer(p_hash, p_subject, p_email);
begin
  return jsonb_build_object('account', v -> 'account', 'result',
    api.v1_create_comment((v ->> 'account')::uuid, v ->> 'checkpoint', p_body, v -> 'author', p_daily_write_budget));
end;
$$;

-- `p_picked` is an option's index; none is "other", which needs `p_text`.
create function api.v1_shared_decide(
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
  if c.card_version is null then
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

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname in ('api', 'cloud') and p.proname like 'v1\_%')
       or (n.nspname = 'cloud' and p.proname = 'artifact_revises')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
