-- Image generation in three tiers (#77): each call records the tier it was asked for.

alter table cloud.ai_calls add column tier text check (tier in ('economy', 'standard', 'premium'));
-- Every image so far was generated at today's medium quality.
update cloud.ai_calls set tier = 'standard' where capability = 'image';

-- Dropped first so PostgREST never sees two overloads.
drop function api.record_ai_call(uuid, text, boolean, numeric, numeric, text);

/* Record one call. A failed call keeps neither usage nor cost; `p_tier` is the image tier. */
create function api.record_ai_call(
  p_user_id uuid,
  p_capability text,
  p_ok boolean,
  p_usage numeric,
  p_cost_usd numeric,
  p_generation_id text,
  p_tier text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into cloud.ai_calls (user_id, month, capability, ok, usage, cost_usd, generation_id, tier)
  values (
    p_user_id,
    date_trunc('month', now() at time zone 'utc')::date,
    p_capability,
    p_ok,
    case when p_ok then p_usage end,
    case when p_ok then p_cost_usd end,
    nullif(p_generation_id, ''),
    p_tier
  );
$$;
revoke all on function api.record_ai_call(uuid, text, boolean, numeric, numeric, text, text) from public;
grant execute on function api.record_ai_call(uuid, text, boolean, numeric, numeric, text, text) to service_role;
