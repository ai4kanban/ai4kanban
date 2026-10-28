/**
 * What deleted rows left behind (#2089): a project's board and the R2 files of its tasks.
 * Postgres queues them on delete; only what is cleared leaves the queue, so a failure is
 * retried next hour.
 */

import { boardOf } from './board.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'

const BOARDS_PER_RUN = 50
const FILES_PER_RUN = 5000
/** R2 deletes at most this many keys at once. */
const KEYS_PER_DELETE = 1000
/** R2's NoSuchUpload: the upload was completed or aborted already. */
const NO_SUCH_UPLOAD = /10024/

export async function clearDroppedBoards(env: Env): Promise<number> {
  if (!env.BOARDS) return 0
  const ids = await call<string[]>(env, 'v1_dropped_boards', { p_limit: BOARDS_PER_RUN })
  const done: string[] = []
  await Promise.all(ids.map((id) => boardOf(env, id).destroy().then(
    () => done.push(id),
    (e) => console.error('cloud: dropped board not destroyed', id, e),
  )))
  return done.length ? call<number>(env, 'v1_forget_boards', { p_ids: done }) : 0
}

export async function clearDroppedFiles(env: Env): Promise<number> {
  const bucket = env.ARTIFACTS
  if (!bucket) return 0
  const files = await call<{ key: string; multipart_id: string | null }[]>(env, 'v1_dropped_files', { p_limit: FILES_PER_RUN })
  const done: string[] = []
  const whole = files.filter((f) => !f.multipart_id).map((f) => f.key)
  for (let at = 0; at < whole.length; at += KEYS_PER_DELETE) {
    const keys = whole.slice(at, at + KEYS_PER_DELETE)
    try {
      await bucket.delete(keys)
      done.push(...keys)
    } catch (e) {
      console.error('cloud: dropped files not deleted', e)
    }
  }
  await Promise.all(files.filter((f) => f.multipart_id).map((f) =>
    bucket.resumeMultipartUpload(f.key, f.multipart_id!).abort()
      .catch((e) => { if (!NO_SUCH_UPLOAD.test(String(e))) throw e })
      .then(() => done.push(f.key), (e) => console.error('cloud: dropped upload not aborted', f.key, e))))
  return done.length ? call<number>(env, 'v1_forget_files', { p_keys: done }) : 0
}
