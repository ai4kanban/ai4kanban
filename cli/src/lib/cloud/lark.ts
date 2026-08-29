// The account's Lark destination, as a screen moves it (#351).
//
// Lark is a fact about the ACCOUNT, like Slack beside it: one destination, shared by every
// board this account turns Cloud on for, with the board named on each message. So nothing
// here reads or writes anything in this repository.
//
// Connecting names a cloud, because 飞书 and Lark international are two platforms that list
// two apps. Which one a connection came from is the connection's, and no board and no card
// ever learns about it.
//
// Nothing here holds a credential. The token Cloud posts with is minted inside the service
// per tenant and never comes back — which is why a connection is made through the browser
// rather than by pasting something into a box.
//
// Every call answers rather than throwing, like the rest of the Cloud client: a Configuration
// pane must draw whatever Cloud said, including that it could not be reached.

import {
  disconnectLark as endConnection,
  listLarkChats as listChats,
  readLarkConnection as readConnection,
  setLarkDestination as setDestination,
  startLarkConnect as startConnect,
} from './client'
import type { CloudMove, LarkChat, LarkCloud, LarkState } from './types'

export type { LarkChat, LarkCloud, LarkCloudOffer, LarkConnection, LarkState } from './types'

/** What the Cloud section draws for Lark: the connection, or the absence of one, and which
 *  clouds this service can offer at all. */
export async function readLarkState(): Promise<LarkState> {
  const answer = await readConnection()
  if (!answer.ok) return { connection: null, clouds: [], error: answer.error }
  return {
    connection: answer.value.connection ?? null,
    clouds: answer.value.clouds ?? [],
    error: null,
  }
}

/** The consent screen to open in the user's own browser, for one cloud. The answer comes back
 *  to the app on the same URL scheme a finished sign-in does. */
export async function startLarkConnection(
  cloud: LarkCloud,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const answer = await startConnect(cloud)
  return answer.ok ? { ok: true, url: answer.value.url } : { ok: false, error: answer.error }
}

/** Where this account's messages go. */
export async function readLarkChats(): Promise<
  { ok: true; chats: LarkChat[] } | { ok: false; error: string }
> {
  const answer = await listChats()
  return answer.ok ? { ok: true, chats: answer.value.chats } : { ok: false, error: answer.error }
}

/** Point it at one. Picking again is also how a refusal Lark raised is cleared. */
export async function setLarkChat(chat: LarkChat): Promise<CloudMove> {
  const answer = await setDestination(chat.id, chat.name, chat.direct)
  return answer.ok ? { ok: true } : { ok: false, error: answer.error }
}

/** Stop posting. No board is touched: every event goes on exactly as it was, a Slack
 *  connection beside this one keeps posting, and the bell keeps carrying all of them. */
export async function disconnectLark(): Promise<CloudMove> {
  const answer = await endConnection()
  return answer.ok ? { ok: true } : { ok: false, error: answer.error }
}
