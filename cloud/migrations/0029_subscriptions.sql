-- Pro subscriptions sold through Creem (#1037).
--
-- One row per Creem subscription, keyed by Creem's own id and owned by a Supabase user — not
-- by a `cloud.accounts` row, so anybody signed in can buy without being admitted to Cloud.
-- The Worker writes a row only with what it has just read back from Creem, so the row is
-- always Creem's current state and a repeated or out-of-order notification converges on it.
-- Whether a row makes its user Pro is decided when it is read (src/billing.ts), so expiry
-- needs no notification and no schedule.

create table cloud.subscriptions (
  id text primary key,
  user_id uuid not null,
  customer_id text not null,
  period text not null check (period in ('monthly', 'yearly')),
  status text not null,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table cloud.subscriptions enable row level security;

create index subscriptions_by_user on cloud.subscriptions (user_id);

/*
 * Write the whole row as Creem has it. A null user keeps the row's own; with neither, nothing
 * is written and null comes back, for the Worker to log. A write identical to the row costs
 * no budget, so a replayed notification changes nothing at all.
 */
create or replace function api.record_subscription(
  p_id text,
  p_user_id uuid,
  p_customer_id text,
  p_period text,
  p_status text,
  p_current_period_end timestamptz,
  p_daily_write_budget integer
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
     or v_row.status <> p_status
     or v_row.current_period_end is distinct from p_current_period_end then
    perform cloud.count_write(p_daily_write_budget);
    insert into cloud.subscriptions as s
      (id, user_id, customer_id, period, status, current_period_end, updated_at)
    values (p_id, v_user, p_customer_id, p_period, p_status, p_current_period_end, now())
    on conflict (id) do update
      set user_id = excluded.user_id,
          customer_id = excluded.customer_id,
          period = excluded.period,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          updated_at = excluded.updated_at
    returning * into v_row;
  end if;

  return json_build_object('id', v_row.id, 'user_id', v_row.user_id);
end;
$$;
revoke all on function api.record_subscription(text, uuid, text, text, text, timestamptz, integer) from public;
grant execute on function api.record_subscription(text, uuid, text, text, text, timestamptz, integer) to service_role;

/* Every subscription this user holds, newest first. */
create or replace function api.subscriptions_for(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(q) order by q.updated_at desc), '[]'::json)
  from (
    select s.id, s.customer_id, s.period, s.status, s.updated_at,
           to_char(s.current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as current_period_end
    from cloud.subscriptions s
    where s.user_id = p_user_id
  ) q;
$$;
revoke all on function api.subscriptions_for(uuid) from public;
grant execute on function api.subscriptions_for(uuid) to service_role;
