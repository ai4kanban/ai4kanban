/**
 * The account's one Lark connection (#351) — making it, pointing it somewhere, ending it.
 *
 * Lark is 飞书 and Lark international, which are two platforms rather than two addresses of
 * one: an AI4Kanban app is listed in each directory, each reviews its own listing, and each
 * answers on its own host. Which cloud a connection came from is the connection's, and no
 * board and no card ever learns about it.
 *
 * A store app is installed into a tenant by somebody who may administer it, and that install
 * happens in Lark rather than in our pane. What the pane starts is the authorization the
 * person follows to grant the app and come back identified — which is where the account
 * learns the tenant, and which cannot finish for a tenant where the app is not installed.
 *
 * Posting is done with a token minted per tenant: the platform pushes an `app_ticket` on its
 * own schedule, that plus the app's credentials mint an `app_access_token`, and that plus the
 * tenant's key mint the `tenant_access_token` a message goes out on. All three are held in
 * Cloud and renewed there; none of them ever leaves the Worker.
 *
 * No dependency. `fetch` for the API call and `crypto.subtle` for the callback are both here
 * already (./lark-actions.ts).
 */

import {
  LARK_CONNECTED_REDIRECT,
  LARK_HOSTS,
  LARK_TOKEN_SKEW_SECONDS,
  type LarkCloud,
} from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { larkApp } from './env.ts'
import { badRequest, larkNotConnected, larkUnavailable } from './errors.ts'
import type { Owner } from './owner.ts'

/** What the Configuration pane draws. No token, ever. */
export interface LarkConnection {
  connected: true
  cloud: LarkCloud
  /** What a person calls that cloud — `飞书` or `Lark`. */
  cloudName: string
  /** Who connected it, as Lark names them. Their press is this account's. */
  userName: string
  /** Where messages go: a group chat the bot is in, or the direct message with the person
   *  who connected. */
  destinationId: string
  destinationName: string
  direct: boolean
  /** Lark refused us — the tenant uninstalled the app, or the destination is gone. */
  revoked: boolean
  lastError: string
}

/** Which clouds this build can offer, in the order the pane draws them. */
export interface LarkCloudOffer {
  cloud: LarkCloud
  name: string
  /** False when this build carries no app for that cloud — the pane says so rather than
   *  offering a button that cannot finish. */
  configured: boolean
}

/** Who a press in a chat is. The callback path's one read. */
export interface LarkActor {
  ownerId: string
  cloud: LarkCloud
  revoked: boolean
}

/** One chat a destination can be pointed at. */
export interface LarkChat {
  id: string
  name: string
  /** The direct message with whoever connected, rather than a group. */
  direct: boolean
}

/** The name the direct message is offered and remembered under. It is the one destination
 *  that cannot have been left, renamed or dissolved. */
const DIRECT_MESSAGE = 'Direct message'

/** How this account's connection posts, as `api.connector_jobs` hands it to the delivery. */
export interface LarkPosts {
  cloud: LarkCloud
  tenantKey: string
  destinationId: string
  direct: boolean
  /** The account the connection was made under. A topic reply notifies its subscribers and a
   *  bot opening one subscribes nobody, so a reply still asking for a decision names it.
   *  Absent from a schema older than 0012. */
  openId?: string
}

// --- connecting ---------------------------------------------------------------

/**
 * The consent screen to open, with the nonce that makes the answer this account's.
 *
 * `origin` is this Worker's own address, read off the request rather than configured: the
 * answer has to come back to the deployment that started the connection, and a second copy
 * of the address is a second thing to keep true.
 */
export async function beginLarkConnect(
  env: Env,
  owner: Owner,
  cloud: LarkCloud,
  origin: string,
): Promise<{ url: string }> {
  const app = larkApp(env, cloud)
  if (!app) throw larkUnavailable(LARK_HOSTS[cloud].name)
  const state = crypto.randomUUID()
  await mutate(env, 'lark_begin_connect', {
    p_subject: owner.accountId,
    p_state: state,
    p_cloud: cloud,
  })

  const url = new URL(`${LARK_HOSTS[cloud].accounts}/open-apis/authen/v1/authorize`)
  url.searchParams.set('client_id', app.appId)
  url.searchParams.set('redirect_uri', redirectUri(origin, cloud))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  return { url: url.toString() }
}

