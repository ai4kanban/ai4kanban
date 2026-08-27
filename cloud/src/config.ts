/**
 * Writes Cloud allows itself in one UTC day, counted in the database inside each
 * mutation's own transaction. The account's ceiling is 100,000 Worker requests a day,
 * shared with the telemetry service (#294); this budget is a fifth of it, far above what
 * an invite-only preview writes and low enough that a runaway client cannot take the
 * account down with it. Raising it is a deploy, not a migration.
 */
export const DAILY_WRITE_BUDGET = 20_000

/** How long a fetched JWKS is reused before it is fetched again. */
export const JWKS_TTL_MS = 10 * 60 * 1000

/** The floor between two JWKS fetches, so an unknown `kid` cannot be used to hammer Auth. */
export const JWKS_MIN_REFETCH_MS = 30 * 1000

/** Clock skew allowed when checking a token's `exp` and `nbf`. */
export const CLOCK_SKEW_SECONDS = 60

// --- the invitation mail (#327) ----------------------------------------------
// One sender, one queue, one retry. Both messages the preview sends — the notice that
// somebody asked, and the code that answers — go out from the hourly run through Resend.

/** Who an invitation comes from. The root name is what Resend verifies; it signs with a DKIM
 *  key there and keeps its return path on `send.`, so the mailbox MX and SPF stay untouched. */
export const MAIL_FROM = 'AI4Kanban <invites@ai4kanban.dev>'

/** Where a reply lands, for both messages. The one mailbox a person reads. */
export const SUPPORT_EMAIL = 'support@ai4kanban.dev'

/** How many records one run picks up. Far above what an invite-only preview queues in an
 *  hour, and inside the free tier's day either way. */
export const MAIL_BATCH = 20

/** Attempts before a record is left alone. Past this it keeps its last error and stops being
 *  mailed every hour forever. */
export const MAIL_MAX_ATTEMPTS = 5
