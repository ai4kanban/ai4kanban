import fs from 'node:fs'
import path from 'node:path'

import { killMarked, processesStopped, type Mark } from '../../cli/src/lib/agent/stop'
import { backoffMs } from '../../cli/src/lib/agent/retry'
import type { RunEvent } from '../../cli/src/lib/agent/wire'
import type { JobReport } from './api'
import { runnerHome } from './home'

export const PREPARE_REASON = 'Runner update prepare.'
export const UPDATE_REASON = 'Runner update checkpoint.'
export const UNCERTAIN = '更新中断时有操作结果尚未确认，请检查已有结果后再续跑。'

export interface Checkpoint {
  mark?: Mark
  process?: { pid: number; since: number }
  updating?: boolean
  session?: string
  started?: boolean
  opaque?: boolean
  effects?: boolean
  retry?: { since: number; attempt: number; at?: number }
  attempts?: (Pick<JobReport, 'session' | 'usage' | 'costUsd'> & { resume?: string | null })[]
  pending: string[]
  completed?: { outcome: 'done' | 'failed'; reason?: string; report: JobReport }
}

const fileOf = (id: string) => path.join(runnerHome(), 'checkpoints', `${encodeURIComponent(id)}.json`)

export function readCheckpoint(id: string): Checkpoint | null {
  try {
    const held = JSON.parse(fs.readFileSync(fileOf(id), 'utf8')) as Checkpoint
    if (!held || !Array.isArray(held.pending) || !held.pending.every((id) => typeof id === 'string')) throw new Error('进度格式错误')
    return held
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    // 损坏的进度不能当成从未执行。
    return { updating: true, started: true, pending: ['unknown'] }
  }
}

export function saveCheckpoint(id: string, checkpoint: Checkpoint): void {
  const file = fileOf(id)
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(checkpoint), { mode: 0o600 })
  fs.renameSync(`${file}.tmp`, file)
}

export function clearCheckpoint(id: string): void {
  fs.rmSync(fileOf(id), { force: true })
}

export function checkpointEvent(checkpoint: Checkpoint, event: RunEvent): void {
  if (event.kind === 'tool_call') {
    const { toolCallId, status, kind } = event.data
    if (!['read', 'search', 'fetch'].includes(kind)) checkpoint.effects = true
    if (['completed', 'failed'].includes(status)) checkpoint.pending = checkpoint.pending.filter((id) => id !== toolCallId)
    if (!['read', 'search', 'fetch'].includes(kind) && !['completed', 'failed'].includes(status)
      && !checkpoint.pending.includes(toolCallId)) checkpoint.pending.push(toolCallId)
  }
  if (event.kind === 'tool_call_update' && ['completed', 'failed'].includes(event.data.status)) {
    checkpoint.pending = checkpoint.pending.filter((id) => id !== event.data.toolCallId)
  }
}

/** 恢复前确认所有带本轮标记的进程已结束。 */
export async function stopReply(id: string, timeout: number): Promise<boolean> {
  const checkpoint = readCheckpoint(id)
  if (!checkpoint?.mark) return checkpoint?.started === false
  killMarked(checkpoint.mark, checkpoint.process)
  const until = Date.now() + timeout
  while (!processesStopped(checkpoint.mark, checkpoint.process)) {
    if (Date.now() >= until) return false
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return true
}

export function replyRetry(checkpoint: Checkpoint, reason: string, now = Date.now(), backoff = backoffMs): number | null {
  const retry = checkpoint.retry
  if (!retry || retry.attempt >= 3) return null
  const seconds = /retry[-_\s]?after["':=\s]+(\d+)/i.exec(reason)?.[1]
  const delay = seconds ? Number(seconds) * 1000 : backoff(retry.attempt + 1)
  const at = now + delay
  return at <= retry.since + 120_000 ? at : null
}

export function replayable(checkpoint: Checkpoint): boolean {
  return (checkpoint.effects === false || checkpoint.started === false) && !checkpoint.pending.length && !checkpoint.opaque
}

export function resumable(checkpoint: Checkpoint): boolean {
  return !!checkpoint.session && !checkpoint.pending.length && !checkpoint.opaque
}

/** Tokens are per attempt; Claude's prices remain session totals for Cloud to subtract. */
export function replySpent(checkpoint: Checkpoint, runtime: string): Pick<JobReport, 'usage' | 'costUsd' | 'attemptCosts'> {
  const attempts = checkpoint.attempts ?? []
  const used = attempts.filter(a => a.usage)
  const costed = attempts.filter(a => a.costUsd !== undefined)
  const sum = (key: keyof NonNullable<JobReport['usage']>) => used.reduce((n, a) => n + a.usage![key], 0)
  const spent = {
    ...(used.length ? { usage: { input: sum('input'), cacheCreation: sum('cacheCreation'), cacheRead: sum('cacheRead'), output: sum('output') } } : {}),
    ...(costed.length ? { costUsd: costed.reduce((n, a) => n + a.costUsd!, 0) } : {}),
  }
  if (runtime !== 'claude-code' || !attempts.length) return spent
  return {
    ...(spent.usage ? { usage: spent.usage } : {}),
    ...(attempts.at(-1)?.costUsd !== undefined ? { costUsd: attempts.at(-1)!.costUsd } : {}),
    attemptCosts: attempts.map(({ resume, session, costUsd }) => ({ resume, session, costUsd })),
  }
}
