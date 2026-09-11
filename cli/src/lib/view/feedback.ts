// ---- what a piece of feedback may carry (#603) -------------------------------
//
// Feedback about a landed task is worth little without what the task actually did, and that
// is all on this machine: the card in `.archive/`, the conversation and the run logs in this
// board's own folder on the machine (#590), and the same system facts an anonymous event
// already carries.
//
// Nothing here sends anything. It reads the four parts, says how large each is, and hands
// back exactly the text that would go — so the preview on screen IS the submission, and a
// part removed there is a part the sender never sees. Defaults are decided by the screen,
// which opens with every authorisation unticked.

import fs from 'node:fs'
import path from 'node:path'

import { FEEDBACK_PARTS, LIMITS } from '../../../../telemetry/contract'
import type { FeedbackPart } from '../../../../telemetry/contract'
import { SKILL_VERSION } from '../../version'
import { readChat } from '../agent/chat'
import { DELIVERIES, REPO_ROOT } from '../paths'
import { readArchivedCard } from './archive'

export interface FeedbackAttachment {
  part: FeedbackPart
  /** The whole of what would be sent for this part. Empty means there is nothing to send,
   *  and the screen leaves the row out rather than offering an empty attachment. */
  text: string
  /** What it comes to, in bytes. */
  bytes: number
  /** True when this machine held more than the cap and the rest was left behind. The screen
   *  says so beside the size rather than letting a cut pass unmentioned. */
  cut: boolean
}

/** Every part this card has something to attach, in the order the screen lists them. */
export interface FeedbackDiagnostics {
  cardId: number
  attachments: FeedbackAttachment[]
}

/**
 * What could be attached to feedback about one archived card.
 *
 * A part with nothing behind it — no conversation was held, no delivery ran — is left out
 * altogether. A part that would be huge is cut to `feedbackPartBytes` and says so; a run log
 * for one delivery runs to megabytes, and a submission nobody could send is worse than a
 * truncated one.
 */
export function readFeedbackDiagnostics(cardId: number): FeedbackDiagnostics {
  const attachments: FeedbackAttachment[] = []
  for (const part of FEEDBACK_PARTS) {
    const text = partText(part, cardId)
    if (!text) continue
    attachments.push(cut(part, text))
  }
  return { cardId, attachments }
}

function partText(part: FeedbackPart, cardId: number): string {
  if (part === 'card') return cardText(cardId)
  if (part === 'chat') return chatText(cardId)
  if (part === 'trace') return traceText(cardId)
  return environmentText()
}

/** The archived card, title and body. */
function cardText(cardId: number): string {
  const card = readArchivedCard(cardId)
  if (!card) return ''
  return `# ${card.id} ${card.title}\n\n${card.body}\n`
}

/** The conversation held on that card, as it reads on screen. Pictures are named, never
 *  carried: an attachment is text, and the four rows on screen say text. */
function chatText(cardId: number): string {
  const chat = readChat(cardId)
  if (!chat || chat.messages.length === 0) return ''
  const lines = chat.messages.map((message) => {
    const images = message.images?.length ? `\n[${message.images.length} image(s)]` : ''
    return `## ${message.role}\n${message.text}${images}`
  })
  return `${lines.join('\n\n')}\n`
}

/** The runs of the newest delivery on that card, oldest run first. The logs are this
 *  machine's raw agent output — which is exactly why this part is authorised on its own and
 *  previewable line by line before it goes. */
