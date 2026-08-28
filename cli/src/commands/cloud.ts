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
import { readCloudBoards } from '../lib/cloud/boards'
import { listServers } from '../lib/cloud/client'
import type { CloudServer } from '../lib/cloud/servers'
import { readSlackState } from '../lib/cloud/slack'
import { thisMachine } from '../lib/machine/identity'
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
  // Where this account's tasks arrive away from the app (#320). Reported for the same
  // reason as the boards below: a terminal is where somebody wonders why nothing is
  // reaching Slack, and the answer is usually a destination Slack has refused. Connecting
  // one is the app's, under Configuration → Cloud.
  if (account.state === 'signed-in') for (const line of await slackLines()) say(line)
  // Which boards this machine publishes events for (#319). Reported here because it is a
  // fact about the machine, like the sign-in above, and because a terminal is where
  // somebody wonders why a board is or is not filling the bell. Turning one on is the
  // app's, under Configuration → Cloud.
  const boards = account.state === 'signed-in' ? readCloudBoards() : []
  // And which machine runs each board's work (#318). A board attaches exactly one server,
  // and an approval taken anywhere runs there and nowhere else — so a terminal wondering why
  // an approval has not started is told which machine it is waiting for.
  const servers = boards.length > 0 ? await serversByBoard(boards.map((b) => b.id)) : new Map<string, CloudServer>()
  if (boards.length > 0) {
    const machine = thisMachine()
    say('')
    say(`Notifications are on for ${boards.length === 1 ? 'one board' : `${boards.length} boards`}:`)
    for (const board of boards) {
      const watching = board.release ? `watching ${board.release}` : 'no release picked, so nothing is raised'
      const server = servers.get(board.id)
      say(`  ${board.name} — ${watching}`)
      say(`    ${board.path}`)
      say(`    ${serverLine(server, machine?.name ?? '')}`)
      // And what that machine runs the board's runtimes as (#345). A board that names none
      // reports none, and so does a Cloud too old to hold them: both print nothing extra.
      for (const line of runtimeLines(server)) say(`      ${line}`)
    }
  }
  return { cloud: account, boards }
}

/** Where this account's messages go, and what Slack last said about it. Silent when there
 *  is no connection: an account that has never connected one is not missing anything. */
async function slackLines(): Promise<string[]> {
  const slack = await readSlackState()
  const held = slack.connection
  if (!held) return []
  const where = held.channelName || 'nowhere yet — pick a conversation in the app'
  return held.revoked
    ? ['', `Slack (${held.teamName}) refused the last message: ${held.lastError}`,
       'Connect again in the AI4Kanban app, under Configuration → Cloud.']
    : ['', `Slack posts to ${where}${held.teamName ? ` in ${held.teamName}` : ''}.`]
}

/** Which machine holds each board, by board id. Empty when Cloud cannot be reached — the
 *  line then says so rather than naming the wrong machine. */
async function serversByBoard(boardIds: string[]): Promise<Map<string, CloudServer>> {
  const answer = await listServers()
  if (!answer.ok) return new Map()
  const held = new Map<string, CloudServer>()
  for (const server of answer.value.servers) {
    if (boardIds.includes(server.boardId)) held.set(server.boardId, server)
  }
  return held
}

function serverLine(server: CloudServer | undefined, here: string): string {
  if (!server) return 'no machine runs its approvals, so an approval taken elsewhere waits'
  const holder = server.machineName || 'an unnamed machine'
  return holder === here ? 'approvals run on this machine' : `approvals run on ${holder}`
}

/** One line per runtime the board names: what that machine runs it as. A model is named only
 *  where that machine set one — a runtime on the agent's own default has no name to print. */
function runtimeLines(server: CloudServer | undefined): string[] {
  return (server?.runtimes ?? []).map((runtime) => {
    const what = runtime.model ? `${runtime.harness}, ${runtime.model}` : runtime.harness
    return `${runtime.name.padEnd(12)} ${what}${runtime.fallback ? ' (not bound)' : ''}`
  })
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
      // Both doors are in the app: a code is pasted there, and the button that asks for one
      // is there (#327). A terminal has neither, so it says where they are.
      lines.push(
        account.inviteRequestedAt
          ? `You asked for an invite on ${account.inviteRequestedAt.slice(0, 10)}. We answer by email.`
          : 'Redeem a code, or ask for one, in the AI4Kanban app under Configuration → Cloud.',
      )
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
