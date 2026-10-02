// What Cloud's hosted AI calls cost (#1355), read for the page's "AI cost" section. One
// read-only statement through Supabase's query API, the way cloud/scripts/sql.mjs runs one:
// `cloud.ai_calls` beside `cloud.credit_spends`, summed per UTC day, user and capability.

import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const NEEDED = ['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']
const TIMEOUT_MS = 20_000

/** `env`, with whichever of the two values it lacks taken from cloud/.env — those two only. */
export function withCloudEnv(env, file) {
  const missing = NEEDED.filter((name) => !env[name])
  if (missing.length === 0 || !existsSync(file)) return env
  const held = parseEnv(readFileSync(file, 'utf8'))
  const found = missing.filter((name) => held[name]).map((name) => [name, held[name]])
  return { ...env, ...Object.fromEntries(found) }
}

/** @param from the first UTC day to read, `YYYY-MM-DD` */
export const aiCostSql = (from) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error(`not a day: ${from}`)
  return `
with calls as (
  select (at at time zone 'utc')::date as day, user_id, capability,
         count(*) as calls,
         count(*) filter (where not ok) as failed,
         coalesce(sum(cost_usd), 0) as cost,
         count(*) filter (where ok and cost_usd is null) as cost_unknown
  from cloud.ai_calls
  where (at at time zone 'utc')::date >= '${from}'
  group by 1, 2, 3
), spends as (
  select (at at time zone 'utc')::date as day, user_id, use as capability, sum(credits) as credits
  from cloud.credit_spends
  where (at at time zone 'utc')::date >= '${from}'
  group by 1, 2, 3
), merged as (
  select day, user_id, capability,
         coalesce(c.calls, 0) as calls,
         coalesce(c.failed, 0) as failed,
         coalesce(c.cost, 0) as cost,
         coalesce(c.cost_unknown, 0) as cost_unknown,
         coalesce(s.credits, 0) as credits
  from calls c full join spends s using (day, user_id, capability)
), users as (
  select u.user_id,
         (select a.email from auth.users a where a.id = u.user_id) as email,
         sub.period, sub.renewing, sub.period_end
  from (select distinct user_id from merged) u
  left join lateral (
    -- The subscription that pays: never a refunded one, a renewing one first.
    select s.period,
           s.status in ('active', 'trialing', 'past_due') as renewing,
           (s.current_period_end at time zone 'utc')::date as period_end
    from cloud.subscriptions s
    where s.user_id = u.user_id
      and not (s.refunded_through is not null
               and (s.current_period_end is null
                    or s.current_period_end <= s.refunded_through + interval '1 day'))
    order by 2 desc, s.current_period_end desc nulls last
    limit 1
  ) sub on true
)
select json_build_object(
  'rows', (select coalesce(json_agg(m), '[]'::json) from merged m),
  'users', (select coalesce(json_agg(u), '[]'::json) from users u)
) as ai;`
}

/**
 * `{ rows, users }`, or `{ failed: why }` — never an empty answer standing in for a read that
 * did not come back.
 */
export async function readAiCost(env, from) {
  const missing = NEEDED.filter((name) => !env[name])
  if (missing.length > 0) {
    const verb = missing.length > 1 ? 'are' : 'is'
    return { failed: `${missing.join(' and ')} ${verb} not set, in the environment, telemetry/.env or cloud/.env.` }
  }
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query: aiCostSql(from) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )
    if (!response.ok) return { failed: `Supabase answered ${response.status}.` }
    const ai = (await response.json())?.[0]?.ai
    if (!Array.isArray(ai?.rows) || !Array.isArray(ai?.users)) {
      return { failed: 'Supabase answered in a shape this page cannot read.' }
    }
    return { rows: ai.rows, users: ai.users }
  } catch (error) {
    return { failed: `Cloud's database could not be reached (${error.message}).` }
  }
}
