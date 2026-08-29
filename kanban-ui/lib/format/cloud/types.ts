// Copied from cli/src/lib/cloud/types.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// The Cloud sign-in, as a screen or a terminal reads it (#326).
//
// One account per MACHINE, not per board: the app, the board UI server it starts and an
// `akb` in a terminal all read the one session file, so they act as the same person. A
// sign-in is started in the app's Configuration dialog and nowhere else.
//
// Pure types, no imports — so the board UI takes a copy (scripts/sync-format.mjs) and names
// the same shapes the command does.

/** The four answers a sign-in can come back with, and nothing else.
 *
 *  `not-admitted` is deliberately not `expired`: Cloud is an invite-only preview, and
 *  signing in again lands on the very same refusal. */
export type CloudState = 'signed-out' | 'signed-in' | 'not-admitted' | 'expired'

/** Who this machine acts as, and whether Cloud takes its work. */
export interface CloudAccount {
  state: CloudState
  /** The handle the identity provider attests — never anything the account can rewrite.
   *  What #320 links a Slack actor to. */
  handle: string | null
  name: string | null
  avatarUrl: string | null
  /** The picture itself, as a `data:` URL this machine already holds, so a screen draws the
   *  account without reaching the provider. Null when there is none to draw. */
  avatarData: string | null
  email: string | null
  /** The service's own words for a refusal, shown as they stand. Null when there is none. */
  message: string | null
  /** When this account last asked for an invite and has not been answered (#327). Null when
   *  it never asked. The not-admitted pane shows it in place of the button, so pressing again
   *  neither writes a second request nor sends a second email. */
  inviteRequestedAt: string | null
  /** Where the sign-in is held on this machine, named on screen. */
  sessionFile: string
  /** Whether this build knows a Cloud project to sign in against at all. */
  configured: boolean
  /** Cloud could not be reached. `state` is what this machine last knew. */
  error?: string
}

/** What a press in the not-admitted pane comes back with (#327). The service's own words on
 *  a refusal, shown as they stand — the same rule the refusal itself follows. */
export type CloudMove = { ok: true } | { ok: false; error: string }

// --- Slack (#320) -------------------------------------------------------------
// The account's one destination: a workspace it was connected to, and the conversation it
// posts to. Like the sign-in above it is a fact about the ACCOUNT, not about a board —
// every board Cloud is on for posts here, with the board named on each message.
//
// The bot token is deliberately absent. It never leaves the service, so a token that never
// reaches a client cannot leak from one.

/** What the Cloud section draws for Slack. */
export interface SlackConnection {
  connected: true
  /** The workspace, as Slack names it. */
  teamName: string
  channelId: string
  /** The conversation, as it is named on screen — `#a-channel`, or `Direct message`. */
  channelName: string
  /** The Slack user whose presses are this account's. */
  slackUserId: string
  /** Slack refused us — the app was removed, the token revoked, the destination gone. The
   *  pane says so where the connection was made: messages failing into silence read as no
   *  work waiting. */
  revoked: boolean
  /** Slack's own word for that refusal, shown as it stands. */
  lastError: string
}

/** What the Cloud section knows about Slack: the connection, or the absence of one, and
 *  whether this service carries a Slack app to connect at all. */
export interface SlackState {
  connection: SlackConnection | null
  /** False when the service has no Slack app — the pane says so rather than offering a
   *  button that cannot finish. */
  configured: boolean
  /** Cloud could not be reached, or refused. Null when there is nothing to say. */
  error: string | null
}

/** One conversation a destination can be pointed at. */
export interface SlackConversation {
  id: string
  name: string
  /** A direct message rather than a channel, so a card's reasoning need not go to a room. */
  direct: boolean
}

// --- Lark / 飞书 (#351) --------------------------------------------------------
// A second destination beside Slack, and a fact about the ACCOUNT in the same way: one Lark
// destination, shared by every board this account turns Cloud on for, with the board named on
// each message.
//
// 飞书 and Lark international are two platforms rather than two addresses of one, so a
// connection records which cloud it came from. Nothing else does: no board and no card ever
// learns about it.
//
// No credential is here either. The token Cloud posts with is minted per tenant inside the
// service and never comes back.

/** The two clouds a connection can be made in. */
export type LarkCloud = 'feishu' | 'lark'

/** What the Cloud section draws for Lark. */
export interface LarkConnection {
  connected: true
  cloud: LarkCloud
  /** What a person calls that cloud — `飞书` or `Lark`. */
  cloudName: string
  /** Who connected it, as Lark names them. Their press is this account's. */
  userName: string
  destinationId: string
  /** The destination, as it is named on screen — a group's name, or `Direct message`. */
  destinationName: string
  /** The direct message with whoever connected, rather than a group. */
  direct: boolean
  /** Lark refused us — the tenant uninstalled the app, or the destination is gone. The pane
   *  says so where the connection was made: messages failing into silence read as no work
   *  waiting. */
  revoked: boolean
  /** Lark's own words for that refusal, shown as they stand. */
  lastError: string
}

/** One cloud the pane offers, in the order it draws them. */
export interface LarkCloudOffer {
  cloud: LarkCloud
  name: string
  /** False when the service carries no app for that cloud — the pane says so rather than
   *  offering a button that cannot finish. */
  configured: boolean
}

/** What the Cloud section knows about Lark: the connection, or the absence of one, and which
 *  clouds this service can offer at all. */
export interface LarkState {
  connection: LarkConnection | null
  clouds: LarkCloudOffer[]
  /** Cloud could not be reached, or refused. Null when there is nothing to say. */
  error: string | null
}

/** One chat a destination can be pointed at. */
export interface LarkChat {
  id: string
  name: string
  /** The direct message with whoever connected, rather than a group. */
  direct: boolean
}
