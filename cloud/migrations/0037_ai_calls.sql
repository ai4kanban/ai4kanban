-- What every hosted AI call cost us upstream (#1355).
--
-- One row per call that reached the provider, failed or not. Numbers only: no prompt, text,
-- image or audio. `cloud.credit_spends` stays the credit ledger; this is read beside it, by
-- hand, never by a route. The write is exempt from the daily budget: the call is already made.

create table cloud.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  month date not null,
  capability text not null check (capability in ('judge', 'speech', 'image')),
  ok boolean not null,
  -- Input tokens for judge, seconds for speech, 1 for image. Null on a failed call.
  usage numeric check (usage >= 0),
  -- Null when the call failed or the provider did not say.
  cost_usd numeric check (cost_usd >= 0),
  generation_id text,
  at timestamptz not null default now()
);
create index ai_calls_month_user on cloud.ai_calls (month, user_id);
alter table cloud.ai_calls enable row level security;

/* Record one call. A failed call keeps neither usage nor cost. */
create or replace function api.record_ai_call(
  p_user_id uuid,
  p_capability text,
  p_ok boolean,
  p_usage numeric,
  p_cost_usd numeric,
  p_generation_id text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into cloud.ai_calls (user_id, month, capability, ok, usage, cost_usd, generation_id)
  values (
    p_user_id,
    date_trunc('month', now() at time zone 'utc')::date,
    p_capability,
    p_ok,
    case when p_ok then p_usage end,
    case when p_ok then p_cost_usd end,
    nullif(p_generation_id, '')
  );
$$;
revoke all on function api.record_ai_call(uuid, text, boolean, numeric, numeric, text) from public;
grant execute on function api.record_ai_call(uuid, text, boolean, numeric, numeric, text) to service_role;
