-- A 7-day Pro trial before purchase (#1932): Cloud's own record, never Creem's, and no card.
--
-- One per user, ever. Who may start one (nobody who has subscribed or held a seed grant) and
-- whether it is still Pro are decided by the Worker when read (src/billing.ts), so expiry
-- needs nothing. Its credits are a fixed pool, spent from `cloud.credit_spends` while it runs.

create table cloud.pro_trials (
  user_id uuid primary key,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
alter table cloud.pro_trials enable row level security;

/* This user's trial, over or not, or null. */
create or replace function api.trial_for(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
           'starts_at', to_char(t.starts_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'ends_at', to_char(t.ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  from cloud.pro_trials t
  where t.user_id = p_user_id;
$$;
revoke all on function api.trial_for(uuid) from public;
grant execute on function api.trial_for(uuid) to service_role;

/* Start the trial, or leave the one already had. Answers the user's trial. */
create or replace function api.start_trial(p_user_id uuid, p_daily_write_budget integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added integer;
begin
  insert into cloud.pro_trials (user_id, starts_at, ends_at)
  values (p_user_id, now(), now() + interval '7 days')
  on conflict (user_id) do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    perform cloud.count_write(p_daily_write_budget);
  end if;
  return api.trial_for(p_user_id);
end;
$$;
revoke all on function api.start_trial(uuid, integer) from public;
grant execute on function api.start_trial(uuid, integer) to service_role;

/* Credits this user has spent during their trial. */
create or replace function api.trial_credits_used(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select to_json(coalesce((
    select sum(s.credits)
    from cloud.credit_spends s
    join cloud.pro_trials t on t.user_id = s.user_id
    where s.user_id = p_user_id and s.at >= t.starts_at and s.at < t.ends_at
  ), 0));
$$;
revoke all on function api.trial_credits_used(uuid) from public;
grant execute on function api.trial_credits_used(uuid) to service_role;
