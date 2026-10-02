-- A checkout whose notification never came is still recorded (#1251).
--
-- The Worker notes every checkout it starts, and asks Creem about the ones still here when
-- their user next reads their plan (src/billing.ts). A row goes once Creem has settled it, or
-- a day after it was started. A call that changes no row costs no budget.

create table cloud.pending_checkouts (
  id text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
alter table cloud.pending_checkouts enable row level security;

create index pending_checkouts_by_user on cloud.pending_checkouts (user_id);

/* Note a checkout just started, and drop this user's ones past their day. */
create or replace function api.record_pending_checkout(
  p_id text,
  p_user_id uuid,
  p_daily_write_budget integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dropped integer;
  v_added integer;
begin
  delete from cloud.pending_checkouts c
    where c.user_id = p_user_id and c.created_at <= now() - interval '24 hours';
  get diagnostics v_dropped = row_count;

  insert into cloud.pending_checkouts (id, user_id) values (p_id, p_user_id)
    on conflict (id) do nothing;
  get diagnostics v_added = row_count;

  if v_dropped + v_added > 0 then
    perform cloud.count_write(p_daily_write_budget);
  end if;
end;
$$;
revoke all on function api.record_pending_checkout(text, uuid, integer) from public;
grant execute on function api.record_pending_checkout(text, uuid, integer) to service_role;

/*
 * Hand out this user's checkouts to ask Creem about, newest first: at most five, each under a
 * day old and not asked about in the last minute — `p_force` skips that wait. Handing one out
 * stamps it, so a poll every few seconds asks once a minute.
 */
create or replace function api.claim_pending_checkouts(
  p_user_id uuid,
  p_force boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids text[];
begin
  with due as (
    select c.id
    from cloud.pending_checkouts c
    where c.user_id = p_user_id
      and c.created_at > now() - interval '24 hours'
      and (p_force or c.checked_at is null or c.checked_at <= now() - interval '1 minute')
    order by c.created_at desc, c.id
    limit 5
    for update skip locked
  ), claimed as (
    update cloud.pending_checkouts c
      set checked_at = now()
      from due
      where c.id = due.id
    returning c.id, c.created_at
  )
  select array_agg(id order by created_at desc, id) into v_ids from claimed;

  if v_ids is null then
    return '[]'::json;
  end if;
  perform cloud.count_write(p_daily_write_budget);
  return to_json(v_ids);
end;
$$;
revoke all on function api.claim_pending_checkouts(uuid, boolean, integer) from public;
grant execute on function api.claim_pending_checkouts(uuid, boolean, integer) to service_role;

/* Forget a checkout Creem has settled. */
create or replace function api.drop_pending_checkout(
  p_id text,
  p_user_id uuid,
  p_daily_write_budget integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cloud.pending_checkouts c where c.id = p_id and c.user_id = p_user_id;
  if found then
    perform cloud.count_write(p_daily_write_budget);
  end if;
end;
$$;
revoke all on function api.drop_pending_checkout(text, uuid, integer) from public;
grant execute on function api.drop_pending_checkout(text, uuid, integer) to service_role;
