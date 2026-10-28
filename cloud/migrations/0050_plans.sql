-- Free and Pro quotas, Pro storage packs and the Studio waitlist (#2017).
--
-- - **The plan is the Worker's call**: who is Pro stays in src/billing.ts; each quota-guarded
--   write takes the limit it was given. A null limit is no limit, so older callers still work.
-- - **Tasks at once are the account's**: open tasks are counted under `cloud.v1_write`'s lock,
--   whichever Runner or surface started them.
-- - **Storage is every byte in R2**: version files, uploads not yet used, and the size a
--   multipart upload declared, so a large upload holds its room from the start.
-- - **Expiry deletes a finished task with everything under it**: checkpoints, artifacts,
--   versions, decisions, alerts and the events naming them, plus the account's finished
--   Runner jobs. The Worker deletes the R2 files first, then the rows.

-- ---------------------------------------------------------------------------
-- Refusals this migration raises
-- ---------------------------------------------------------------------------
-- AKB23  a quota is used up. `detail` names it (`tasks`, `storage`, `file_size`) and `hint`
--        carries the limit.

create function cloud.v1_over_quota(p_quota text, p_limit bigint) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'The % quota is used up.', p_quota using errcode = 'AKB23', detail = p_quota, hint = p_limit::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Subscriptions: Pro, or a storage pack
-- ---------------------------------------------------------------------------

alter table cloud.subscriptions add column item text not null default 'pro' check (item in ('pro', 'storage'));

drop function api.record_subscription(text, uuid, text, text, text, timestamptz, integer);

create function api.record_subscription(
  p_id text,
  p_user_id uuid,
  p_customer_id text,
  p_period text,
  p_status text,
  p_current_period_end timestamptz,
  p_daily_write_budget integer,
  p_item text default 'pro'
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row cloud.subscriptions;
  v_user uuid;
begin
  select * into v_row from cloud.subscriptions s where s.id = p_id for update;
  v_user := coalesce(p_user_id, v_row.user_id);
  if v_user is null then
    return null;
  end if;

  if v_row.id is null
     or v_row.user_id <> v_user
     or v_row.customer_id <> p_customer_id
     or v_row.period <> p_period
     or v_row.item <> p_item
     or v_row.status <> p_status
     or v_row.current_period_end is distinct from p_current_period_end then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.subscriptions as s
      (id, user_id, customer_id, period, item, status, current_period_end, updated_at)
    values (p_id, v_user, p_customer_id, p_period, p_item, p_status, p_current_period_end, now())
    on conflict (id) do update
      set user_id = excluded.user_id,
          customer_id = excluded.customer_id,
          period = excluded.period,
          item = excluded.item,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          updated_at = excluded.updated_at
    returning * into v_row;
  end if;

  return json_build_object('id', v_row.id, 'user_id', v_row.user_id);
end;
$$;

create or replace function api.subscriptions_for(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(q) order by q.updated_at desc), '[]'::json)
  from (
    select s.id, s.customer_id, s.period, s.item, s.status, s.updated_at,
           to_char(s.current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as current_period_end,
           to_char(s.refunded_through at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as refunded_through,
           to_char(s.revoked_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as revoked_at
    from cloud.subscriptions s
    where s.user_id = p_user_id
  ) q;
$$;

-- ---------------------------------------------------------------------------
-- The Studio waitlist: one row per address, signed in or not
-- ---------------------------------------------------------------------------

create table cloud.studio_waitlist (
  email text primary key check (email = lower(email) and length(email) between 3 and 320),
  user_id uuid,
  created_at timestamptz not null default now()
);
alter table cloud.studio_waitlist enable row level security;

create function api.join_studio_waitlist(p_email text, p_user_id uuid, p_daily_write_budget integer)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_row cloud.studio_waitlist;
  v_added integer;
begin
  insert into cloud.studio_waitlist (email, user_id) values (lower(p_email), p_user_id)
  on conflict (email) do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    perform cloud.count_write(p_daily_write_budget);
  end if;
  select * into v_row from cloud.studio_waitlist where email = lower(p_email);
  return json_build_object('email', v_row.email, 'joined_at', cloud.v1_ts(v_row.created_at), 'existing', v_added = 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------------

alter table cloud.artifact_uploads
  add column declared_size bigint check (declared_size > 0),
  add column multipart_id text,
  add column parts jsonb not null default '[]';

create index artifact_versions_files on cloud.artifact_versions (account_id) where file is not null;
create index artifact_uploads_account on cloud.artifact_uploads (account_id) where used_at is null;
create index tasks_open on cloud.tasks (account_id) where status in ('queued', 'running', 'waiting_review');

create function cloud.v1_open_tasks(p_account uuid) returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from cloud.tasks
  where account_id = p_account and status in ('queued', 'running', 'waiting_review');
$$;

-- Bytes the account holds in R2, leaving out one upload when asked.
create function cloud.v1_storage_used(p_account uuid, p_except text default null) returns bigint
language sql stable set search_path = '' as $$
  select coalesce((select sum((v.file ->> 'size')::bigint) from cloud.artifact_versions v
                    where v.account_id = p_account and v.file is not null), 0)
       + coalesce((select sum(coalesce(u.size, u.declared_size, 0)) from cloud.artifact_uploads u
                    where u.account_id = p_account and u.used_at is null
                      and u.id is distinct from p_except), 0);
$$;

create function api.v1_usage(p_account uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tasks', cloud.v1_open_tasks(p_account), 'storage', cloud.v1_storage_used(p_account));
$$;

-- ---------------------------------------------------------------------------
-- Quota-guarded writes
-- ---------------------------------------------------------------------------

drop function api.v1_create_task(uuid, jsonb, jsonb, integer);

create function api.v1_create_task(
  p_account uuid, p_fields jsonb, p_workflow jsonb, p_daily_write_budget integer, p_max_tasks integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t cloud.tasks;
  v_project text := p_fields ->> 'project';
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if p_max_tasks is not null and cloud.v1_open_tasks(p_account) >= p_max_tasks then
    perform cloud.v1_over_quota('tasks', p_max_tasks);
  end if;
  if v_project is not null and not exists (
    select 1 from cloud.projects where id = v_project and account_id = p_account
  ) then
    perform cloud.v1_missing('project');
  end if;
  insert into cloud.tasks (id, account_id, project_id, workflow, title, request, source, source_context)
  values (cloud.v1_id('task'), p_account, v_project, p_workflow, p_fields ->> 'title',
          coalesce(p_fields ->> 'request', ''), coalesce(p_fields ->> 'source', 'api'),
          coalesce(p_fields -> 'source_context', '{}'))
  returning * into t;
  insert into cloud.task_checkpoints (id, account_id, task_id, position, key, title, definition)
  select cloud.v1_id('cp'), p_account, t.id, c.n::integer, c.def ->> 'key', c.def ->> 'title', c.def
  from jsonb_array_elements(coalesce(p_workflow -> 'checkpoints', '[]')) with ordinality as c(def, n);
  perform cloud.v1_emit(p_account, 'task.created', cloud.v1_task_json(t));
  return cloud.v1_task_json(t);
end;
$$;

drop function api.v1_create_upload(uuid, text, text, integer);

-- A declared size above the part size is a multipart upload: the Worker opened it in R2 and
-- passes its id. It may take a day; a single PUT an hour.
create function api.v1_create_upload(
  p_account uuid, p_artifact text, p_content_type text, p_daily_write_budget integer,
  p_size bigint default null, p_multipart_id text default null, p_storage_limit bigint default null,
  p_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a cloud.artifacts;
  u cloud.artifact_uploads;
  v_id text := coalesce(p_id, cloud.v1_id('upl'));
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  select * into a from cloud.artifacts where id = p_artifact and account_id = p_account;
  if not found then perform cloud.v1_missing('artifact'); end if;
  perform cloud.v1_task_open(a.task_id);
  if p_storage_limit is not null and cloud.v1_storage_used(p_account) + coalesce(p_size, 1) > p_storage_limit then
    perform cloud.v1_over_quota('storage', p_storage_limit);
  end if;
  insert into cloud.artifact_uploads
    (id, account_id, artifact_id, object_key, content_type, declared_size, multipart_id, expires_at)
  values (v_id, p_account, a.id, cloud.v1_upload_key(p_account, a.id, v_id), p_content_type, p_size, p_multipart_id,
          now() + case when p_multipart_id is null then interval '1 hour' else interval '1 day' end)
  returning * into u;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'method', 'PUT',
    'url', '/v1/uploads/' || u.id, 'content_type', u.content_type, 'expires_at', cloud.v1_ts(u.expires_at));
end;
$$;

-- The Worker opens a multipart upload before the row exists, so it asks for the key first.
create function cloud.v1_upload_key(p_account uuid, p_artifact text, p_upload text) returns text
language sql immutable set search_path = '' as $$
  select 'artifacts/' || p_account || '/' || p_artifact || '/' || p_upload;
$$;

create function api.v1_new_upload_key(p_account uuid, p_artifact text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id text := cloud.v1_id('upl');
begin
  if not exists (select 1 from cloud.artifacts where id = p_artifact and account_id = p_account) then
    perform cloud.v1_missing('artifact');
  end if;
  return jsonb_build_object('id', v_id, 'key', cloud.v1_upload_key(p_account, p_artifact, v_id));
end;
$$;

drop function api.v1_upload_target(uuid, text);

-- Where an upload goes, while it can still be sent; null otherwise. `room` is the storage left
-- for it under the limit given.
create function api.v1_upload_target(p_account uuid, p_upload text, p_storage_limit bigint default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('key', u.object_key, 'content_type', u.content_type, 'size', u.declared_size,
           'multipart_id', u.multipart_id, 'parts', u.parts,
           'room', case when p_storage_limit is null then null
                        else p_storage_limit - cloud.v1_storage_used(p_account, u.id) end)
  from cloud.artifact_uploads u
  where u.id = p_upload and u.account_id = p_account and u.uploaded_at is null and u.expires_at > now();
$$;

create function api.v1_add_upload_part(
  p_account uuid, p_upload text, p_part integer, p_etag text, p_daily_write_budget integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u cloud.artifact_uploads;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  update cloud.artifact_uploads
     set parts = (select coalesce(jsonb_agg(p order by (p ->> 'part')::integer), '[]')
                    from (select p from jsonb_array_elements(parts) p where (p ->> 'part')::integer <> p_part
                          union all select jsonb_build_object('part', p_part, 'etag', p_etag)) x(p))
   where id = p_upload and account_id = p_account and multipart_id is not null
     and uploaded_at is null and expires_at > now()
  returning * into u;
  if not found then perform cloud.v1_missing('upload'); end if;
  return jsonb_build_object('id', u.id, 'object', 'upload_part', 'part', p_part);
end;
$$;

drop function api.v1_finish_upload(uuid, text, bigint, integer);

create function api.v1_finish_upload(
  p_account uuid, p_upload text, p_size bigint, p_daily_write_budget integer, p_storage_limit bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u cloud.artifact_uploads;
begin
  perform cloud.v1_write(p_account, p_daily_write_budget);
  if p_storage_limit is not null and cloud.v1_storage_used(p_account, p_upload) + p_size > p_storage_limit then
    perform cloud.v1_over_quota('storage', p_storage_limit);
  end if;
  update cloud.artifact_uploads set size = p_size, uploaded_at = now(), parts = '[]'
  where id = p_upload and account_id = p_account and uploaded_at is null and expires_at > now()
  returning * into u;
  if not found then perform cloud.v1_missing('upload'); end if;
  return jsonb_build_object('id', u.id, 'object', 'upload', 'artifact', u.artifact_id, 'size', u.size,
    'content_type', u.content_type, 'uploaded', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiry
-- ---------------------------------------------------------------------------

create index tasks_finished on cloud.tasks (updated_at) where status in ('done', 'failed', 'cancelled');
create index runner_jobs_finished on cloud.runner_jobs (finished_at) where state = 'finished';

-- Accounts holding something finished more than `p_days` ago — the shortest keep.
create function api.v1_expiring_accounts(p_days integer, p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.id), '[]') from (
    select t.account_id id from cloud.tasks t
     where t.status in ('done', 'failed', 'cancelled') and t.updated_at < now() - make_interval(days => p_days)
    union
    select j.owner_id from cloud.runner_jobs j
     where j.state = 'finished' and j.finished_at < now() - make_interval(days => p_days)
    limit p_limit
  ) x;
$$;

-- The account's tasks finished more than `p_days` ago, and the R2 objects under them.
create function api.v1_expired(p_account uuid, p_days integer, p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with t as (
    select id from cloud.tasks
     where account_id = p_account and status in ('done', 'failed', 'cancelled')
       and updated_at < now() - make_interval(days => p_days)
     order by updated_at limit p_limit
  ), a as (select id from cloud.artifacts where task_id in (select id from t))
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(id) from t), '[]'),
    'files', coalesce((select jsonb_agg(k) from (
        select v.file ->> 'key' k from cloud.artifact_versions v where v.artifact_id in (select id from a) and v.file is not null
        union
        select u.object_key from cloud.artifact_uploads u
         where u.artifact_id in (select id from a) and u.uploaded_at is not null and u.used_at is null) f), '[]'),
    'multipart', coalesce((select jsonb_agg(jsonb_build_object('key', u.object_key, 'id', u.multipart_id))
        from cloud.artifact_uploads u
       where u.artifact_id in (select id from a) and u.uploaded_at is null and u.multipart_id is not null), '[]'));
$$;

-- Delete what `v1_expired` named, once its files are gone. Exempt from the write budget,
-- like the rest of the hourly run.
create function api.v1_delete_expired(p_account uuid, p_days integer, p_tasks text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tasks text[];
  v_named text[];
  v_events integer;
  v_deleted integer;
  v_jobs integer;
begin
  select coalesce(array_agg(id), '{}') into v_tasks from cloud.tasks
   where account_id = p_account and id = any(p_tasks) and status in ('done', 'failed', 'cancelled')
     and updated_at < now() - make_interval(days => p_days);
  select v_tasks
         || coalesce((select array_agg(id) from cloud.task_checkpoints where task_id = any(v_tasks)), '{}')
         || coalesce((select array_agg(id) from cloud.artifacts where task_id = any(v_tasks)), '{}')
    into v_named;
  delete from cloud.api_events
   where account_id = p_account
     and (data ->> 'id' = any(v_named) or data ->> 'task' = any(v_named)
          or data ->> 'artifact' = any(v_named) or data ->> 'checkpoint' = any(v_named));
  get diagnostics v_events = row_count;
  delete from cloud.tasks where id = any(v_tasks);
  get diagnostics v_deleted = row_count;
  delete from cloud.runner_jobs
   where owner_id = p_account and state = 'finished' and finished_at < now() - make_interval(days => p_days);
  get diagnostics v_jobs = row_count;
  return jsonb_build_object('tasks', v_deleted, 'events', v_events, 'jobs', v_jobs);
end;
$$;

-- Uploads left unused a day past their expiry, for the Worker to clear out of R2.
create function api.v1_abandoned_uploads(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'key', u.object_key, 'multipart_id', u.multipart_id,
           'uploaded', u.uploaded_at is not null)), '[]')
  from (select * from cloud.artifact_uploads
         where used_at is null and expires_at < now() - interval '1 day' limit p_limit) u;
$$;

create function api.v1_drop_uploads(p_ids text[]) returns integer
language sql security definer set search_path = '' as $$
  with d as (delete from cloud.artifact_uploads where id = any(p_ids) and used_at is null returning 1)
  select count(*)::integer from d;
$$;

-- The sweep no longer drops uploads: their files must leave R2 first.
create or replace function api.v1_sweep() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_events integer;
  v_replays integer;
  v_alerts integer;
begin
  delete from cloud.api_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from cloud.api_idempotency where created_at < now() - interval '1 day';
  get diagnostics v_replays = row_count;
  delete from cloud.alerts where read_at < now() - interval '30 days';
  get diagnostics v_alerts = row_count;
  return jsonb_build_object('events', v_events, 'replays', v_replays, 'alerts', v_alerts);
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname in (
             'record_subscription', 'subscriptions_for', 'join_studio_waitlist', 'v1_usage', 'v1_create_task',
             'v1_create_upload', 'v1_new_upload_key', 'v1_upload_target', 'v1_add_upload_part', 'v1_finish_upload',
             'v1_expiring_accounts', 'v1_expired', 'v1_delete_expired', 'v1_abandoned_uploads', 'v1_drop_uploads',
             'v1_sweep'))
       or (n.nspname = 'cloud' and p.proname in ('v1_over_quota', 'v1_open_tasks', 'v1_storage_used', 'v1_upload_key'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
