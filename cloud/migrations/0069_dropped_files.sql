-- What a deleted row leaves outside Postgres (#2089): a project's board Durable Object, and
-- the R2 files of artifact versions, unused uploads and run logs. Triggers queue them however
-- the row went, a cascade from a deleted account included; the hourly run clears the queue.

create table cloud.dropped_boards (
  project_id text primary key,
  dropped_at timestamptz not null default now()
);
alter table cloud.dropped_boards enable row level security;

create table cloud.dropped_files (
  key text primary key,
  multipart_id text,
  dropped_at timestamptz not null default now()
);
alter table cloud.dropped_files enable row level security;

create function cloud.drop_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.dropped_boards (project_id) values (old.id) on conflict do nothing;
  return old;
end;
$$;
create trigger drop_board after delete on cloud.projects for each row execute function cloud.drop_board();

create function cloud.drop_version_file() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.file ->> 'key' is not null then
    insert into cloud.dropped_files (key) values (old.file ->> 'key') on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger drop_version_file after delete on cloud.artifact_versions
  for each row execute function cloud.drop_version_file();

-- A used upload's key is its version's file, queued with the version.
create function cloud.drop_upload_file() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.used_at is null then
    insert into cloud.dropped_files (key, multipart_id)
    values (old.object_key, case when old.uploaded_at is null then old.multipart_id end) on conflict do nothing;
  end if;
  return old;
end;
$$;
create trigger drop_upload_file after delete on cloud.artifact_uploads
  for each row execute function cloud.drop_upload_file();

create function cloud.drop_run_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into cloud.dropped_files (key) values ('jobs/' || old.id || '/log.json') on conflict do nothing;
  return old;
end;
$$;
create trigger drop_run_log after delete on cloud.runner_jobs for each row execute function cloud.drop_run_log();

-- Left by #2086's end-to-end test.
insert into cloud.dropped_boards (project_id) values ('prj_01a1763415610bab616a62bd40c7') on conflict do nothing;

-- Ten minutes old first: `deleteProject` moves the cards out before it destroys the board.
create function api.v1_dropped_boards(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(project_id), '[]') from (
    select project_id from cloud.dropped_boards where dropped_at < now() - interval '10 minutes'
     order by dropped_at limit p_limit) b;
$$;

create function api.v1_forget_boards(p_ids text[]) returns integer
language sql security definer set search_path = '' as $$
  with d as (delete from cloud.dropped_boards where project_id = any(p_ids) returning 1)
  select count(*)::integer from d;
$$;

create function api.v1_dropped_files(p_limit integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'multipart_id', multipart_id)), '[]') from (
    select key, multipart_id from cloud.dropped_files where dropped_at < now() - interval '10 minutes'
     order by dropped_at limit p_limit) f;
$$;

create function api.v1_forget_files(p_keys text[]) returns integer
language sql security definer set search_path = '' as $$
  with d as (delete from cloud.dropped_files where key = any(p_keys) returning 1)
  select count(*)::integer from d;
$$;

-- A run's log is written only while its job is there to delete it.
create function api.v1_job_exists(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cloud.runner_jobs where id = p_id);
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'api' and p.proname in
             ('v1_dropped_boards', 'v1_forget_boards', 'v1_dropped_files', 'v1_forget_files', 'v1_job_exists'))
        or (n.nspname = 'cloud' and p.proname in ('drop_board', 'drop_version_file', 'drop_upload_file', 'drop_run_log'))
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
