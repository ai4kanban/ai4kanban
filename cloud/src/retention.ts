/**
 * The plans' keep (#2017): a finished task, its history and its previews go together once
 * the account's plan stops keeping them, and unused uploads go a day after they expire. Sorted
 * triage items leave its workspaces' boards on the same keep (#2107).
 * Files leave R2 before their rows, so a failed delete is retried next hour, never orphaned.
 */

import { call } from './db.ts'
import type { Env } from './env.ts'
import { SHORTEST_KEEP, readLimits } from './quota.ts'
import { expireTriage } from './triage.ts'

const ACCOUNTS_PER_RUN = 50
const TASKS_PER_ACCOUNT = 200
const UPLOADS_PER_RUN = 500
/** R2 deletes at most this many keys at once. */
const KEYS_PER_DELETE = 1000

export interface Expiry {
  tasks: number
  events: number
  jobs: number
  files: number
  uploads: number
  /** Sorted triage items (#2107). */
  triage: number
}

interface Expired {
  tasks: string[]
  files: string[]
  multipart: { key: string; id: string }[]
}

interface Abandoned {
  id: string
  key: string
  multipart_id: string | null
  uploaded: boolean
}

export async function expire(env: Env): Promise<Expiry> {
  const done: Expiry = { tasks: 0, events: 0, jobs: 0, files: 0, uploads: 0, triage: 0 }
  const bucket = env.ARTIFACTS
  const accounts = await call<string[]>(env, 'v1_expiring_accounts', { p_days: SHORTEST_KEEP, p_limit: ACCOUNTS_PER_RUN })
  for (const account of accounts) {
    try {
      const days = (await readLimits(env, account)).retentionDays
      const expired = await call<Expired>(env, 'v1_expired', { p_account: account, p_days: days, p_limit: TASKS_PER_ACCOUNT })
      if (bucket) {
        const keys = expired.files
        for (let at = 0; at < keys.length; at += KEYS_PER_DELETE) await bucket.delete(keys.slice(at, at + KEYS_PER_DELETE))
        await Promise.all(expired.multipart.map((m) => bucket.resumeMultipartUpload(m.key, m.id).abort().catch(() => {})))
      }
      done.files += expired.files.length
      const deleted = await call<Omit<Expiry, 'files' | 'uploads' | 'triage'>>(env, 'v1_delete_expired', {
        p_account: account,
        p_days: days,
        p_tasks: expired.tasks,
      })
      done.tasks += deleted.tasks
      done.events += deleted.events
      done.jobs += deleted.jobs
      if (env.BOARDS) {
        for (const workspace of await call<string[]>(env, 'v1_account_workspaces', { p_account: account })) {
          done.triage += await expireTriage(env, workspace, days)
        }
      }
    } catch (error) {
      console.error('cloud: expiry failed for an account', account, error)
    }
  }

  const abandoned = await call<Abandoned[]>(env, 'v1_abandoned_uploads', { p_limit: UPLOADS_PER_RUN })
  if (abandoned.length > 0) {
    if (bucket) {
      const files = abandoned.filter((u) => u.uploaded).map((u) => u.key)
      if (files.length > 0) await bucket.delete(files)
      await Promise.all(
        abandoned
          .filter((u) => !u.uploaded && u.multipart_id)
          .map((u) => bucket.resumeMultipartUpload(u.key, u.multipart_id!).abort().catch(() => {})),
      )
    }
    done.uploads = await call<number>(env, 'v1_drop_uploads', { p_ids: abandoned.map((u) => u.id) })
  }
  return done
}
