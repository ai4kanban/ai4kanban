#!/usr/bin/env node
// The sign-in's return addresses, as the Supabase project holds them. Auth does not refuse an
// address that is not on the list — it returns to the site URL instead — so a missing one
// reads as a sign-in landing on the marketing page rather than as an error. See README.md,
// "Standing up a new project", step 4.
//
//   npm run redirects            print what the project allows today
//   npm run redirects -- --set   make it match RETURN_TO below
//
// Credentials come from the environment, or from cloud/.env, which is not in git — the same
// two `npm run migrate` uses.

import { loadEnv, requireEnv } from './env.mjs'

/** Both halves of the sign-in: the desktop app's URL scheme (#326) and the browser's (#322). */
const RETURN_TO = ['ai4kanban://cloud/signed-in', 'https://cloud.ai4kanban.dev/signin/callback']

const SITE_URL = 'https://ai4kanban.dev'

main().catch((error) => {
  console.error(`redirects: ${error.message}`)
  process.exit(1)
})

async function main() {
  const [ref, token] = requireEnv(
    await loadEnv(),
    'SUPABASE_PROJECT_REF',
    'SUPABASE_ACCESS_TOKEN',
  )
  const set = process.argv.includes('--set')
  const config = await authConfig(ref, token, set ? RETURN_TO : null)

  const allowed = (config.uri_allow_list ?? '').split(',').filter(Boolean)
  console.log(`redirects: site url ${config.site_url}`)
  for (const address of RETURN_TO) {
    console.log(`  ${allowed.includes(address) ? '✓' : '✗'} ${address}`)
  }
  for (const address of allowed) {
    if (!RETURN_TO.includes(address)) console.log(`  ? ${address} — not one of ours`)
  }
  if (!set && RETURN_TO.some((address) => !allowed.includes(address))) {
    console.log('redirects: `npm run redirects -- --set` adds what is missing.')
  }
}

/** Reads the project's auth configuration, writing `allow` first when one is given. */
async function authConfig(ref, token, allow) {
  const answer = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: allow ? 'PATCH' : 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(allow ? { 'content-type': 'application/json' } : {}),
    },
    body: allow ? JSON.stringify({ uri_allow_list: allow.join(','), site_url: SITE_URL }) : undefined,
  })
  if (!answer.ok) throw new Error(`Supabase answered ${answer.status}: ${await answer.text()}`)
  return answer.json()
}
