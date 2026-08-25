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
