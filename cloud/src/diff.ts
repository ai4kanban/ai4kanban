// A landed commit's diff (#2109), read from the computer it landed on each time a page asks:
// the page's request waits in a `DiffCall`, the Runner is hinted, and its answer is handed to
// the waiting page. Nothing of it is stored — not in Postgres, R2 or the object's storage.

import { call } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, commitGone, machineOffline, notFound, serviceUnavailable } from './errors.ts'
import { json } from './http.ts'

/** How long a page waits on the Runner before the computer counts as offline. */
const WAIT_MS = 15_000
const MAX_FILES = 5000
const MAX_PATH = 1024
/** Past either, only the file list and its line counts are shown. */
export const FILE_BYTES = 256 * 1024
export const TOTAL_BYTES = 1024 * 1024
const STATUSES = ['added', 'modified', 'deleted'] as const

export interface DiffFile {
  path: string
  status: (typeof STATUSES)[number]
  added: number
  removed: number
  binary?: boolean
  patch?: string
}

export type DiffAnswer = { files: DiffFile[]; truncated: boolean } | { gone: true }

interface Landing {
  commit: string
  project: string
  owner: string
  machine: string
  online: boolean
}

interface Waiting {
  owner: string
  machine: string
  project: string
  commit: string
  request: string
}

export class DiffCall {
  private readonly env: Env
  private expected: Waiting | null = null
  private answered: ((answer: DiffAnswer) => void) | null = null

  constructor(_state: DurableObjectState, env: Env) {
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>
    if (new URL(request.url).pathname === '/wait') {
      const waiting = body as unknown as Waiting
      this.expected = waiting
      const answer = new Promise<DiffAnswer>((resolve) => (this.answered = resolve))
      try {
        await call(this.env, 'hint_runner_diff', {
          p_owner: waiting.owner, p_request: waiting.request, p_project: waiting.project, p_commit: waiting.commit,
        })
      } catch {
        return Response.json(null)
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), WAIT_MS)))
      const got = await Promise.race([answer, late])
      clearTimeout(timer)
      this.answered = null
      return Response.json(got)
    }
    const from = this.expected
    if (!from || !this.answered || body.owner !== from.owner || body.machine !== from.machine) return Response.json({ answered: false })
    this.answered(body.answer as DiffAnswer)
    return Response.json({ answered: true })
  }
}

/** `GET /v1/tasks/{id}/diff`: the landed commit's diff, from the computer holding it. */
export async function readTaskDiff(env: Env, account: string, task: string): Promise<Response> {
  const landing = await call<Landing | null>(env, 'v1_task_landing', { p_account: account, p_task: task })
  if (!landing) throw notFound('This task landed no commit.')
  if (!landing.online) throw machineOffline()
  if (!env.DIFF_CALLS) throw serviceUnavailable()
  const request = crypto.randomUUID()
  const waiting: Waiting = { owner: landing.owner, machine: landing.machine, project: landing.project, commit: landing.commit, request }
  const response = await env.DIFF_CALLS.get(env.DIFF_CALLS.idFromName(request)).fetch('https://diff-call/wait', {
    method: 'POST',
    body: JSON.stringify(waiting),
  })
  const answer = (await response.json()) as DiffAnswer | null
  if (!answer) throw machineOffline()
  if ('gone' in answer) throw commitGone()
  return json({ object: 'diff', commit: landing.commit, ...answer })
}

/** `POST /v1/runner/diffs/{request}`: the Runner's answer, handed to the page waiting on it. */
export async function answerDiff(env: Env, owner: string, request: string, body: Record<string, unknown>): Promise<unknown> {
  if (!env.DIFF_CALLS) throw serviceUnavailable()
  if (!/^[0-9a-f-]{36}$/.test(request)) throw notFound()
  const response = await env.DIFF_CALLS.get(env.DIFF_CALLS.idFromName(request)).fetch('https://diff-call/answer', {
    method: 'POST',
    body: JSON.stringify({ owner, machine: body.machineId, answer: diffAnswer(body) }),
  })
  return response.json()
}

/** The Runner's answer, checked; patches past the limits are dropped, leaving the file list. */
export function diffAnswer(body: Record<string, unknown>): DiffAnswer {
  if (body.gone === true) return { gone: true }
  if (!Array.isArray(body.files) || body.files.length > MAX_FILES) throw badRequest('A diff is a list of files.')
  const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0)
  const files: DiffFile[] = body.files.map((f) => {
    const held = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>
    const status = STATUSES.find((s) => s === held.status)
    if (typeof held.path !== 'string' || !held.path || held.path.length > MAX_PATH || !status) throw badRequest('A diff file names its path and status.')
    return {
      path: held.path,
      status,
      added: count(held.added),
      removed: count(held.removed),
      ...(held.binary === true ? { binary: true } : {}),
      ...(typeof held.patch === 'string' ? { patch: held.patch } : {}),
    }
  })
  const sizes = files.map((f) => (f.patch ? new TextEncoder().encode(f.patch).length : 0))
  const truncated = body.truncated === true || sizes.some((n) => n > FILE_BYTES) || sizes.reduce((a, b) => a + b, 0) > TOTAL_BYTES
  return { files: truncated ? files.map(({ patch: _patch, ...f }) => f) : files, truncated }
}
