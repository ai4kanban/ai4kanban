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
//
// `image` and `tts` generate through Cloud on the user's Pro credits (#1119). Their messages
// are bilingual because an agent relays them to the user as they are; exit 2 is a usage error.

import fs from 'node:fs'
import path from 'node:path'

import { readCloudAccount, signOutOfCloud } from '../lib/cloud/account'
import { readCloudBoards } from '../lib/cloud/boards'
import { listServers } from '../lib/cloud/client'
import { cloudEndpoints } from '../lib/cloud/config'
import { accessToken } from '../lib/cloud/session'
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
  const { cards, documents, deliveries, resumed } = res.moved
  say(`${resumed ? 'Carried on' : 'Imported'}: ${cards} cards, ${documents} files, ${deliveries} deliveries.`)
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
      // Asking is a button in the app (#327). A terminal has none, so it says where it is.
      lines.push(
        account.inviteRequestedAt
          ? `You asked for an invite on ${account.inviteRequestedAt.slice(0, 10)}. We answer by email.`
          : 'Request an invite in the AI4Kanban app, under Configuration → Cloud.',
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

// ---- generation ---------------------------------------------------------------------

type Said = { zh: string; en: string }

const SAID = {
  'signed-out': {
    zh: '未登录 AI4Kanban Cloud。请在 AI4Kanban 应用的“配置 → Cloud”中登录后重试。',
    en: 'Not signed in to AI4Kanban Cloud. Sign in from Configuration → Cloud in the AI4Kanban app, then try again.',
  },
  expired: {
    zh: 'AI4Kanban Cloud 登录已过期。请在 AI4Kanban 应用的“配置 → Cloud”中重新登录后重试。',
    en: 'Your AI4Kanban Cloud sign-in has expired. Sign in again from Configuration → Cloud in the AI4Kanban app, then try again.',
  },
  unreachable: {
    zh: '无法连接 AI4Kanban Cloud。请检查网络后重试。',
    en: 'Could not reach AI4Kanban Cloud. Check your connection and try again.',
  },
  credits_used_up: {
    zh: '本月积分已用完，下月 1 日（UTC）重置；可在桌面应用的 Billing 页查看余额。',
    en: 'This month’s AI credits are used up. They reset on the 1st of next month (UTC); check your balance on the Billing page in the desktop app.',
  },
} satisfies Record<string, Said>

interface Generation {
  usage: string
  endpoint: string
  body: Record<string, unknown>
  out: string
  pro_required: Said
  failed: Said
  /** The other way to get the same thing, offered with every failure. */
  fallback: Said
  /** What the success line names in brackets after the file. */
  label: (res: Response) => string
}

const REF_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function usage(problem: string, line: string): never {
  die(`${problem}\nusage: ${line}`, { kind: 'bad-args', bare: true, exitCode: 2 })
}

/** `akb cloud image --aspect <ratio> [--ref <file>]… --out <file.png> "<prompt>"` */
export async function cloudImage(
  opts: { aspect?: string; refs: string[]; out?: string; prompt: string },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud image --aspect <ratio> [--ref <file>]… --out <file.png> "<prompt>"`
  if (!opts.aspect) usage('Missing --aspect.', line)
  if (!opts.out) usage('Missing --out.', line)
  const prompt = opts.prompt.trim()
  if (!prompt) usage('Missing the prompt.', line)
  const references = opts.refs.map((file) => {
    const type = REF_TYPES[path.extname(file).toLowerCase()]
    if (!type) usage(`--ref ${file}: use a PNG, JPEG or WebP file.`, line)
    try {
      return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
    } catch (e) {
      usage(`--ref ${file}: ${e instanceof Error ? e.message : String(e)}`, line)
    }
  })
  return generate({
    usage: line,
    endpoint: '/v1/image',
    body: { prompt, aspect: opts.aspect, references },
    out: opts.out,
    pro_required: {
      zh: '生成封面是 Pro 功能。升级 Pro：https://ai4kanban.dev/pricing',
      en: 'Generated covers are a Pro feature. Upgrade at https://ai4kanban.dev/pricing',
    },
    failed: { zh: '封面暂时无法生成，请稍后重试。', en: 'The cover could not be generated right now. Try again later.' },
    fallback: {
      zh: '也可以改用素材排版制作封面。',
      en: 'You can also lay out the cover from existing material instead.',
    },
    label: (res) => res.headers.get('x-model') ?? 'unknown model',
  })
}

/** `akb cloud tts --voice <name> --out <file.wav> "<text>"` — never falls back to another voice. */
export async function cloudTts(
  opts: { voice?: string; out?: string; text: string },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud tts --voice <name> --out <file.wav> "<text>"`
  if (!opts.voice) usage('Missing --voice.', line)
  if (!opts.out) usage('Missing --out.', line)
  const text = opts.text.trim()
  if (!text) usage('Missing the text to speak.', line)
  const voice = opts.voice
  return generate({
    usage: line,
    endpoint: '/v1/speech',
    body: { voice, text },
    out: opts.out,
    pro_required: {
      zh: '托管声音是 Pro 功能。升级 Pro：https://ai4kanban.dev/pricing',
      en: 'Hosted voices are a Pro feature. Upgrade at https://ai4kanban.dev/pricing',
    },
    failed: {
      zh: '托管声音暂时无法生成旁白，请稍后重试。',
      en: 'Hosted voices could not generate the narration right now. Try again later.',
    },
    fallback: {
      zh: '也可以改用本地声音（`npx hyperframes tts --list`）。',
      en: 'You can also use a local voice instead (`npx hyperframes tts --list`).',
    },
    label: (res) => res.headers.get('x-voice') ?? voice,
  })
}

function refuse(m: Said, fallback: Said): never {
  die([m.zh, m.en, fallback.zh, fallback.en].join('\n'), { kind: 'cloud-refused', bare: true })
}

async function generate(g: Generation): Promise<MoveResult> {
  const token = await accessToken()
  if (!token.ok) refuse(SAID[token.reason], g.fallback)
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}${g.endpoint}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(g.body),
    })
  } catch {
    refuse(SAID.unreachable, g.fallback)
  }
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    if (res.status === 401) refuse(SAID.expired, g.fallback)
    if (error?.code === 'pro_required') refuse(g.pro_required, g.fallback)
    if (error?.code === 'credits_used_up') refuse(SAID.credits_used_up, g.fallback)
    if (res.status === 400) usage(error?.message ?? 'The request was refused.', g.usage)
    refuse(g.failed, g.fallback)
  }
  fs.mkdirSync(path.dirname(path.resolve(g.out)), { recursive: true })
  fs.writeFileSync(g.out, Buffer.from(await res.arrayBuffer()))
  say(`${g.out} (${g.label(res)})`)
  return { out: g.out }
}
