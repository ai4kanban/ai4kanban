// One partner submission, as this machine holds it (#628).
//
// The user says something is wrong in Discuss, links a card and ticks share. From there two
// different things are working on the same submission — the `feedback` agent, writing its
// reading of what went wrong, and the screen, waiting to say whether it landed — so the
// submission is a FILE rather than a value either of them holds. One file per discussion,
// beside the transcripts and out of git.
//
// The id is minted once and reused for every attempt. It is what the user is shown, what
// they quote to have the pack deleted, and what the service keys the object by — so a retry
// that minted a second id would be a second pack nobody could delete with the number they
// were given.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { CASE_ALPHABET } from '../../../../telemetry/contract'
import type { SentCase } from '../../../../telemetry/contract'
import { CASES } from '../paths'

/** How far one submission has got.
 *
 *  `collecting` also covers the agent having asked a question instead: it has not settled
 *  which refine this is about, so nothing has been collected and nothing has been sent. The
 *  screen reads that as the conversation carrying on, which is what it is. */
export type CaseStatus = 'collecting' | 'sent' | 'failed'

/** Why a submission did not go, as something a screen says in its own language. */
export type CaseFailure = 'too-large' | 'refused' | 'unreachable' | 'nothing-collected'

export interface CaseRecord {
  /** The number the user is shown and quotes to have it deleted. */
  id: string
  /** The discussion it was written in. */
  discussion: string
  /** The card they linked. */
  cardId: number
  /** What they wrote. Kept so **Send the question description only** has something to send
   *  after the pack it was collected for was refused. */
  text: string
  status: CaseStatus
  reason?: CaseFailure
  /** Everything the pack could not establish, as the agent and the collection named it. */
  gaps?: string[]
  startedAt: number
  sentAt?: number
  /** Where the built pack is, once one has been built. A retry posts THIS file again rather
   *  than collecting a second time. */
  packFile?: string
}

const recordFile = (discussion: string): string => path.join(CASES, `${safe(discussion)}.json`)

/** The pack itself, beside the record. Its own file: it runs to megabytes, and nothing that
 *  polls the record should be reading those. */
export const packFile = (id: string): string => path.join(CASES, `${id}.pack.json`)

/** A discussion id as a filename. The ids the board mints are already plain, so this only
 *  ever refuses something that was never one of ours. */
const safe = (discussion: string): string => discussion.replace(/[^A-Za-z0-9._-]/g, '_')

/** The submission this discussion is holding, or null. */
export function readCase(discussion: string): CaseRecord | null {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(recordFile(discussion), 'utf8'))
  } catch {
    return null
  }
  const raw = data as Partial<CaseRecord>
  if (!raw || typeof raw.id !== 'string' || typeof raw.cardId !== 'number') return null
  return {
    id: raw.id,
    discussion,
    cardId: raw.cardId,
    text: typeof raw.text === 'string' ? raw.text : '',
    status: raw.status === 'sent' || raw.status === 'failed' ? raw.status : 'collecting',
    reason: raw.reason,
    gaps: Array.isArray(raw.gaps) ? raw.gaps.filter((g): g is string => typeof g === 'string') : undefined,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    sentAt: typeof raw.sentAt === 'number' ? raw.sentAt : undefined,
    packFile: typeof raw.packFile === 'string' ? raw.packFile : undefined,
  }
}

function write(record: CaseRecord): CaseRecord {
  fs.mkdirSync(CASES, { recursive: true })
  const file = recordFile(record.discussion)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n')
  fs.renameSync(tmp, file)
  return record
}

/**
 * Open a submission on this discussion, or pick the one already there back up.
 *
 * Picking one back up is what makes a retry safe: the id, and with it the object the service
 * writes, is the one the user was already shown. A submission that already landed is left
 * exactly as it is — pressing send again in the same discussion is a new question about the
 * same card, not a second copy of a pack that is already with us.
 */
export function openCase(discussion: string, cardId: number, text: string): CaseRecord {
  const held = readCase(discussion)
  if (held?.status === 'sent') return held
  return write({
    id: held?.id ?? mintId(),
    discussion,
    cardId,
    text,
    status: 'collecting',
    startedAt: held?.startedAt ?? Date.now(),
    ...(held?.packFile ? { packFile: held.packFile } : {}),
  })
}

/** Record how an attempt ended. `gaps` is kept on a failure too — the next attempt sends the
 *  same pack, and what it could not establish has not changed. */
export function closeCase(
  discussion: string,
  ended: { status: CaseStatus; reason?: CaseFailure; gaps?: string[]; packFile?: string },
): CaseRecord | null {
  const held = readCase(discussion)
  if (!held) return null
  return write({
    ...held,
    status: ended.status,
    ...(ended.reason ? { reason: ended.reason } : { reason: undefined }),
    ...(ended.gaps ? { gaps: ended.gaps } : {}),
    ...(ended.packFile ? { packFile: ended.packFile } : {}),
    ...(ended.status === 'sent' ? { sentAt: Date.now() } : {}),
  })
}

/** Take the submission off this discussion — what cancelling the link does. A pack already
 *  sent is not withdrawn by it; the id in the transcript is how that one is deleted. */
export function dropCase(discussion: string): void {
  const held = readCase(discussion)
  if (held?.packFile) fs.rmSync(held.packFile, { force: true })
  fs.rmSync(recordFile(discussion), { force: true })
}

/** Write the pack this submission would post, and say where it went. */
export function savePack(pack: SentCase): string {
  fs.mkdirSync(CASES, { recursive: true })
  const file = packFile(pack.id)
  fs.writeFileSync(file, JSON.stringify(pack))
  return file
}

/** Read one back, for a retry. */
export function readPack(file: string): SentCase | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as SentCase
  } catch {
    return null
  }
}

/** `fb_` and eight characters the user can read off a screen and type into an email — the
 *  alphabet has no pair anyone confuses. Drawn from `randomUUID` rather than `Math.random`
 *  so two machines submitting in the same second do not collide on one object. */
function mintId(): string {
  const hex = randomUUID().replace(/-/g, '')
  let id = ''
  for (let at = 0; at < 8; at += 1) {
    id += CASE_ALPHABET[parseInt(hex.slice(at * 2, at * 2 + 2), 16) % CASE_ALPHABET.length]
  }
  return `fb_${id}`
}
