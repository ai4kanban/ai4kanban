// `akb cloud` — which account this machine acts as, and moving a board in or out.
//
// It reports and it signs out, and it carries a board into a workspace or writes one back
// out (#315). A sign-in is started from the desktop app's Configuration dialog and nowhere
// else (#326): the consent screen opens in the user's own browser and comes back to the app
// over its URL scheme, so a terminal has no address to be answered at. What a terminal does
// have is the file the app wrote, which is why an `akb` here acts as the same account with
// nothing else set up.
//
// Only import needs a board: it reads one. Reporting, signing out and export do not — the
// sign-in belongs to the machine rather than to any one project, and an export writes a board
// into the folder it is given.

import { readCloudAccount, signOutOfCloud } from '../lib/cloud/account'
import { readCloudBoards } from '../lib/cloud/boards'
import { listServers } from '../lib/cloud/client'
import { exportBoard, importBoard } from '../lib/cloud/workspace-board'
import type { CloudServer } from '../lib/cloud/servers'
import { readLarkState } from '../lib/cloud/lark'
import { readSlackState } from '../lib/cloud/slack'
import { thisMachine } from '../lib/machine/identity'
import { die } from '../lib/paths'
import { say } from '../lib/io'
import type { MoveResult } from '../lib/types'

export async function cmdCloud(args: string[], program: string): Promise<MoveResult> {
  const [sub, ...rest] = args
  if (sub === 'sign-out') {
    signOutOfCloud()
    say('Signed out. This machine no longer reaches Cloud; nothing on any board changed.')
    return { signedOut: true }
  }
  if (sub === 'import') return await moveIn(rest, program)
  if (sub === 'export') return await moveOut(rest, program)
  if (sub !== undefined) {
    die(
      `unknown \`cloud\` command "${sub}". Try \`${program} cloud\`, \`${program} cloud sign-out\`, ` +
        `\`${program} cloud import <workspace>\` or \`${program} cloud export <workspace> --to <folder>\`.`,
      { kind: 'unknown-move' },
    )
  }

  const account = await readCloudAccount()
  for (const line of report(account, program)) say(line)
  // Where this account's tasks arrive away from the app (#320, #351). Reported for the same
  // reason as the boards below: a terminal is where somebody wonders why nothing is
  // reaching a chat, and the answer is usually a destination that chat has refused.
  // Connecting one is the app's, under Configuration → Notifications.
  if (account.state === 'signed-in') {
    for (const line of await slackLines()) say(line)
    for (const line of await larkLines()) say(line)
  }
  // Which boards this machine publishes events for (#319). Reported here because it is a
  // fact about the machine, like the sign-in above, and because a terminal is where
  // somebody wonders why a board is or is not filling the bell. Turning one on is the
  // app's, under Configuration → Notifications.
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

/**
 * `akb cloud import <workspace>` — carry this board into a workspace.
 *
 * It only ever READS `docs/kanban/`: the board it copies is the board it leaves behind, and
 * the files stay the record. Run it again after an interruption and it carries on rather than
 * writing a second copy of anything.
 */
async function moveIn(args: string[], program: string): Promise<MoveResult> {
  const workspace = args[0]
  if (!workspace) die(`\`${program} cloud import\` needs the workspace to import into.`, { kind: 'bad-args' })
  const res = await importBoard(workspace, (line) => say(`  ${line}`))
  if (!res.ok) die(res.error, { kind: 'cloud-refused' })
  const { cards, documents, events, deliveries, resumed } = res.moved
  say(
    `${resumed ? 'Carried on' : 'Imported'}: ${cards} cards, ${documents} files, ` +
      `${events} history rows, ${deliveries} deliveries.`,
  )
  say('Nothing on this board changed — its files are still the record.')
  return { imported: res.moved }
}

/**
 * `akb cloud export <workspace> --to <folder>` — write a workspace back out as a markdown
 * board. It refuses a folder that already holds one, because an export is a restore and a
 * restore over a live board cannot be undone.
 *
 * `--to` is named every time and never defaulted: this writes a board rather than reading
 * one, so there is no project it is "about", and the folder it lands in is the one thing
 * nobody should have to guess at.
 */
async function moveOut(args: string[], program: string): Promise<MoveResult> {
  const workspace = args[0]
  if (!workspace) die(`\`${program} cloud export\` needs the workspace to export.`, { kind: 'bad-args' })
  const flag = args.indexOf('--to')
  const to = flag === -1 ? '' : (args[flag + 1] ?? '')
  if (!to) {
    die(`\`${program} cloud export ${workspace} --to <folder>\` — name the folder to write the board into.`, {
      kind: 'bad-args',
    })
  }
  const res = await exportBoard(workspace, to, (line) => say(`  ${line}`))
  if (!res.ok) die(res.error, { kind: 'cloud-refused' })
  say(`Exported to ${res.moved.dir}. \`${program} --dir ${to} raw list\` reads it as a Local board.`)
  return { exported: res.moved }
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
       'Connect again in the AI4Kanban app, under Configuration → Notifications.']
    : ['', `Slack posts to ${where}${held.teamName ? ` in ${held.teamName}` : ''}.`]
}

/** The same for Lark, and named by the cloud it was connected in — `飞书` and `Lark` are two
 *  platforms, and a person reading this knows which one they are in. Silent when there is no
 *  connection: an account that has never connected one is not missing anything. */
async function larkLines(): Promise<string[]> {
  const lark = await readLarkState()
  const held = lark.connection
  if (!held) return []
  const where = held.destinationName || 'nowhere yet — pick a chat in the app'
  return held.revoked
    ? ['', `${held.cloudName} refused the last message: ${held.lastError}`,
       'Connect again in the AI4Kanban app, under Configuration → Notifications.']
    : ['', `${held.cloudName} posts to ${where}.`]
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
          ? 'Sign in from the AI4Kanban app, under Configuration → Notifications. It is once per machine.'
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
      // Asking is a button in the app (#327). A terminal has none, so it says where it is.
      lines.push(
        account.inviteRequestedAt
          ? `You asked for an invite on ${account.inviteRequestedAt.slice(0, 10)}. We answer by email.`
          : 'Request an invite in the AI4Kanban app, under Configuration → Notifications.',
      )
      lines.push(`Sign out with \`${program} cloud sign-out\`.`)
      break
    case 'expired':
      lines.push(`Your Cloud sign-in as ${who} has expired.`)
      lines.push('Sign in again from the AI4Kanban app, under Configuration → Notifications.')
      break
  }
  if (account.error) lines.push(`Cloud could not be reached: ${account.error}`)
  return lines.filter(Boolean)
}
