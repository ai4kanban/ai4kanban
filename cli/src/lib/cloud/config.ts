// Where Cloud is, from a client's side.
//
// None of this is secret. The Supabase project's publishable key is what any client of a
// Supabase project holds, and it reaches nothing here: PostgREST serves the `api` schema
// alone and `api` grants nothing to `anon` or `authenticated` (cloud/migrations/0001), which
// `npm run check:closed` proves from outside. The key's whole job is to let Auth answer a
// sign-in and a refresh.
//
// The environment overrides all three, so a checkout can be pointed at a throwaway project
// without a build. See "Standing up a new project" in cloud/README.md.

/** The Supabase project Cloud signs in against. */
const SUPABASE_URL = 'https://yajrbpprmdvtkvjjfpbk.supabase.co'

/** That project's publishable (anon) key. */
const SUPABASE_ANON_KEY = 'sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n'

/** The Worker every Cloud request goes to. */
const API_URL = 'https://api.ai4kanban.dev'

/**
 * Where a finished sign-in comes back to: the desktop app, over a URL scheme it registers
 * for itself. The board UI server's loopback port is whatever the OS handed out at launch,
 * so no fixed address of its own can be registered with the project. #320 reuses the scheme
 * to open a card from Slack.
 */
export const URL_SCHEME = 'ai4kanban'
export const SIGN_IN_REDIRECT = `${URL_SCHEME}://cloud/signed-in`

export interface CloudEndpoints {
  supabaseUrl: string
  anonKey: string
  api: string
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** Read fresh on every call so a value set after this module loaded still counts. */
export function cloudEndpoints(): CloudEndpoints {
  return {
    supabaseUrl: trimSlash(process.env.AI4KANBAN_SUPABASE_URL || SUPABASE_URL),
    anonKey: process.env.AI4KANBAN_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
    api: trimSlash(process.env.AI4KANBAN_CLOUD_URL || API_URL),
  }
}

/** Whether this build knows a Supabase project to sign in against at all. */
export function cloudConfigured(): boolean {
  const { supabaseUrl, anonKey } = cloudEndpoints()
  return !!supabaseUrl && !!anonKey
}

/** The one line every screen shows when it isn't. */
export const NOT_CONFIGURED =
  'This build of AI4Kanban carries no Cloud project to sign in against.'
