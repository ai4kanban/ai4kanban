// ---- a marketing card's drafts and channels, as a screen asks for them (#411) ----
//
// The board UI draws a marketing topic with a tab strip over `source` and each chosen
// channel, that draft in an editor, and Repurpose and Publish beside it. Everything those
// four controls need is here, and nothing here is new behaviour: reading and writing a
// draft is `content/<id>-<slug>/<name>.md` (../content.ts), repurposing is the `channel`
// command with all of its own checks, and publishing is `raw channel-status`.
//
// Reading and writing a draft stays OUT of the board's operation contract on purpose. A
// draft is a file beside the board, not a card — a hosted board carries cards alone, and
// its screens answer `product` and never draw this block at all.
//
// A save is last-write-wins. The pane re-reads on focus and keeps what the user has typed,
// so a draft held open in both an editor and the board still loses whichever save landed
// second; a revision check here would refuse the save without giving that draft back.

import fs from 'node:fs'
import path from 'node:path'

import { cmdChannel } from '../../commands/channel'
import { board, withLease } from '../board'
import { locate } from '../cards'
import { CHANNEL_NAMES } from '../channels'
import { draftDir, draftFile, SOURCE } from '../content'
import { BoardError } from '../io'
import { die, rel, TODO } from '../paths'
import type { CardDraft, CardDrafts, ChannelStatus } from './types'

/** The names a draft may go by: the source, and the four channels. Anything else is a path
 *  nobody would look at, and is refused rather than written. */
const DRAFT_NAMES = [SOURCE, ...CHANNEL_NAMES]

/** The folder this card's drafts live in. Refuses a card the board does not hold — the id
 *  names the folder, so a wrong one writes somewhere no screen reads. */
function folderOf(id: number): { dir: string; cardFile: string } {
  const found = locate(id)
  if (!found || found.kind !== 'file') {
    die(`no topic with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  }
  return { dir: draftDir(found.target), cardFile: found.target }
}

function readOne(cardFile: string, name: string): CardDraft | null {
  const file = draftFile(cardFile, name)
  if (!fs.existsSync(file)) return null
  return { name, path: rel(file), text: fs.readFileSync(file, 'utf8') }
}

/** Which drafts this card has, each one whole — `source` first, then the channels in the
 *  order `lib/channels.ts` names them. A card nobody has written for answers with its
 *  folder and an empty list, which is a strip of `source` alone. */
export function readDrafts(id: number): CardDrafts {
  const { dir, cardFile } = folderOf(id)
  const drafts = DRAFT_NAMES.map((name) => readOne(cardFile, name)).filter((d): d is CardDraft => d !== null)
  return { dir: rel(dir), drafts }
}

/** Write one draft and hand the set back as it now reads. The folder is created on the way
 *  — the first save on a topic is what makes `content/<id>-<slug>/`. */
export function saveDraft(id: number, name: string, text: string): CardDrafts {
  if (!DRAFT_NAMES.includes(name)) {
    die(`no draft called "${name}". a card's drafts are: ${DRAFT_NAMES.join(', ')}.`, {
      kind: 'unknown-draft',
      draft: name,
      known: DRAFT_NAMES,
    })
  }
  const { cardFile } = folderOf(id)
  const file = draftFile(cardFile, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return readDrafts(id)
}

/** What a Repurpose click gets back. `kind` is the refusal's own name, so the pane can turn
 *  `draft-exists` into a confirmation and show every other refusal as it came. */
export interface RepurposeResult {
  ok: boolean
  sessionId?: string
  error?: string
  kind?: string
}

/**
 * Start the repurpose run for one channel — `akb channel <name> <id>`, and every check it
 * makes: the board is `marketing`, the name is a channel, the card chose it, `source.md`
 * exists, and an existing draft needs `--again`.
 *
 * It is the command itself and not a run started straight from the request, because those
 * checks are the point of the button: a second copy of them here would drift.
 */
export async function repurposeChannel(id: number, channel: string, again = false): Promise<RepurposeResult> {
  try {
    const res = await cmdChannel({ channel, id, again })
    const sessionId = typeof res.sessionId === 'string' ? res.sessionId : undefined
    return sessionId ? { ok: true, sessionId } : { ok: false, error: 'the repurpose did not start' }
  } catch (e) {
    if (e instanceof BoardError) return { ok: false, error: e.message, kind: e.kind }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Move one channel along, and record where the piece went up — `raw channel-status`, so
 *  the same write a terminal makes. It posts nothing: `published` says the piece is out and
 *  `url` is the link it is out at. */
export function setChannelStatus(id: number, channel: string, status: ChannelStatus, url = '') {
  return withLease({ card: id }, (env) =>
    board().runMove('channel-status', { args: [String(id), channel, status], opts: { url } }, env),
  )
}
