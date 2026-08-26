// `akb cloud` — which account this machine acts as.
//
// It reports and it signs out, and that is the whole of it. A sign-in is started from the
// desktop app's Configuration dialog and nowhere else (#326): the consent screen opens in
// the user's own browser and comes back to the app over its URL scheme, so a terminal has
// no address to be answered at. What a terminal does have is the file the app wrote, which
// is why an `akb` here acts as the same account with nothing else set up.
//
// It needs no board: the sign-in belongs to the machine, not to any one project.

import { readCloudAccount, signOutOfCloud } from '../lib/cloud/account'
import { die } from '../lib/paths'
import { say } from '../lib/io'
import type { MoveResult } from '../lib/types'

export async function cmdCloud(args: string[], program: string): Promise<MoveResult> {
  const [sub] = args
  if (sub === 'sign-out') {
    signOutOfCloud()
    say('Signed out. This machine no longer reaches Cloud; nothing on any board changed.')
    return { signedOut: true }
  }
  if (sub !== undefined) {
    die(`unknown \`cloud\` command "${sub}". Try \`${program} cloud\` or \`${program} cloud sign-out\`.`, {
      kind: 'unknown-move',
    })
  }

  const account = await readCloudAccount()
  for (const line of report(account, program)) say(line)
  return { cloud: account }
}

function report(account: Awaited<ReturnType<typeof readCloudAccount>>, program: string): string[] {
  const who = account.handle
    ? `@${account.handle}${account.name ? ` (${account.name})` : ''}`
    : 'this account'
  const lines: string[] = []
  switch (account.state) {
    case 'signed-out':
      lines.push('Not signed in to Cloud. Nothing on this machine reaches it.')
      lines.push(
        account.configured
          ? 'Sign in from the AI4Kanban app, under Configuration → Cloud. It is once per machine.'
          : account.message ?? '',
      )
      break
    case 'signed-in':
      lines.push(`Signed in to Cloud as ${who}.`)
      lines.push(`Held at ${account.sessionFile}, for this whole machine.`)
      lines.push(`Sign out with \`${program} cloud sign-out\`.`)
      break
    case 'not-admitted':
      lines.push(`Signed in as ${who}, and not admitted.`)
      if (account.message) lines.push(account.message)
      lines.push(`Sign out with \`${program} cloud sign-out\`.`)
      break
    case 'expired':
      lines.push(`Your Cloud sign-in as ${who} has expired.`)
      lines.push('Sign in again from the AI4Kanban app, under Configuration → Cloud.')
      break
  }
  if (account.error) lines.push(`Cloud could not be reached: ${account.error}`)
  return lines.filter(Boolean)
}
