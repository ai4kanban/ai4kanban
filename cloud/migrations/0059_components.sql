-- Artifact components (#2006): a developer's own preview for an artifact type, published to
-- their account and drawn by the review page in an isolated frame.
--
-- - **An account's own**: a component, and the `@<handle>/<name>` types it draws, are the
--   publishing account's. It draws an artifact only on a task that account started.
-- - **A version never changes**: published once, its bundle uploaded once, then only removed.
--   A removed version keeps its row, so its number is never reused.
-- - **Pinned as submitted**: an artifact version records the component version that was
--   newest when it was written; publishing later does not change what is under review.
-- - **Served from its own host**: `hash` is the version's subdomain of
--   wildcraneusercontent.com, and its bundle's files sit in R2 under `components/<hash>/`.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table cloud.components (
  id text primary key,
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name)
);
alter table cloud.components enable row level security;

-- `manifest` is `{ title: { en, zh }, types, schema? }`, checked by the Worker.
create table cloud.component_versions (
  component_id text not null references cloud.components (id) on delete cascade,
  version text not null check (version ~ '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$' and length(version) <= 64),
  account_id uuid not null references cloud.accounts (id) on delete cascade,
  hash text not null unique check (hash ~ '^[a-f0-9]{32}$'),
  manifest jsonb not null,
  size bigint,
  uploaded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (component_id, version)
);
create index component_versions_account on cloud.component_versions (account_id);
alter table cloud.component_versions enable row level security;

-- A component's type is `@<handle>/<name>`; the built-in ones stay bare.
alter table cloud.artifacts drop constraint artifacts_type_check;
alter table cloud.artifacts add constraint artifacts_type_check
  check (type ~ '^(@[a-z0-9][a-z0-9-]*/)?[a-z0-9]+(-[a-z0-9]+)*$' and length(type) <= 128);

-- The component version's `hash`. No foreign key: a version row is never deleted on its own.
alter table cloud.artifact_versions add column component_version text;

-- ---------------------------------------------------------------------------
-- Pinning
-- ---------------------------------------------------------------------------

create function cloud.v1_pin_component() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select v.hash into new.component_version
  from cloud.artifacts a
  join cloud.components c on c.account_id = a.account_id
  join cloud.component_versions v on v.component_id = c.id
  where a.id = new.artifact_id and a.type like '@%' and v.manifest -> 'types' ? a.type
    and v.uploaded_at is not null and v.deleted_at is null
  order by v.uploaded_at desc limit 1;
  return new;
end;
$$;
create trigger artifact_versions_pin_component before insert on cloud.artifact_versions
  for each row execute function cloud.v1_pin_component();

-- ---------------------------------------------------------------------------
-- What each reads as
-- ---------------------------------------------------------------------------

create function cloud.v1_component_version_json(v cloud.component_versions) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('object', 'component_version',
    'name', (select c.name from cloud.components c where c.id = v.component_id), 'version', v.version,
    'title', v.manifest -> 'title', 'types', v.manifest -> 'types', 'schema', v.manifest -> 'schema',
    'size', v.size, 'uploaded', v.uploaded_at is not null, 'deleted', v.deleted_at is not null,
    'created_at', cloud.v1_ts(v.created_at));
$$;

create function cloud.v1_component_json(c cloud.components) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'object', 'component', 'name', c.name,
    'versions', coalesce((select jsonb_agg(cloud.v1_component_version_json(v) order by v.created_at)
                          from cloud.component_versions v where v.component_id = c.id), '[]'),
    'created_at', cloud.v1_ts(c.created_at), 'updated_at', cloud.v1_ts(c.updated_at));
$$;

