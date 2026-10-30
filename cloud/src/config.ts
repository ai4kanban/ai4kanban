/**
 * Writes Cloud allows itself in one UTC day, counted in the database inside each
 * mutation's own transaction. The account's ceiling is 100,000 Worker requests a day,
 * shared with the telemetry service (#294); this budget is a fifth of it, far above what
 * an invite-only preview writes and low enough that a runaway client cannot take the
 * account down with it. Raising it is a deploy, not a migration.
 */
export const DAILY_WRITE_BUDGET = 20_000

/**
 * How long a server's claim on a request holds without being renewed (#318).
 *
 * Past it the claim reads as interrupted wherever it is read, because a killed server
 * reports nothing and Cloud runs no sweep. Minutes rather than seconds, and set here rather
 * than by the client: a renewal is a write against the one daily budget above, so a delivery
 * running for hours must cost tens of them rather than thousands. The client renews well
 * inside this — see RENEW_MS in cli/src/lib/cloud/requests.ts.
 */
export const CLAIM_LEASE_SECONDS = 15 * 60

/** How long a Runner counts as connected, and holds a job, without renewing (#2001). The
 *  Runner renews well inside it; same budget reasoning as CLAIM_LEASE_SECONDS. */
export const RUNNER_LEASE_SECONDS = 15 * 60

/** The oldest Runner protocol this service takes. Raising it tells older Runners to restart,
 *  which updates them. */
export const RUNNER_MIN_PROTOCOL = 11

/** How long a Runner waits on a runtime's connection test (#2074); runner/src/jobs.ts matches it. */
export const RUNTIME_TEST_SECONDS = 30

/** Where "Start free" sends somebody: the desktop app's latest release. */
export const RUNNER_DOWNLOAD_URL = 'https://github.com/ai4kanban/ai4kanban/releases/latest'

/** How long a fetched JWKS is reused before it is fetched again. */
export const JWKS_TTL_MS = 10 * 60 * 1000

/** The floor between two JWKS fetches, so an unknown `kid` cannot be used to hammer Auth. */
export const JWKS_MIN_REFETCH_MS = 30 * 1000

/** Clock skew allowed when checking a token's `exp` and `nbf`. */
export const CLOCK_SKEW_SECONDS = 60

// --- the invitation mail (#327) ----------------------------------------------
// One sender, one queue, one retry. Both messages the preview sends — the notice that
// somebody asked, and the news that we approved them — go out from the hourly run through Resend.

/** Who an invitation comes from. The root name is what Resend verifies; it signs with a DKIM
 *  key there and keeps its return path on `send.`, so the mailbox MX and SPF stay untouched. */
export const MAIL_FROM = 'WildCrane <invites@ai4kanban.dev>'

/** Where a reply lands, for both messages. The one mailbox a person reads. */
export const SUPPORT_EMAIL = 'support@ai4kanban.dev'

/** How many records one run picks up. Far above what an invite-only preview queues in an
 *  hour, and inside the free tier's day either way. */
export const MAIL_BATCH = 20

/** Attempts before a record is left alone. Past this it keeps its last error and stops being
 *  mailed every hour forever. */
export const MAIL_MAX_ATTEMPTS = 5

// --- Slack (#320) -------------------------------------------------------------
// One connected app per account: a bot token to post with, a signing secret to check a
// callback against, and no dependency — `fetch` for the Web API call and `crypto.subtle`
// for the HMAC are both already here.

/** What the app asks a workspace for, and nothing more.
 *
 *  `chat:write` posts and edits the message; `chat:write.public` reaches a public channel
 *  the app was not invited to; `im:write` opens the direct message a destination may be;
 *  the two `:read` scopes are what the destination picker lists. No history scope: the app
 *  never reads a message, including its own. */
export const SLACK_SCOPES = 'chat:write,chat:write.public,im:write,channels:read,groups:read'

/** Where a finished install comes back to. The Worker answers Slack's redirect and sends
 *  the browser here, which is the app — the same scheme the sign-in comes back on. */
