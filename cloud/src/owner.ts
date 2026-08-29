/**
 * Who a request is, and whether Cloud takes its work — the one check every route applies.
 *
 * #323 stopped at verifying the sign-in token. This is the rest of it: the verified subject
 * is turned into an account record, and an account we have not admitted is refused with a
 * code of its own. A later card's route calls `requireOwner` and gets an `owner.accountId`
 * to hang its rows off, rather than inventing an owner column and a check of its own.
 *
 * Two routes are open before admission — the one that reports the session, so the app can
 * name the account it refused, and #327's, where a refused person asks for an invite. They
 * call `readSession`; everything else calls `requireOwner`.
 */

import { bearerToken, verifyAccessToken } from './auth.ts'
import { mutate } from './db.ts'
import type { Env } from './env.ts'
import { notAdmitted, notYours } from './errors.ts'

/** What the database says about a verified sign-in. */
interface AccountRow {
  admitted: boolean
  handle: string | null
  name: string | null
  avatar_url: string | null
  account_id: string | null
  /** When this account last asked for an invite and has not been answered (#327). Null when
   *  it never asked, or when the request has been closed out. */
  invite_requested_at: string | null
}

/** A verified sign-in, admitted or not. What `GET /v1/session` reports. */
export interface Session {
  /** The Supabase user id the sign-in token carries. */
  subject: string
  email?: string
  /** When the sign-in token itself runs out, in milliseconds. */
  expiresAt: number
  admitted: boolean
  /** The handle GitHub attests for this sign-in — what #320 links a Slack actor to. */
  handle: string | null
  name: string | null
  avatarUrl: string | null
  /** The account row every later row hangs off. Null until the account is admitted. */
  accountId: string | null
  /** The open invite request, if there is one — what the pane shows in place of the button
   *  so pressing again neither writes a second row nor sends a second email (#327). */
  inviteRequestedAt: string | null
}

/** An admitted account. Every #325 row's owner. */
export interface Owner {
  accountId: string
  subject: string
  handle: string
  name: string | null
  avatarUrl: string | null
  email?: string
  expiresAt: number
}

/**
 * The verified sign-in and what Cloud makes of it. Refuses a missing, expired or malformed
 * token — `verifyAccessToken` does that — and reports an unadmitted account rather than
 * refusing it, so the caller can say which account was refused.
 */
export async function readSession(request: Request, env: Env): Promise<Session> {
  const identity = await verifyAccessToken(bearerToken(request), env.SUPABASE_URL)
  const row = await mutate<AccountRow>(env, 'account_for_session', { p_subject: identity.subject })
  return {
    subject: identity.subject,
    email: identity.email,
    expiresAt: identity.expiresAt,
    admitted: row.admitted === true && !!row.account_id,
    handle: row.handle,
    name: row.name,
    avatarUrl: row.avatar_url,
    accountId: row.account_id,
    inviteRequestedAt: row.invite_requested_at ?? null,
  }
}

/** The same, refused unless the account is in the preview. Every route but the session. */
export async function requireOwner(request: Request, env: Env): Promise<Owner> {
  const session = await readSession(request, env)
  if (!session.admitted || !session.accountId || !session.handle) throw notAdmitted()
  return {
    accountId: session.accountId,
    subject: session.subject,
    handle: session.handle,
    name: session.name,
    avatarUrl: session.avatarUrl,
    email: session.email,
    expiresAt: session.expiresAt,
  }
}

/**
 * Refuse a row belonging to another account, whatever the row is. The database raises the
 * same refusal from `cloud.require_owner` inside a mutation's own transaction; this is the
 * cheaper half, for a route holding the row's owner already.
 */
export function requireOwned(owner: Owner, ownerId: string | null | undefined): void {
  if (!ownerId || ownerId !== owner.accountId) throw notYours()
}
