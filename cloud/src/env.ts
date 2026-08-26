/** The Worker's secrets. All of them are set with `wrangler secret put`, never in git. */
export interface Env {
  /** The Supabase project's base URL, e.g. `https://abcdefgh.supabase.co`. */
  SUPABASE_URL: string
  /** The project's service role key. It never leaves the Worker. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /**
   * Resend's API key, for the invitation mail (#327). Deliberately not required: a Worker
   * that cannot mail still answers every route, and the hourly run says so in the log rather
   * than the whole service refusing requests over a secret only the schedule needs.
   */
  RESEND_API_KEY?: string
}

export function requireEnv(env: Env): void {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!env[name]) throw new Error(`missing secret ${name}`)
  }
}