export const SLACK_INSTALLED_REDIRECT = 'ai4kanban://cloud/slack-connected'

/** How many messages one scheduled run writes. Far above what a preview owes in an hour. */
export const SLACK_BATCH = 25

/** Attempts against one event's delivery record before it is left alone. A message that
 *  gets through resets the count, so this bounds a failing message rather than a busy one. */
export const SLACK_MAX_ATTEMPTS = 5

/** How old a callback may be. Slack's own recommendation, and what makes a captured
 *  request useless minutes later. */
export const SLACK_CALLBACK_MAX_AGE_SECONDS = 5 * 60

/** Slack's own limits on one message. Text past the first is cut at a bullet or paragraph
 *  boundary and the rest is left behind the card link. */
export const SLACK_SECTION_LIMIT = 3000
export const SLACK_BLOCK_LIMIT = 50

/** Where the app's own address is written down, for the card link a Slack message carries.
 *  A message is written from the scheduled run as often as from a request, so it cannot be
 *  read off a request's origin. */
export const API_ORIGIN = 'https://api.ai4kanban.dev'

/** Where the hosted Cloud pages are (#322). */
export const CLOUD_UI_ORIGIN = 'https://cloud.ai4kanban.dev'

// --- Lark / 飞书 (#351) --------------------------------------------------------
// A store app per cloud: listed in that cloud's own directory, installed by a tenant, and
// posting with a token minted per tenant from the `app_ticket` the platform pushes. No
// dependency here either — `fetch` for the API call, `crypto.subtle` for the callback.

/** The two clouds, which are two separate platforms rather than two addresses of one: an
 *  app listed in either is unknown to the other, and each reviews its listing itself. */
export const LARK_CLOUDS = ['feishu', 'lark'] as const
export type LarkCloud = (typeof LARK_CLOUDS)[number]

export const isLarkCloud = (value: string): value is LarkCloud =>
  (LARK_CLOUDS as readonly string[]).includes(value)

/** Where each cloud answers, and what a person calls it. `api` takes every server call;
 *  `accounts` is the only host that shows a consent screen. */
export const LARK_HOSTS: Record<LarkCloud, { api: string; accounts: string; name: string }> = {
  feishu: { api: 'https://open.feishu.cn', accounts: 'https://accounts.feishu.cn', name: '飞书' },
  lark: { api: 'https://open.larksuite.com', accounts: 'https://accounts.larksuite.com', name: 'Lark' },
}

/** Where a finished connection comes back to — the app, on the scheme the sign-in and the
 *  Slack connection already come back on. */
export const LARK_CONNECTED_REDIRECT = 'ai4kanban://cloud/lark-connected'

/** How many messages one scheduled run writes, and how many attempts one message gets.
 *  Slack's numbers, for the same reasons. */
export const LARK_BATCH = 25
export const LARK_MAX_ATTEMPTS = 5

/** How old a callback may be. Lark stamps every signed callback, so a captured one is
 *  useless minutes later. */
export const LARK_CALLBACK_MAX_AGE_SECONDS = 5 * 60

/** A tenant token lasts two hours. It is minted again this far before it runs out, so a
 *  message never goes out on one that expired between the read and the send. */
export const LARK_TOKEN_SKEW_SECONDS = 5 * 60

/** Lark's own limits on one card. A `lark_md` element takes far more than a reader does, so
 *  these bound the card rather than the platform: text past them is cut at a bullet or
 *  paragraph boundary and the rest is left behind the card link. */
export const LARK_ELEMENT_LIMIT = 40
export const LARK_TEXT_LIMIT = 3000

/** WildCrane Web (#2082): its card and review pages frame components; share links open at `/s/`. */
export const APP_URL = 'https://app.wildcrane.ai'

/** Artifact components' bundles (#2006): each version on its own subdomain, a site apart. */
export const COMPONENT_HOST = 'wildcraneusercontent.com'

