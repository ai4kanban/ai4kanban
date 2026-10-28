-- A refund or chargeback ends Pro at once (#1188).
--
-- Creem cancels a refunded subscription but leaves its period running, so the row alone reads
-- as Pro until it ends. The Worker reads the refunds off Creem's transactions and records the
-- latest refunded period's end here; a row whose period ends no later than that is not Pro
-- (src/billing.ts). A renewal after the refund starts a later period and is Pro again.

alter table cloud.subscriptions
  add column refunded_through timestamptz,
  add column revoked_at timestamptz;

/*
 * Record a refund on a row the Worker has already written. `refunded_through` only moves
 * forward, and `revoked_at` moves with it — Creem's cancel time, else now — so a replay, or an
 * older refund arriving late, changes nothing. Null when the row does not exist.
 */
create or replace function api.record_refund(
  p_id text,
  p_refunded_through timestamptz,
  p_revoked_at timestamptz,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row cloud.subscriptions;
begin
  select * into v_row from cloud.subscriptions s where s.id = p_id for update;
  if v_row.id is null then
    return null;
  end if;

  if v_row.refunded_through is null or p_refunded_through > v_row.refunded_through then
    perform cloud.count_write(p_daily_write_budget);
    update cloud.subscriptions s
      set refunded_through = p_refunded_through,
          revoked_at = coalesce(p_revoked_at, now()),
          updated_at = now()
      where s.id = p_id
    returning * into v_row;
  end if;

  return json_build_object('id', v_row.id, 'refunded_through', v_row.refunded_through);
end;
$$;
revoke all on function api.record_refund(text, timestamptz, timestamptz, integer) from public;
grant execute on function api.record_refund(text, timestamptz, timestamptz, integer) to service_role;

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
             as current_period_end,
           to_char(s.refunded_through at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as refunded_through,
           to_char(s.revoked_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
             as revoked_at
    from cloud.subscriptions s
    where s.user_id = p_user_id
  ) q;
$$;
