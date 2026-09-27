-- Hosted narration used per Pro user and UTC month (#1062).
--
-- Keyed by the Supabase user, like `cloud.subscriptions`. Only a narration that was generated
-- is recorded, and the write is exempt from the daily budget: the audio is already paid for.

create table cloud.speech_usage (
  user_id uuid not null,
  month date not null,
  seconds numeric not null default 0,
  primary key (user_id, month)
);
alter table cloud.speech_usage enable row level security;

/* Seconds this user has used this UTC month. */
create or replace function api.speech_seconds_used(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select to_json(coalesce((
    select u.seconds from cloud.speech_usage u
    where u.user_id = p_user_id
      and u.month = date_trunc('month', now() at time zone 'utc')::date
  ), 0));
$$;
revoke all on function api.speech_seconds_used(uuid) from public;
grant execute on function api.speech_seconds_used(uuid) to service_role;

/* Add a generated narration's seconds to this month; answers the month's total. */
create or replace function api.record_speech(p_user_id uuid, p_seconds numeric)
returns json
language sql
security definer
set search_path = ''
as $$
  insert into cloud.speech_usage as u (user_id, month, seconds)
  values (p_user_id, date_trunc('month', now() at time zone 'utc')::date, greatest(p_seconds, 0))
  on conflict (user_id, month) do update set seconds = u.seconds + excluded.seconds
  returning to_json(u.seconds);
$$;
revoke all on function api.record_speech(uuid, numeric) from public;
grant execute on function api.record_speech(uuid, numeric) to service_role;
