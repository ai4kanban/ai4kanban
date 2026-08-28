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
