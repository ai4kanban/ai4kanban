// The account's Slack destination, as a screen moves it (#320).
//
// Slack is a fact about the ACCOUNT, like the sign-in and unlike everything else this board
// settles: one destination, shared by every board this account turns Cloud on for, with the
// board named on each message. So nothing here reads or writes anything in this repository.
//
// Nothing here holds a credential either. The token Cloud posts with is minted by Slack,
// handed straight to the service, and never comes back — which is the whole reason a
// connection is made through the browser rather than by pasting something into a box.
//
// Every call answers rather than throwing, like the rest of the Cloud client: a Configuration
// pane must draw whatever Cloud said, including that it could not be reached.

import {
  disconnectSlack as endConnection,
  listSlackConversations as listConversations,
  readSlackConnection as readConnection,
  setSlackDestination as setDestination,
  startSlackInstall,
} from './client'
import type { CloudMove, SlackConversation, SlackState } from './types'

export type { SlackConnection, SlackConversation, SlackState } from './types'

/** What the Cloud section draws for Slack: the connection, or the absence of one. */
export async function readSlackState(): Promise<SlackState> {
  const answer = await readConnection()
  if (!answer.ok) return { connection: null, configured: false, error: answer.error }
  return {
    connection: answer.value.connection ?? null,
    configured: answer.value.configured,
    error: null,
  }
}

/** The consent screen to open in the user's own browser. The answer comes back to the app
 *  on the same URL scheme a finished sign-in does. */
export async function startSlackConnect(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const answer = await startSlackInstall()
  return answer.ok ? { ok: true, url: answer.value.url } : { ok: false, error: answer.error }
}

/** Where this account's messages go. */
export async function readSlackConversations(): Promise<
  { ok: true; conversations: SlackConversation[] } | { ok: false; error: string }
> {
  const answer = await listConversations()
  return answer.ok
    ? { ok: true, conversations: answer.value.conversations }
    : { ok: false, error: answer.error }
}

/** Point it at one. Picking again is also how a refusal Slack raised is cleared. */
export async function setSlackChannel(channelId: string, channelName: string): Promise<CloudMove> {
  const answer = await setDestination(channelId, channelName)
  return answer.ok ? { ok: true } : { ok: false, error: answer.error }
}

/** Stop posting. No board is touched: every event goes on exactly as it was, and the bell
 *  keeps carrying all of them. */
export async function disconnectSlack(): Promise<CloudMove> {
  const answer = await endConnection()
  return answer.ok ? { ok: true } : { ok: false, error: answer.error }
}
