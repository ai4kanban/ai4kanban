-- AI credits (#1113): one monthly pool that every hosted capability spends from, replacing
-- the narration minutes of 0030. Pro's grant is not stored: it is a constant in the Worker
-- (`cloud/src/credits.ts`), and a month's balance is that grant less what this ledger holds.
--
-- One row per spend. The write is exempt from the daily budget: what it pays for is done.

create table cloud.credit_spends (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  month date not null,
  use text not null check (use in ('speech')),
  credits numeric not null check (credits >= 0),
  at timestamptz not null default now()
);
create index credit_spends_user_month on cloud.credit_spends (user_id, month);
alter table cloud.credit_spends enable row level security;

-- Narration already spoken counts 1:1, so switching over resets nobody's month.
insert into cloud.credit_spends (user_id, month, use, credits)
select user_id, month, 'speech', seconds from cloud.speech_usage where seconds > 0;

drop function api.speech_seconds_used(uuid);
drop function api.record_speech(uuid, numeric);
drop table cloud.speech_usage;

/* Credits this user has spent this UTC month. */
create or replace function api.credits_used(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select to_json(coalesce((
    select sum(s.credits) from cloud.credit_spends s
    where s.user_id = p_user_id
      and s.month = date_trunc('month', now() at time zone 'utc')::date
  ), 0));
$$;
revoke all on function api.credits_used(uuid) from public;
grant execute on function api.credits_used(uuid) to service_role;

/* Record one spend against this month; answers the month's total. */
create or replace function api.spend_credits(p_user_id uuid, p_use text, p_credits numeric)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  insert into cloud.credit_spends (user_id, month, use, credits)
  values (p_user_id, v_month, p_use, greatest(p_credits, 0));
  return api.credits_used(p_user_id);
end;
$$;
revoke all on function api.spend_credits(uuid, text, numeric) from public;
grant execute on function api.spend_credits(uuid, text, numeric) to service_role;