function traceText(cardId: number): string {
  const record = newestDelivery(cardId)
  if (!record) return ''
  const blocks: string[] = []
  for (const session of record.sessions) {
    if (!session.log) continue
    const file = path.isAbsolute(session.log) ? session.log : path.join(REPO_ROOT, session.log)
    let text: string
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (!text.trim()) continue
    blocks.push(`## ${session.action} ${session.status}\n${text}`)
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : ''
}

/** The same facts an anonymous event already carries — no more, and nothing about the
 *  project around the board. */
function environmentText(): string {
  const record = process.platform
  const named: Record<string, string> = { darwin: 'macos', win32: 'windows', linux: 'linux' }
  const lines = [`os: ${named[record] ?? record}`, `arch: ${process.arch}`, `version: ${SKILL_VERSION}`]
  const harness = newestHarness()
  if (harness) lines.push(`harness: ${harness}`)
  return `${lines.join('\n')}\n`
}

interface DeliveryFile {
  cardId?: unknown
  startedAt?: unknown
  sessions?: { action?: unknown; status?: unknown; harness?: unknown; log?: unknown }[]
}

interface DeliveryRead {
  startedAt: number
  sessions: { action: string; status: string; harness: string; log: string }[]
}

/** The newest delivery recorded against that card, or null. The permanent record is a file
 *  per delivery under `docs/kanban/deliveries/`, kept after the card is archived — which is
 *  what makes a landed task's runs findable at all. */
function newestDelivery(cardId: number): DeliveryRead | null {
  let files: string[]
  try {
    files = fs.readdirSync(DELIVERIES).filter((name) => name.endsWith('.json'))
  } catch {
    return null
  }
  let newest: DeliveryRead | null = null
  for (const name of files) {
    let data: DeliveryFile
    try {
      data = JSON.parse(fs.readFileSync(path.join(DELIVERIES, name), 'utf8')) as DeliveryFile
    } catch {
      continue
    }
    if (data.cardId !== cardId) continue
    const read: DeliveryRead = {
      startedAt: typeof data.startedAt === 'number' ? data.startedAt : 0,
      sessions: (Array.isArray(data.sessions) ? data.sessions : []).map((session) => ({
        action: typeof session.action === 'string' ? session.action : 'run',
        status: typeof session.status === 'string' ? session.status : '',
        harness: typeof session.harness === 'string' ? session.harness : '',
        log: typeof session.log === 'string' ? session.log : '',
      })),
    }
    if (!newest || read.startedAt > newest.startedAt) newest = read
  }
  return newest
}

/** The connector the newest delivery on this board ran on. Absent when nothing has. */
function newestHarness(): string {
  let files: string[]
  try {
    files = fs.readdirSync(DELIVERIES).filter((name) => name.endsWith('.json'))
  } catch {
    return ''
  }
  let at = 0
  let harness = ''
  for (const name of files) {
    let data: DeliveryFile
    try {
      data = JSON.parse(fs.readFileSync(path.join(DELIVERIES, name), 'utf8')) as DeliveryFile
    } catch {
      continue
    }
    const started = typeof data.startedAt === 'number' ? data.startedAt : 0
    if (started < at) continue
    const named = (Array.isArray(data.sessions) ? data.sessions : [])
      .map((session) => (typeof session.harness === 'string' ? session.harness : ''))
      .filter(Boolean)
      .at(-1)
    if (!named) continue
    at = started
    harness = named
  }
  return harness
}

/** One part, cut to what the endpoint will take.
 *
 *  A trace keeps its TAIL — the last lines of a run are where a build went wrong — and every
 *  other part keeps its head, which is where a card and a conversation say what they are
 *  about. `bytes` stays the size this machine holds, so the screen can say how much was left
 *  behind. The cut lands on a character boundary: the preview IS the submission, and half a
 *  character is neither. */
function cut(part: FeedbackPart, text: string): FeedbackAttachment {
  const bytes = Buffer.byteLength(text)
  if (bytes <= LIMITS.feedbackPartBytes) return { part, text, bytes, cut: false }
  const whole = Buffer.from(text)
  const kept =
    part === 'trace'
      ? whole.subarray(whole.length - LIMITS.feedbackPartBytes + leadingPartial(whole, whole.length - LIMITS.feedbackPartBytes))
      : whole.subarray(0, LIMITS.feedbackPartBytes - trailingPartial(whole, LIMITS.feedbackPartBytes))
  return { part, text: kept.toString('utf8'), bytes, cut: true }
}

/** Bytes to step forward from `at` to reach the start of a character. */
function leadingPartial(whole: Buffer, at: number): number {
  let step = 0
  while (step < 4 && at + step < whole.length && (whole[at + step]! & 0b1100_0000) === 0b1000_0000) step += 1
  return step
}

/** Bytes to drop from before `end` so the last character kept is a whole one. */
function trailingPartial(whole: Buffer, end: number): number {
  let back = 0
  while (back < 4 && end - back - 1 >= 0) {
    const byte = whole[end - back - 1]!
    if ((byte & 0b1100_0000) !== 0b1000_0000) {
      // A lead byte says how many bytes its character runs to; a single ASCII byte, none.
      const width = byte < 0x80 ? 1 : byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : 2
      return back + 1 === width ? 0 : back + 1
    }
    back += 1
  }
  return 0
}
