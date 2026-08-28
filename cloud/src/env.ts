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
  /**
   * The Slack app this service installs into a workspace (#320). Deliberately not required,
   * for the same reason the mail key is not: a Worker with no Slack app answers every other
   * route, and the Slack routes say plainly that this build carries none.
   */
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  /** What Slack signs every callback with. Without it no callback is trusted, so a build
   *  missing it accepts none rather than accepting them unchecked. */
  SLACK_SIGNING_SECRET?: string
}

/** Whether this build can install into a workspace at all. */
export const slackConfigured = (env: Env): boolean =>
  !!env.SLACK_CLIENT_ID && !!env.SLACK_CLIENT_SECRET && !!env.SLACK_SIGNING_SECRET

export function requireEnv(env: Env): void {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!env[name]) throw new Error(`missing secret ${name}`)
  }
}
