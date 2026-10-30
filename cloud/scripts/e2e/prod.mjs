// Production access for the end-to-end tests: SQL over the Supabase Management API, and the
// throwaway account every run makes and removes. Only rows of that account are touched.

import { dirname, join } from 'node:path'

import { git } from '../commit.mjs'
import { loadEnv } from '../env.mjs'

export const API = 'https://api.ai4kanban.dev'
export const WEB = 'https://app.wildcrane.ai'
export const SUPABASE_URL = 'https://yajrbpprmdvtkvjjfpbk.supabase.co'
// The publishable key every browser already holds.
export const SUPABASE_KEY = 'sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n'

/** cloud/.env, falling back to the main checkout's, so it runs from a worktree. */
export async function credentials(...names) {
  let env = await loadEnv()
  if (!names.every((name) => env[name])) {
    const main = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
    env = { ...(await loadEnv(join(main, 'cloud', '.env'))), ...env }
  }
  const missing = names.filter((name) => !env[name])
  if (missing.length > 0) throw new Error(`set ${missing.join(' and ')}, in the environment or in cloud/.env`)
  return env
}

export function sqlClient(env) {
  return async (query) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(60_000),
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body.slice(0, 300)}`)
    return JSON.parse(body)
  }
}

export const literal = (value) => `'${String(value).replace(/'/g, "''")}'`

/** Every test account's handle and email share this prefix, so a leftover is recognisable. */
export const TEST_PREFIX = 'wc-e2e-'