export const redirectUri = (origin: string, cloud: LarkCloud): string =>
  `${origin}/v1/lark/${cloud}/connected`

/**
 * Lark's redirect, turned into the connection.
 *
 * It answers a person looking at a browser tab, so every ending is a short page rather than
 * a JSON refusal — and every ending that worked sends them back to the app on the same URL
 * scheme the sign-in comes back on.
 */
export async function finishLarkConnect(
  env: Env,
  cloud: LarkCloud,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const named = LARK_HOSTS[cloud].name
  if (!larkApp(env, cloud)) return page(`This service carries no ${named} app to connect to.`)

  const refused = url.searchParams.get('error')
  if (refused) {
    return page(
      refused === 'access_denied'
        ? `${named} did not complete the connection: you did not grant it.`
        : // The one refusal a person can act on: an authorization cannot finish for a tenant
          // where the app is not installed, and installing it is a move in Lark.
          `${named} did not complete the connection: ${refused}. If AI4Kanban is not installed in your organisation yet, install it from the ${named} app directory and connect again.`,
    )
  }
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!code || !state) return page(`That ${named} answer is not readable. Start again from the app.`)

  let who: LarkIdentity
  try {
    who = await identify(env, cloud, code, redirectUri(url.origin, cloud))
  } catch (error) {
    return page(`${named} did not complete the connection: ${message(error)}.`)
  }

  const done = await mutate<{ ok: boolean; reason?: string }>(env, 'lark_finish_connect', {
    p_state: state,
    p_cloud: cloud,
    p_tenant_key: who.tenantKey,
    p_open_id: who.openId,
    p_union_id: who.unionId,
    p_user_name: who.name,
    // The direct message with whoever connected is where a fresh connection points: it is
    // the one destination that always exists, and a card's reasoning need not go to a room.
    p_destination_id: who.openId,
    p_destination_name: DIRECT_MESSAGE,
    p_direct: true,
  })
  if (!done.ok) {
    return page(
      done.reason === 'actor_taken'
        ? `That ${named} account is already connected to another AI4Kanban account. Disconnect it there first.`
        : 'That connection was started too long ago. Start it again from the app.',
    )
  }
  // Written rather than built with `Response.redirect`, which validates the address: this
  // one is the app's own URL scheme, not an http address.
  return new Response(null, { status: 302, headers: { location: LARK_CONNECTED_REDIRECT } })
}

interface LarkIdentity {
  tenantKey: string
  openId: string
  unionId: string
  name: string
}

/** Spend the code, and ask who spent it. The tenant and the user together are what a press
 *  is matched on later, so both are learnt here or the connection is not made. */
async function identify(
  env: Env,
  cloud: LarkCloud,
  code: string,
  redirect: string,
): Promise<LarkIdentity> {
  const app = larkApp(env, cloud)
  if (!app) throw new Error('no app')
  const granted = await larkPost<{ access_token?: string }>(cloud, '/open-apis/authen/v2/oauth/token', {
    grant_type: 'authorization_code',
    client_id: app.appId,
    client_secret: app.appSecret,
    code,
    redirect_uri: redirect,
  })
  if (!granted.access_token) throw new Error('no access token')

  const answer = await larkGet<{ data?: Record<string, unknown> }>(
    cloud,
    '/open-apis/authen/v1/user_info',
    granted.access_token,
  )
  const held = answer.data ?? {}
  const tenantKey = String(held.tenant_key ?? '')
  const openId = String(held.open_id ?? '')
  if (!tenantKey || !openId) throw new Error('no organisation')
  return {
    tenantKey,
    openId,
    unionId: String(held.union_id ?? ''),
    name: String(held.name ?? held.en_name ?? ''),
  }
}

// --- what the pane reads and writes -------------------------------------------

/** This account's connection, or null when it has none — and which clouds this build can
 *  offer at all. */
export async function readLarkConnection(
  env: Env,
  owner: Owner,
): Promise<{ connection: LarkConnection | null; clouds: LarkCloudOffer[] }> {
  const connection = await call<LarkConnection | null>(env, 'read_lark_connection', {
    p_subject: owner.accountId,
  })
  return { connection: connection ?? null, clouds: offers(env) }
}