create or replace function cloud.v1_version_json(v cloud.artifact_versions) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('object', 'artifact_version', 'artifact', v.artifact_id, 'version', v.version,
    'content', v.content,
    'file', case when v.file is null then null else jsonb_build_object(
      'size', v.file -> 'size', 'content_type', v.file -> 'content_type',
      'url', '/v1/artifacts/' || v.artifact_id || '/versions/' || v.version || '/file') end,
    'component', (select jsonb_build_object('name', c.name, 'version', cv.version)
                  from cloud.component_versions cv join cloud.components c on c.id = cv.component_id
                  where cv.hash = v.component_version),
    'created_at', cloud.v1_ts(v.created_at));
$$;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------

-- The account's version by name: "not found" for anyone else's.
create function cloud.v1_component_version(p_account uuid, p_name text, p_version text)
returns cloud.component_versions language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.component_versions;
begin
  select cv.* into v from cloud.component_versions cv join cloud.components c on c.id = cv.component_id
  where c.account_id = p_account and c.name = p_name and cv.version = p_version;
  if not found then perform cloud.v1_missing('component version'); end if;
  return v;
end;
$$;

-- A version not yet uploaded is answered again, so a failed upload can be retried.
create function api.v1_create_component(
  p_account uuid, p_name text, p_version text, p_manifest jsonb, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c cloud.components;
  v cloud.component_versions;
  v_prefix text := '@' || (select lower(a.handle) from cloud.accounts a where a.id = p_account) || '/';
  v_type text;
begin
  perform cloud.v1_write(p_account, cloud.v1_personal(p_account), p_daily_write_budget);
  for v_type in select jsonb_array_elements_text(p_manifest -> 'types') loop
    if not starts_with(v_type, v_prefix) then
      perform cloud.v1_refuse(format('Type %s must start with %s.', v_type, v_prefix));
    end if;
    if exists (
      select 1 from cloud.component_versions x join cloud.components y on y.id = x.component_id
      where y.account_id = p_account and y.name <> p_name and x.deleted_at is null and x.manifest -> 'types' ? v_type
    ) then
      perform cloud.v1_refuse(format('Another of your components already draws %s.', v_type));
    end if;
  end loop;

  insert into cloud.components (id, account_id, name) values (cloud.v1_id('cmp'), p_account, p_name)
  on conflict (account_id, name) do update set updated_at = now()
  returning * into c;
  select * into v from cloud.component_versions where component_id = c.id and version = p_version for update;
  if found then
    if v.uploaded_at is not null or v.deleted_at is not null or v.manifest <> p_manifest then
      perform cloud.v1_refuse(format('Version %s of %s is already published.', p_version, p_name));
    end if;
  else
    insert into cloud.component_versions (component_id, version, account_id, hash, manifest)
    values (c.id, p_version, p_account, replace(gen_random_uuid()::text, '-', ''), p_manifest)
    returning * into v;
  end if;
  return jsonb_build_object('id', c.id) || cloud.v1_component_version_json(v);
end;
$$;

-- Where the Worker unpacks a bundle: `stored` is the Worker's alone.
create function api.v1_component_upload_target(p_account uuid, p_name text, p_version text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v cloud.component_versions := cloud.v1_component_version(p_account, p_name, p_version);
begin
  if v.uploaded_at is not null or v.deleted_at is not null then
    perform cloud.v1_refuse(format('Version %s of %s is already published.', p_version, p_name));
  end if;
  return jsonb_build_object('stored', v.hash);
end;
$$;

create function api.v1_finish_component(
  p_account uuid, p_name text, p_version text, p_size bigint, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v cloud.component_versions;
begin
  perform cloud.v1_write(p_account, cloud.v1_personal(p_account), p_daily_write_budget);
  v := cloud.v1_component_version(p_account, p_name, p_version);
  update cloud.component_versions set size = p_size, uploaded_at = clock_timestamp()
  where component_id = v.component_id and version = v.version and uploaded_at is null and deleted_at is null
  returning * into v;
  if not found then perform cloud.v1_refuse(format('Version %s of %s is already published.', p_version, p_name)); end if;
  return cloud.v1_component_version_json(v);
end;
$$;

create function api.v1_list_components(p_account uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('data', coalesce(jsonb_agg(cloud.v1_component_json(c) order by c.name), '[]'), 'next', null)
  from cloud.components c where c.account_id = p_account;
$$;

create function api.v1_component(p_account uuid, p_name text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c cloud.components;
begin
  select * into c from cloud.components where account_id = p_account and name = p_name;
  if not found then perform cloud.v1_missing('component'); end if;
  return cloud.v1_component_json(c);
end;
$$;

-- Removed for good: its files leave R2 (the Worker, with `stored`), its number stays taken.
create function api.v1_delete_component_version(
  p_account uuid, p_name text, p_version text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v cloud.component_versions;
begin
  perform cloud.v1_write(p_account, cloud.v1_personal(p_account), p_daily_write_budget);
  v := cloud.v1_component_version(p_account, p_name, p_version);
  update cloud.component_versions set deleted_at = coalesce(deleted_at, now())
  where component_id = v.component_id and version = v.version
  returning * into v;
  return cloud.v1_component_version_json(v) || jsonb_build_object('stored', v.hash);
end;
$$;

-- A component version an artifact of the link's checkpoint is pinned to, and nothing else.
create function api.v1_shared_component(p_hash text, p_subject uuid, p_email text, p_name text, p_version text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s jsonb := cloud.v1_share_access(p_hash, p_subject, p_email);
  v cloud.component_versions;
begin
  select cv.* into v
  from cloud.component_versions cv join cloud.components c on c.id = cv.component_id
  where c.name = p_name and cv.version = p_version and exists (
    select 1 from cloud.artifact_versions av join cloud.artifacts a on a.id = av.artifact_id
    where a.checkpoint_id = s ->> 'checkpoint' and av.component_version = cv.hash);
  if not found then perform cloud.v1_missing('component on this checkpoint'); end if;
  if v.deleted_at is not null then
    raise exception 'This component has been removed.' using errcode = 'AKB20';
  end if;
  return cloud.v1_component_version_json(v) || jsonb_build_object('stored', v.hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function cloud.v1_pin_component() from public;
revoke all on function cloud.v1_component_version_json(cloud.component_versions) from public;
revoke all on function cloud.v1_component_json(cloud.components) from public;
revoke all on function cloud.v1_component_version(uuid, text, text) from public;
do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api' and p.proname in ('v1_create_component', 'v1_component_upload_target', 'v1_finish_component',
      'v1_list_components', 'v1_component', 'v1_delete_component_version', 'v1_shared_component')
  loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$grants$;

-- ---------------------------------------------------------------------------
-- Saving from a component
-- ---------------------------------------------------------------------------

-- An owner's edit in a component: the next version, and every card asset pinned to this
-- artifact moved onto it, so the next job reads what was saved. One transaction.
create function api.v1_save_artifact_version(p_account uuid, p_artifact text, p_content jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  k cloud.task_cards;
  v jsonb;
begin
  perform cloud.v1_require_owner(p_account, cloud.v1_workspace_of(p_account, 'artifact', p_artifact));
  v := api.v1_create_artifact_version(p_account, p_artifact, p_content, null, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact;
  select * into k from cloud.task_cards where task_id = a.task_id for update;
  if found and exists (select 1 from jsonb_each(k.assets) e where e.value ->> 'artifact' = a.id and e.value ? 'version') then
    perform cloud.v1_write_card(a.task_id, jsonb_build_object('body', k.body, 'metadata', k.metadata, 'assets', (
      select jsonb_object_agg(e.key, case when e.value ->> 'artifact' = a.id and e.value ? 'version'
                                         then e.value || jsonb_build_object('version', v -> 'version') else e.value end)
      from jsonb_each(k.assets) e)));
  end if;
  return v;
end;
$$;
revoke all on function api.v1_save_artifact_version(uuid, text, jsonb, integer) from public;
grant execute on function api.v1_save_artifact_version(uuid, text, jsonb, integer) to service_role;
