/** The Worker's secrets. All of them are set with `wrangler secret put`, never in git. */
export interface Env {
  /** The Supabase project's base URL, e.g. `https://abcdefgh.supabase.co`. */
  SUPABASE_URL: string
  /** The project's service role key. It never leaves the Worker. */
  SUPABASE_SERVICE_ROLE_KEY: string
}

export function requireEnv(env: Env): void {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!env[name]) throw new Error(`missing secret ${name}`)
  }
}