// --- the training page's bookings (#683) --------------------------------------
// A visitor with no account books an hour on the public site. These are the numbers that
// bound what a stranger's request can do; when the coach is free is `training-schedule.ts`.

/** Where the training page is served from, and the only origins the booking routes answer a
 *  browser on. Everything else gets no CORS header at all, so a page on another site cannot
 *  read the answer even though the request reaches us. */
export const TRAINING_ALLOWED_ORIGINS = [
  'https://wildcrane.ai',
  'https://www.wildcrane.ai',
  'https://ai4kanban.dev',
  'https://www.ai4kanban.dev',
  'http://localhost:3000',
]

/** How far ahead the availability read will look. A visitor asks for their own current week,
 *  so anything wider is a caller walking the calendar rather than reading a page. */
export const TRAINING_MAX_WINDOW_DAYS = 14

/** Submits from one caller inside one window, and how long that window is. Generous for a
 *  person who mistypes an address twice, and narrow enough that nobody fills the schedule
 *  from a script. */
export const TRAINING_ATTEMPT_LIMIT = 8
export const TRAINING_ATTEMPT_WINDOW_SECONDS = 15 * 60

/** What the fingerprint behind that limit is salted with, so the table cannot be walked back
 *  to a list of addresses that visited. Any deploy-time string; changing it resets the
 *  windows and nothing else. */
export const TRAINING_ATTEMPT_SALT = 'ai4kanban-training-v1'

/** The longest the project note is stored at. A booking form is not a document. */
export const TRAINING_MAX_PROJECT = 2000

/** Who a booking's messages come from, and where the coach reads their copy. `MAIL_FROM`
 *  above is the invitation sender; a booking is not an invitation, so it says what it is. */
export const TRAINING_MAIL_FROM = 'WildCrane Training <training@ai4kanban.dev>'
export const TRAINING_COACH_EMAIL = SUPPORT_EMAIL

/** The outbox's batch and attempt ceiling. #327's numbers, for #327's reasons. */
export const TRAINING_MAIL_BATCH = 20
export const TRAINING_MAIL_MAX_ATTEMPTS = 5

/** Where the training page lives. A manage link is this plus the booking's reference and its
 *  token, so a message can be written from the scheduled run with no request to read it off. */
export const TRAINING_PAGE_URL = 'https://wildcrane.ai/training'
export const TRAINING_TERMS_URL = 'https://wildcrane.ai/terms#training'

/** The GitHub handles allowed to read the booking records. An admitted Cloud account is not
 *  enough: these rows are other people's names, addresses and project notes, and the preview
 *  admits people who have nothing to do with the training service. */
export const TRAINING_OPERATORS = ['neverchanje']

/** The handles that may publish, replace and delete shared templates (#1708). Everyone else
 *  signed in only reads them. */
export const TEMPLATE_PUBLISHERS = ['neverchanje']

// --- the site's contact form (#784) -------------------------------------------

/** Submits one visitor address, or one sender email, may make inside one window. Either key
 *  past the limit refuses the submit. */
export const CONTACT_ATTEMPT_LIMIT = 5
export const CONTACT_ATTEMPT_WINDOW_SECONDS = 60 * 60

/** What the two rate-limit keys are salted with. Changing it resets the windows. */
export const CONTACT_ATTEMPT_SALT = 'ai4kanban-contact-v1'

/** The longest message, and the longest workflow description, the form may send. */
export const CONTACT_MAX_MESSAGE = 5000
export const CONTACT_MAX_WORKFLOW = 5000

export const CONTACT_MAIL_FROM = 'WildCrane Contact <contact@ai4kanban.dev>'
export const CONTACT_MAIL_BATCH = 20
export const CONTACT_MAIL_MAX_ATTEMPTS = 5

/** How long a task's chat is kept, in Cloud and on the Runner that answered it (#2065). The
 *  Runner reviews chats daily, well inside it. */
export const CHAT_KEEP_DAYS = 30
