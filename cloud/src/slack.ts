/**
 * The account's one Slack connection (#320) — making it, pointing it somewhere, ending it.
 *
 * Slack is a connected app rather than a pasted webhook: an incoming webhook can post a
 * message but cannot carry a signed action back, which is this card's whole point. The cost
 * is a connection the user makes once, and the handshake below is the whole of it.
 *
 * No dependency. Both halves of talking to Slack are already here — one `fetch` for the Web
 * API call, and `crypto.subtle` for the callback signature (./slack-actions.ts).
 *
 * The bot token never leaves the Worker. `read_slack_connection` deliberately answers
 * without it, so a token that never reaches a client cannot leak from one.
 */

import { SLACK_INSTALLED_REDIRECT, SLACK_SCOPES } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { slackConfigured } from './env.ts'
import { badRequest, slackNotConnected, slackUnavailable } from './errors.ts'
import type { Owner } from './owner.ts'

/** What the Configuration pane draws. No token, ever. */
export interface SlackConnection {
  connected: true
  teamName: string
  channelId: string
  channelName: string
  slackUserId: string
  /** Slack refused us — the app was removed, the token revoked, the destination gone. */
  revoked: boolean
  lastError: string
}

/** Who a press in a channel is, and what to post with. The callback path's one read. */
export interface SlackActor {
  ownerId: string
  botToken: string
  channelId: string
  revoked: boolean
}

/** One conversation a destination can be pointed at. */
export interface SlackConversation {
  id: string
  name: string
  /** A direct message rather than a channel, so the pane can say which it is. */
  direct: boolean
}

/** The name a direct message is offered and remembered under. Naming the person would need
 *  a scope that reads the workspace's directory, and the destination is the user's own DM
 *  with the app either way. */
const DIRECT_MESSAGE = 'Direct message'

// --- connecting ---------------------------------------------------------------

/**
 * The consent screen to open, with the nonce that makes the redirect this account's.
 *
 * `origin` is this Worker's own address, read off the request rather than configured: the
 * redirect has to come back to the deployment that started the install, and a second copy
 * of the address is a second thing to keep true.
 */
export async function beginSlackInstall(
  env: Env,
  owner: Owner,
  origin: string,
): Promise<{ url: string }> {
  if (!slackConfigured(env)) throw slackUnavailable()
  const state = crypto.randomUUID()
  await mutate(env, 'slack_begin_install', { p_subject: owner.accountId, p_state: state })

  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID ?? '')
  url.searchParams.set('scope', SLACK_SCOPES)
  url.searchParams.set('redirect_uri', redirectUri(origin))
  url.searchParams.set('state', state)
  return { url: url.toString() }
}

export const redirectUri = (origin: string): string => `${origin}/v1/slack/installed`

/**
 * Slack's redirect, turned into the connection.
 *
 * It answers a person looking at a browser tab, so every ending is a short page rather than
 * a JSON refusal — and every ending that worked sends them back to the app on the same URL
 * scheme the sign-in comes back on.
 */
export async function finishSlackInstall(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (!slackConfigured(env)) return page('This service carries no Slack app to connect to.')

  const refused = url.searchParams.get('error')
  if (refused) return page(`Slack did not complete the connection: ${refused}.`)
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!code || !state) return page('That Slack answer is not readable. Start again from the app.')

  let granted: OauthGrant
  try {
    granted = await exchange(env, code, redirectUri(url.origin))
  } catch (error) {
    return page(`Slack did not complete the connection: ${message(error)}.`)
  }

  // A workspace with nowhere to post is a connection that would fail silently. The direct
  // message with whoever connected always exists, so it is where a fresh connection points
  // until the user picks a channel — a card's reasoning need not go to a room.
  let channelId = ''
  try {
    channelId = await openDirectMessage(granted.botToken, granted.slackUserId)
  } catch {
    // The pane asks for a destination when there is none.
  }

  const done = await mutate<{ ok: boolean; reason?: string }>(env, 'slack_finish_install', {
    p_state: state,
    p_team_id: granted.teamId,
    p_team_name: granted.teamName,
    p_bot_token: granted.botToken,
    p_bot_user_id: granted.botUserId,
    p_slack_user_id: granted.slackUserId,
    p_channel_id: channelId,
    p_channel_name: channelId ? DIRECT_MESSAGE : '',
  })
  if (!done.ok) {
    return page(
      done.reason === 'actor_taken'
        ? 'That Slack account is already connected to another AI4Kanban account. Disconnect it there first.'
        : 'That connection was started too long ago. Start it again from the app.',
    )
  }
  // Written rather than built with `Response.redirect`, which validates the address: this
  // one is the app's own URL scheme, not an http address.
  return new Response(null, { status: 302, headers: { location: SLACK_INSTALLED_REDIRECT } })
}

interface OauthGrant {
  teamId: string
  teamName: string
  botToken: string
  botUserId: string
  slackUserId: string
}

/** Spend the code. Form-encoded and with the client secret in the body, which is what
 *  `oauth.v2.access` takes — the one Slack call that is not a Bearer request. */
