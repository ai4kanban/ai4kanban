#!/usr/bin/env node
// Checks that the Supabase project is closed to everyone but the Worker: the project's own
// URL must return nothing to an anonymous client, and nothing to a signed-in one either.
//
//   npm run check:closed
//
// Values come from the environment or from cloud/.env, which is not in git:
//   SUPABASE_URL             the project's base URL
//   SUPABASE_ANON_KEY        the project's anon/publishable key — the one a client would hold
//   SUPABASE_TEST_USER_JWT   optional: a real signed-in session, to check that too

import { DAILY_WRITE_BUDGET } from '../src/config.ts'
import { PG_WRITE_BUDGET_EXCEEDED } from '../src/db.ts'
import { loadEnv, requireEnv } from './env.mjs'

main().catch((error) => {
  console.error(`check-closed: ${error.message}`)
  process.exit(1)
})

async function main() {
  const env = await loadEnv()
  const [rawUrl, anonKey] = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY')
  const url = rawUrl.replace(/\/+$/, '')
  const userJwt = env.SUPABASE_TEST_USER_JWT

  const callers = [{ name: 'anonymous', token: anonKey }]
  if (userJwt) callers.push({ name: 'signed-in', token: userJwt })
  else console.log('check-closed: no SUPABASE_TEST_USER_JWT — checking the anonymous caller only.')

  const results = []
  for (const caller of callers) {
    results.push(await exposesNothing(url, anonKey, caller))
    results.push(await refusesGraphql(url, anonKey, caller))
    for (const [fn, args] of RPCS) {
      results.push(await refusesRpc(url, anonKey, caller, fn, args))
    }
  }

  for (const { ok, label, detail } of results) {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  }
  if (results.some((result) => !result.ok)) {
    throw new Error('the project is reachable from outside the Worker')
  }
  console.log('check-closed: the database answers nobody but the Worker.')
}

/** PostgREST publishes what a caller may reach. For these callers that must be nothing. */
async function exposesNothing(url, anonKey, caller) {
  const label = `${caller.name}: /rest/v1/ exposes no table and no function`
  const response = await fetch(`${url}/rest/v1/`, { headers: headers(anonKey, caller.token) })
  if (!response.ok) return { ok: true, label, detail: `refused with ${response.status}` }

  const spec = await response.json().catch(() => ({}))
  const paths = Object.keys(spec.paths ?? {}).filter((path) => path !== '/')
  return paths.length === 0
    ? { ok: true, label }
    : { ok: false, label, detail: `reachable: ${paths.join(', ')}` }
}

/**
 * Every function the Worker calls, with the arguments the Worker calls them by. Arguments
 * the function would refuse on its own — a budget of 1, say — are refused whether or not
 * the caller could reach it, so the check would pass on a wide open project.
 */
const RPCS = [
  ['service_heartbeat', {}],
  ['service_self_check', { p_daily_write_budget: DAILY_WRITE_BUDGET }],
  [
    'account_for_session',
    { p_subject: '00000000-0000-4000-8000-000000000000', p_daily_write_budget: DAILY_WRITE_BUDGET },
  ],
  // #320's actor lookup, which turns a Slack workspace and user into an account and the
  // token Cloud posts with. It is the one function reached on behalf of a caller holding no
  // sign-in at all, so it is the one worth proving nobody else can call.
  ['slack_actor', { p_team_id: 'T0', p_slack_user_id: 'U0' }],
]

async function refusesRpc(url, anonKey, caller, fn, args) {
  const label = `${caller.name}: rpc/${fn} is refused`
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...headers(anonKey, caller.token), 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (response.ok) return { ok: false, label, detail: `answered ${response.status}` }

  // Only being shut out counts. Our own SQLSTATE in the body means the function ran for
  // this caller, which is a failure however it then ended.
  const body = await response.json().catch(() => ({}))
  return body?.code === PG_WRITE_BUDGET_EXCEEDED
    ? { ok: false, label, detail: `ran for this caller and raised ${body.code}` }
    : { ok: true, label, detail: `refused with ${response.status}` }
}

/** The GraphQL endpoint is a second way in, and the preview exposes no schema through it. */
async function refusesGraphql(url, anonKey, caller) {
  const label = `${caller.name}: /graphql/v1 is refused`
  const response = await fetch(`${url}/graphql/v1`, {
    method: 'POST',
    headers: { ...headers(anonKey, caller.token), 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ __schema { queryType { name } } }' }),
  })
  return response.ok
    ? { ok: false, label, detail: `answered ${response.status}` }
    : { ok: true, label, detail: `refused with ${response.status}` }
}

const headers = (anonKey, token) => ({ apikey: anonKey, authorization: `Bearer ${token}` })
