// The pictures a box holds before they are sent (#441, #511, #517).
//
// Two boxes keep them, and both keep them the same way: a conversation's, beside its
// transcript (agent/chat.ts), and the create sheet's, beside the run logs — which is this
// module's own. What travels between a browser, a record and a prompt is a NAME, never a
// path, so nothing outside a folder the board itself wrote can ever be named.
//
// The create sheet's pictures are written as they are pasted, under a box the sheet holds,
// and the box is renamed after the run when one starts. That is the whole of why they are
// in `sessions/`: the log prune then takes a run's pictures with its log, and nothing has
// to remember them separately.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { SESSIONS_DIR } from '../paths'

/** The file names a pictures folder is allowed to hold: what `savePicture` writes and
 *  nothing else, so neither a transcript nor a caller can name a file outside one. */
export const pictureName = (name: string): boolean => /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(name)

// What a picture is filed under, by what the browser said it was. Anything else is refused
// rather than saved under a made-up name: an agent opens these by extension.
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}

/** Save one picture into a folder and answer with the name it is filed under. Never throws:
 *  a picture that couldn't be written is one thing to say in the box, and the paste is then
 *  turned away rather than the window failing. */
export function savePicture(dir: string, data: Uint8Array, type: string): { name: string } | { error: string } {
  const ext = IMAGE_TYPES[type.toLowerCase()]
  if (!ext) return { error: `${type || 'that'} is not a picture this board can send.` }
  if (!data.length) return { error: 'that picture arrived empty.' }
  const name = `${randomUUID()}.${ext}`
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, name), data)
  } catch (e) {
    return { error: `that picture could not be saved: ${e instanceof Error ? e.message : String(e)}` }
  }
  return { name }
}

// ---- the create sheet's box (#517) ------------------------------------------
//
// A box is named by a uuid the sheet mints when it opens, so two windows never paste into
// one folder, and the name is checked here because it comes from a browser.

const boxId = (box: string): boolean => /^[0-9a-f-]{36}$/.test(box)

/** A box a sheet may still write to. A folder a RUN already owns is not one — it is named
 *  after that run, and its id is the same shape a box is, so a stale window naming it would
 *  otherwise write into a build in flight or carry its pictures off. */
export const freeBox = (box: string): boolean =>
  boxId(box) && !fs.existsSync(path.join(SESSIONS_DIR, `${box}.log`))

/** Where one box's pictures sit. Named after the RUN once one has started, which is what
 *  puts them under the log prune (agent/log.ts). */
export const pictureBox = (box: string): string => path.join(SESSIONS_DIR, `${box}.images`)

/** Save one picture pasted into the create sheet. */
export function addRunPicture(
  box: string,
  data: Uint8Array,
  type: string,
): { name: string } | { error: string } {
  if (!freeBox(box)) return { error: 'that picture box is not one this board wrote.' }
  return savePicture(pictureBox(box), data, type)
}

/** Take one picture back out of the box before it is sent. Its file goes with it. */
export function dropRunPicture(box: string, name: string): void {
  if (!freeBox(box)) return
  const file = runPictureFile(box, name)
  if (file) fs.rmSync(file, { force: true })
}

/** Where one of a box's pictures is on disk, or null when it is not there — for the one
 *  route that serves its bytes to the browser. */
export function runPictureFile(box: string, name: string): string | null {
  if (!boxId(box) || !pictureName(name)) return null
  const file = path.join(pictureBox(box), name)
  return fs.existsSync(file) ? file : null
}

/** Empty a box whole — the sheet was closed without sending, so nothing is left behind. */
export function emptyRunBox(box: string): void {
  if (freeBox(box)) fs.rmSync(pictureBox(box), { recursive: true, force: true })
}

/** Hand a box's pictures to the run that is starting: the folder is renamed after the run,
 *  and the paths come back in the order they went into the box. Empty for a run with no
 *  pictures, which is every run but a create or a **Build now** that was pasted into. */
export function claimRunPictures(box: string | undefined, sessionId: string, names: string[] = []): string[] {
  if (!box || !freeBox(box) || names.length === 0) return []
  const from = pictureBox(box)
  const to = pictureBox(sessionId)
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    fs.renameSync(from, to)
  } catch {
    return []
  }
  return names
    .filter(pictureName)
    .map((name) => path.join(to, name))
    .filter((file) => fs.existsSync(file))
}

/** Put them back where the box had them, for a run that was refused after they were
 *  claimed — the sheet is still up with its words, and its thumbnails still draw. */
export function returnRunPictures(sessionId: string, box: string | undefined): void {
  if (!box || !boxId(box)) return
  try {
    fs.renameSync(pictureBox(sessionId), pictureBox(box))
  } catch {
    // Nothing was claimed, or the box is gone — either way there is nothing to put back.
  }
}