/** The clouds this build carries an app for. Both are always listed: a pane that hid the one
 *  it cannot offer would leave a 飞书 team wondering whether AI4Kanban knows about 飞书. */
const offers = (env: Env): LarkCloudOffer[] =>
  (Object.keys(LARK_HOSTS) as LarkCloud[]).map((cloud) => ({
    cloud,
    name: LARK_HOSTS[cloud].name,
    configured: !!larkApp(env, cloud),
  }))

/** Where this account's messages go: the chats the bot is in, and the direct message with
 *  whoever connected. */
export async function listLarkChats(env: Env, owner: Owner): Promise<{ chats: LarkChat[] }> {
  const held = await heldConnection(env, owner)
  const token = await tenantToken(env, held.cloud, held.tenantKey)
  const answer = await larkGet<{ data?: { items?: { chat_id?: string; name?: string }[] } }>(
    held.cloud,
    '/open-apis/im/v1/chats?page_size=100',
    token,
  )
  const chats = (answer.data?.items ?? [])
    .filter((c): c is { chat_id: string; name: string } => !!c.chat_id)
    .map((c) => ({ id: c.chat_id, name: c.name || 'Unnamed group', direct: false }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Always offered, and always first: it is the one destination that cannot have been
  // dissolved or left, and it is where a card's reasoning goes when no room should have it.
  return { chats: [{ id: held.openId, name: DIRECT_MESSAGE, direct: true }, ...chats] }
}

/** Point it somewhere. Picking again is also how a refusal is cleared. */
export async function setLarkDestination(
  env: Env,
  owner: Owner,
  body: unknown,
): Promise<{ connection: LarkConnection }> {
  const input = (body ?? {}) as Record<string, unknown>
  const destinationId = typeof input.destinationId === 'string' ? input.destinationId.trim() : ''
  if (!destinationId) throw badRequest('That request names no chat.')
  const destinationName =
    typeof input.destinationName === 'string' ? input.destinationName.slice(0, 200) : ''

  const connection = await mutate<LarkConnection | null>(env, 'set_lark_destination', {
    p_subject: owner.accountId,
    p_destination_id: destinationId,
    p_destination_name: destinationName,
    p_direct: input.direct === true,
  })
  if (!connection) throw larkNotConnected()
  return { connection }
}

/**
 * End it.
 *
 * No board is touched: every event goes on exactly as it was, the bell keeps carrying all of
 * them, and a Slack connection beside this one keeps posting. Nothing is handed back to Lark
 * — the tenant's token is the app's, not this account's, and an uninstall in Lark is what
 * ends that.
 */
export async function disconnectLark(env: Env, owner: Owner): Promise<{ disconnected: true }> {
  await mutate(env, 'lark_disconnect', { p_subject: owner.accountId })
  return { disconnected: true }
}

/** Who a press in a chat is, resolved from the cloud, the tenant and the user together. Null
 *  is an actor we have no account for, which the callback answers with its own words rather
 *  than acting. */
export const larkActor = (
  env: Env,
  cloud: LarkCloud,
  tenantKey: string,
  openId: string,
): Promise<LarkActor | null> =>
  call<LarkActor | null>(env, 'lark_actor', {
    p_cloud: cloud,
    p_tenant_key: tenantKey,
    p_open_id: openId,
  })

/** Lark refused us. Recorded where the connection was made, because messages failing into
 *  silence read to the user as no work waiting. */
export const larkRefused = (env: Env, ownerId: string, error: string): Promise<unknown> =>
  mutate(env, 'lark_refused', { p_owner: ownerId, p_error: error })

/** The `app_ticket` the platform pushed. It is the app's, not any account's, and it is what
 *  every tenant token for that cloud is minted from. */
export const larkAppTicketPushed = (
  env: Env,
  cloud: LarkCloud,
  ticket: string,
): Promise<unknown> =>
  mutate(env, 'lark_app_ticket_pushed', { p_cloud: cloud, p_app_ticket: ticket })

async function heldConnection(
  env: Env,
  owner: Owner,
): Promise<{ cloud: LarkCloud; tenantKey: string; openId: string }> {
  const held = await call<{ cloud: LarkCloud; tenantKey: string; openId: string } | null>(
    env,
    'lark_connection_for',
    { p_subject: owner.accountId },
  )
  if (!held) throw larkNotConnected()
  return held
}

// --- the tenant's token -------------------------------------------------------

/**
 * The token this tenant's messages go out on, held in Cloud and renewed there.
 *
 * Three steps, and the first two are the app's rather than this account's: the pushed
 * `app_ticket` and the app's credentials mint an `app_access_token`, and that plus the
 * tenant's key mint the token below. A cloud whose ticket has never been pushed asks the
 * platform to push one and says so — that is the one failure a person cannot act on, and it
 * mends itself within the hour.
 */
export async function tenantToken(env: Env, cloud: LarkCloud, tenantKey: string): Promise<string> {
  const held = await call<{ token: string } | null>(env, 'lark_tenant_token', {
    p_cloud: cloud,
    p_tenant_key: tenantKey,
    p_skew_seconds: LARK_TOKEN_SKEW_SECONDS,
  })
  if (held?.token) return held.token

  const app = larkApp(env, cloud)
  if (!app) throw new Error(`no ${cloud} app`)
  const ticket = await call<{ appTicket: string } | null>(env, 'lark_app_ticket', { p_cloud: cloud })
  if (!ticket?.appTicket) {
    // Nothing to mint from. Asking for a push is the whole of the fix, and the next attempt
    // — this event's retry, or the hourly run — is what spends it.
    await larkPost(cloud, '/open-apis/auth/v3/app_ticket/resend', {
      app_id: app.appId,
      app_secret: app.appSecret,
    }).catch(() => undefined)
    throw new Error('no_app_ticket: this cloud has no app ticket yet')
  }

  const appToken = await larkPost<{ app_access_token?: string }>(
    cloud,
    '/open-apis/auth/v3/app_access_token',
    { app_id: app.appId, app_secret: app.appSecret, app_ticket: ticket.appTicket },
  )
  if (!appToken.app_access_token) throw new Error('lark answered without an app token')

  const minted = await larkPost<{ tenant_access_token?: string; expire?: number }>(
    cloud,
    '/open-apis/auth/v3/tenant_access_token',
    { app_access_token: appToken.app_access_token, tenant_key: tenantKey },
  )
  if (!minted.tenant_access_token) throw new Error('lark answered without a tenant token')
  await mutate(env, 'lark_tenant_token_minted', {
    p_cloud: cloud,
    p_tenant_key: tenantKey,
    p_token: minted.tenant_access_token,
    p_expires_in: Math.max(Number(minted.expire) || 0, 60),
  })
  return minted.tenant_access_token
}

// --- the open API -------------------------------------------------------------

/**
 * Lark answers 200 with `{ code, msg }` for a refusal, so the status is not the answer — the
 * body is. Its code is carried through in front of its own words: the code is what decides
 * whether a connection reads as revoked, and the words are what the pane shows.
 */
export async function larkCall<T>(
  cloud: LarkCloud,
  path: string,
  init: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${LARK_HOSTS[cloud].api}${path}`, init)
  } catch (e) {
    throw new Error(`lark unreachable: ${message(e)}`)
  }
  const answer = (await response.json().catch(() => ({}))) as {
    code?: number
    msg?: string
    error?: string
  }
  // The OAuth token endpoint answers `{ code: 0, access_token }` on success and a non-zero
  // code otherwise, the same as every other call.
  if (answer.code !== undefined && answer.code !== 0) {
    throw new Error(`${answer.code}: ${answer.msg || answer.error || 'refused'}`)
  }
  if (!response.ok) throw new Error(`lark answered ${response.status}`)
  return answer as T
}

const larkPost = <T>(cloud: LarkCloud, path: string, body: Record<string, unknown>): Promise<T> =>
  larkCall<T>(cloud, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

const larkGet = <T>(cloud: LarkCloud, path: string, token: string): Promise<T> =>
  larkCall<T>(cloud, path, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })

/** One call as the tenant, which is every call a message costs. */
export const larkAsTenant = <T>(
  cloud: LarkCloud,
  path: string,
  token: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<T> =>
  larkCall<T>(cloud, path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

/** Every ending of the redirect a person is looking at. Plain text, because whoever reads it
 *  is in a browser tab that has nothing else on it. */
const page = (words: string): Response =>
  new Response(`${words}\n`, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