async function exchange(env: Env, code: string, redirect: string): Promise<OauthGrant> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID ?? '',
      client_secret: env.SLACK_CLIENT_SECRET ?? '',
      code,
      redirect_uri: redirect,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    access_token?: string
    bot_user_id?: string
    team?: { id?: string; name?: string }
    authed_user?: { id?: string }
  }
  if (!body.ok || !body.access_token) throw new Error(body.error ?? 'no token')
  if (!body.team?.id || !body.authed_user?.id) throw new Error('no workspace')
  return {
    teamId: body.team.id,
    teamName: body.team.name ?? '',
    botToken: body.access_token,
    botUserId: body.bot_user_id ?? '',
    slackUserId: body.authed_user.id,
  }
}

// --- what the pane reads and writes -------------------------------------------

/** This account's connection, or null when it has none. */
export async function readSlackConnection(
  env: Env,
  owner: Owner,
): Promise<{ connection: SlackConnection | null; configured: boolean }> {
  const connection = await call<SlackConnection | null>(env, 'read_slack_connection', {
    p_subject: owner.accountId,
  })
  return { connection: connection ?? null, configured: slackConfigured(env) }
}

/** Where this account's messages go. The channels the app can reach, and the direct message
 *  with whoever connected. */
export async function listSlackConversations(
  env: Env,
  owner: Owner,
): Promise<{ conversations: SlackConversation[] }> {
  const held = await heldToken(env, owner)
  const answer = await slackApi<{ channels?: { id?: string; name?: string }[] }>(
    held.botToken,
    'conversations.list',
    { types: 'public_channel,private_channel', exclude_archived: true, limit: 200 },
  )
  const channels = (answer.channels ?? [])
    .filter((c): c is { id: string; name: string } => !!c.id && !!c.name)
    .map((c) => ({ id: c.id, name: `#${c.name}`, direct: false }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Always offered, and always first: it is the one destination that cannot have been
  // archived, renamed or left, and it is where a card's reasoning goes when no room should
  // have it.
  const direct = await openDirectMessage(held.botToken, held.slackUserId).catch(() => '')
  return {
    conversations: direct
      ? [{ id: direct, name: DIRECT_MESSAGE, direct: true }, ...channels]
      : channels,
  }
}

/** Point it somewhere. Picking again is also how a refusal is cleared. */
export async function setSlackDestination(
  env: Env,
  owner: Owner,
  body: unknown,
): Promise<{ connection: SlackConnection }> {
  const input = (body ?? {}) as Record<string, unknown>
  const channelId = typeof input.channelId === 'string' ? input.channelId.trim() : ''
  if (!channelId) throw badRequest('That request names no conversation.')
  const channelName = typeof input.channelName === 'string' ? input.channelName.slice(0, 200) : ''

  const connection = await mutate<SlackConnection | null>(env, 'set_slack_destination', {
    p_subject: owner.accountId,
    p_channel_id: channelId,
    p_channel_name: channelName,
  })
  if (!connection) throw slackNotConnected()
  return { connection }
}

/**
 * End it. The row goes first, so this account stops posting whatever Slack answers, and the
 * token is handed back to Slack afterwards as a courtesy rather than a condition.
 *
 * No board is touched: every event goes on exactly as it was, and the bell keeps carrying
 * all of them.
 */
export async function disconnectSlack(env: Env, owner: Owner): Promise<{ disconnected: true }> {
  const done = await mutate<{ disconnected: boolean; botToken?: string }>(env, 'slack_disconnect', {
    p_subject: owner.accountId,
  })
  if (done.botToken) {
    await slackApi(done.botToken, 'auth.revoke', {}).catch(() => undefined)
  }
  return { disconnected: true }
}

/** Who a press is, resolved from the workspace and the user together. Null is an actor we
 *  have no account for, which the callback answers with its own words rather than acting. */
export const slackActor = (env: Env, teamId: string, slackUserId: string): Promise<SlackActor | null> =>
  call<SlackActor | null>(env, 'slack_actor', { p_team_id: teamId, p_slack_user_id: slackUserId })

/** Slack refused us. Recorded where the connection was made, because messages failing into
 *  silence read to the user as no work waiting. */
export const slackRefused = (env: Env, ownerId: string, error: string): Promise<unknown> =>
  mutate(env, 'slack_refused', { p_owner: ownerId, p_error: error })

async function heldToken(
  env: Env,
  owner: Owner,
): Promise<{ botToken: string; slackUserId: string; channelId: string }> {
  const held = await call<{ botToken: string; slackUserId: string; channelId: string } | null>(
    env,
    'slack_token',
    { p_subject: owner.accountId },
  )
  if (!held) throw slackNotConnected()
  return held
}

// --- the Web API --------------------------------------------------------------

/** Slack answers 200 with `{ ok: false, error }` for a refusal, so the status is not the
 *  answer — the body is. Its `error` is carried through as it stands: it is what the pane
 *  shows and what decides whether a connection reads as revoked. */
export async function slackApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T & { ok: true }> {
  let response: Response
  try {
    response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error(`slack unreachable: ${message(e)}`)
  }
  const answer = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!answer.ok) throw new Error(answer.error || `slack answered ${response.status}`)
  return answer as T & { ok: true }
}

/** The direct message between the app and one person, which is also how its id is learnt. */
async function openDirectMessage(token: string, userId: string): Promise<string> {
  const answer = await slackApi<{ channel?: { id?: string } }>(token, 'conversations.open', {
    users: userId,
  })
  return answer.channel?.id ?? ''
}

/** Every ending of the redirect a person is looking at. Plain text, because whoever reads
 *  it is in a browser tab that has nothing else on it. */
const page = (words: string): Response =>
  new Response(`${words}\n`, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
