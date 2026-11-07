// The pictures a run is started with (#441, #511, #517). A box is renamed after the run when
// one starts, so the log prune takes a run's pictures with its log.

import fs from 'node:fs'
import path from 'node:path'

import { SESSIONS_DIR } from '../paths'

/** The file names a pictures folder is allowed to hold, so no caller can name a file outside one. */
export const pictureName = (name: string): boolean => /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(name)

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

/** Hand a box's pictures to the run that is starting: the folder is renamed after the run,
 *  and the paths come back in the order they went into the box. Empty for a run with no
 *  pictures, which is every run but a create or a **Start now** that was pasted into. */
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

/** Hand one run's pictures to the run that takes its place (#1321), so the log prune keeps
 *  them with the run that is still on the record. The paths as they now stand. */
export function moveRunPictures(from: string, to: string, files: string[] = []): string[] {
  if (files.length === 0) return []
  try {
    fs.renameSync(pictureBox(from), pictureBox(to))
  } catch {
    return files
  }
  return files.map((file) => path.join(pictureBox(to), path.basename(file)))
}
