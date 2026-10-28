-- The first migration creates only what the service itself needs: the two schemas, the
-- day's write counter, the heartbeat the scheduled run touches, and the lockdown that keeps
-- every caller but the Worker out. Every board table is #314's.

-- ---------------------------------------------------------------------------
-- The database is not a client API.
--
-- `cloud` holds the data and is exposed to nothing. `api` holds the functions the Worker
-- calls and is the one schema PostgREST serves, so a request that is not the Worker is
-- refused at the schema before any function is considered. That is what makes this a
-- property of the project rather than a rule each later migration has to remember:
-- `alter default privileges ... revoke execute on functions from public` looks like it
-- would do the same job and does not — Postgres keeps PUBLIC's implicit EXECUTE on every
-- new function whatever the default ACL says. Withholding USAGE on the schema is what
-- actually closes it.
--
-- The project's PostgREST exposed-schema list must therefore be `api` alone. `npm run
-- check:closed` is what proves it from outside.
-- ---------------------------------------------------------------------------

create schema if not exists cloud;
comment on schema cloud is 'AI4Kanban Cloud data. Reached only from the functions in `api`; served to nobody.';
revoke all on schema cloud from public;
revoke all on schema cloud from anon, authenticated;

create schema if not exists api;
comment on schema api is 'The functions the Cloud Worker calls. The one schema PostgREST serves.';
revoke all on schema api from public;
revoke all on schema api from anon, authenticated;
grant usage on schema api to service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per UTC day. Every mutation adds to it inside its own transaction, so the count
-- can never drift from what was actually written.
create table cloud.daily_writes (
  day date primary key,
  writes bigint not null default 0
);
alter table cloud.daily_writes enable row level security;

-- One row, ever. The scheduled run rewrites it, which is what keeps a free Supabase
-- project from pausing after a quiet week.
create table cloud.service_heartbeat (
  id boolean primary key default true constraint service_heartbeat_one_row check (id),
  last_run_at timestamptz not null default now(),
  runs bigint not null default 0
);
alter table cloud.service_heartbeat enable row level security;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Counts a mutation's writes against the day's budget, which the Worker passes in so the
-- number is a deploy rather than a migration. Raising aborts the caller's transaction, so
-- a refused write rolls its own increment back: the counter stops at the budget, and a
-- refusal costs nothing.
create or replace function cloud.count_write(
  p_daily_write_budget integer,
  p_writes integer default 1
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_writes bigint;
begin
  insert into cloud.daily_writes as d (day, writes)
  values ((now() at time zone 'utc')::date, p_writes)
  on conflict (day) do update set writes = d.writes + excluded.writes
  returning d.writes into v_writes;

  if v_writes > p_daily_write_budget then
    raise exception 'Cloud has used up today''s free-tier writes.'
      using errcode = 'AKB01';
  end if;

  return v_writes;
end;
$$;
revoke all on function cloud.count_write(integer, integer) from public;

-- The scheduled run's one call. It is deliberately outside the write budget: it is 24 rows
-- a day, and a busy day must not switch off the thing keeping the project awake.
create or replace function api.service_heartbeat()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_run_at timestamptz;
  v_runs bigint;
  v_writes bigint;
begin
  insert into cloud.service_heartbeat as h (id, last_run_at, runs)
  values (true, now(), 1)
  on conflict (id) do update set last_run_at = now(), runs = h.runs + 1
  returning h.last_run_at, h.runs into v_last_run_at, v_runs;

  select d.writes into v_writes
  from cloud.daily_writes d
  where d.day = (now() at time zone 'utc')::date;

  return json_build_object(
    'last_run_at', v_last_run_at,
    'runs', v_runs,
    'writes_today', coalesce(v_writes, 0)
  );
end;
$$;
revoke all on function api.service_heartbeat() from public;
grant execute on function api.service_heartbeat() to service_role;

-- The post-deploy check: one budgeted write through the same path every mutation uses, so
-- the write budget and the read-only refusal are shown working before a client meets them.
create or replace function api.service_self_check(p_daily_write_budget integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  return json_build_object(
    'writes_today', cloud.count_write(p_daily_write_budget),
    'daily_write_budget', p_daily_write_budget
  );
end;
$$;
revoke all on function api.service_self_check(integer) from public;
grant execute on function api.service_self_check(integer) to service_role;
