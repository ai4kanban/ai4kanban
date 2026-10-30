import type { LarkCloud } from './config.ts'

/** The Worker's secrets. All of them are set with `wrangler secret put`, never in git. */
export interface Env {
  /** The Supabase project's base URL, e.g. `https://abcdefgh.supabase.co`. */
  SUPABASE_URL: string
  /** The project's service role key. It never leaves the Worker. */
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Set per request, never configured: the web's interface language, which the jobs the
   *  request starts reply in (#11). */
  REQUEST_LANG?: 'en' | 'zh'
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
  /**
   * The two Lark store apps (#351) — one listed on `open.feishu.cn`, one on
   * `open.larksuite.com`. A set per cloud, and each set optional on its own: a build carrying
   * only one of them offers only that one, and says so where Connect would be.
   *
   * The Encrypt Key is what makes a callback refusable. Lark sends the signature and the
   * timestamp that bound a replay only under encryption, so a cloud without one accepts no
   * callback rather than accepting them unchecked.
   */
  FEISHU_APP_ID?: string
  FEISHU_APP_SECRET?: string
  FEISHU_ENCRYPT_KEY?: string
  LARK_APP_ID?: string
  LARK_APP_SECRET?: string
  LARK_ENCRYPT_KEY?: string
  /** OpenRouter, for hosted narration (#1054), covers (#1114) and music (#1822). Optional:
   *  without it `/v1/speech`, `/v1/image` and `/v1/music` refuse. */
  OPENROUTER_API_KEY?: string
  /** Creem, for Pro (#1037). Optional: without all four every billing route refuses. The
   *  product ids are `vars` in wrangler.jsonc, not secrets. */
  CREEM_API_KEY?: string
  CREEM_WEBHOOK_SECRET?: string
  CREEM_PRODUCT_MONTHLY?: string
  CREEM_PRODUCT_YEARLY?: string
  /** One 100 GB Pro storage pack, monthly (#2017). Optional: without it only that checkout refuses. */
  CREEM_PRODUCT_STORAGE?: string
  /** The private bucket holding shared templates' files, previews and evidence (#1708).
   *  Optional: without it every template route refuses. */
  TEMPLATES?: R2Bucket
  /** Where hosted music calls its model from (#1828). Optional: without it the call goes out
   *  directly, carrying the user's country. */
  MUSIC_CALLS?: DurableObjectNamespace
  /** Artifact files of the public API (#2000). Optional: without it uploads and file reads refuse. */
  ARTIFACTS?: R2Bucket
  /** One `EventHub` per account, holding its open event streams (#2000). Optional: without it
   *  `/v1/events/stream` refuses and the paged read still answers. */
  EVENT_HUBS?: DurableObjectNamespace
  /** One `Board` per project, holding its board files (#2081). */
  BOARDS?: DurableObjectNamespace
  /** One `RunLog` per Runner job, holding its log while it runs (#2085). */
  RUN_LOGS?: DurableObjectNamespace
  /** One `RunnerPresence` per account, ending a gone Runner's lease early (#2163). */
  RUNNER_PRESENCE?: DurableObjectNamespace
  /** One `DiffCall` per diff a page asks for, holding the Runner's answer in memory (#2109). */
  DIFF_CALLS?: DurableObjectNamespace
  /** WildCrane Web, when not `APP_URL` — staging or local; share links open there. */
  APP_URL?: string
  /** The commit this build was deployed from, set by `npm run deploy`; `+dirty` when the
   *  Worker files had uncommitted changes. */
  COMMIT?: string
}

/** Whether this build can install into a workspace at all. */
export const slackConfigured = (env: Env): boolean =>
  !!env.SLACK_CLIENT_ID && !!env.SLACK_CLIENT_SECRET && !!env.SLACK_SIGNING_SECRET

/** One cloud's app credentials, or null when this build carries no app for it. */
export function larkApp(
  env: Env,
  cloud: LarkCloud,
): { appId: string; appSecret: string; encryptKey: string } | null {
  const held =
    cloud === 'feishu'
      ? { appId: env.FEISHU_APP_ID, appSecret: env.FEISHU_APP_SECRET, encryptKey: env.FEISHU_ENCRYPT_KEY }
      : { appId: env.LARK_APP_ID, appSecret: env.LARK_APP_SECRET, encryptKey: env.LARK_ENCRYPT_KEY }
  if (!held.appId || !held.appSecret || !held.encryptKey) return null
  return { appId: held.appId, appSecret: held.appSecret, encryptKey: held.encryptKey }
}

export function requireEnv(env: Env): void {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!env[name]) throw new Error(`missing secret ${name}`)
  }
}
