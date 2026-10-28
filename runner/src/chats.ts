// The task chats this computer answered (#2065): kept here as they are answered and dropped
// after CHAT_KEEP_DAYS, as Cloud drops its own. Once a day the archived tasks Cloud says this
// computer answered last, with a message not yet reviewed, are reviewed for memory: one review
// job per project, which only this computer runs.

import fs from 'node:fs'
import path from 'node:path'

import { CHAT_KEEP_DAYS } from '../../cloud/src/config.ts'
import { readTaskChat, taskChatFile, taskChatsDir, type TaskChatLine } from '../../cli/src/lib/agent/task-chats'
import * as api from './api'
import type { Job } from './api'
import { runnerHome } from './home'

const DAY_MS = 24 * 60 * 60_000
/** How often the chats are reviewed; inside the days they are kept, or one could go unread. */
export const REVIEW_EVERY_MS = DAY_MS
const KEEP_MS = CHAT_KEEP_DAYS * DAY_MS

/** The last message reviewed of each task, and when the review was last asked for. */
interface Reviewed {
  checkedAt: number
  tasks: { [task: string]: string }
}

const home = () => runnerHome()
const reviewedFile = () => path.join(taskChatsDir(home()), 'reviewed.json')

function readReviewed(): Reviewed {
  try {
    const held = JSON.parse(fs.readFileSync(reviewedFile(), 'utf8')) as Partial<Reviewed>
    return { checkedAt: Number(held.checkedAt) || 0, tasks: held.tasks ?? {} }
  } catch {
    return { checkedAt: 0, tasks: {} }
  }
}

function writeReviewed(reviewed: Reviewed): void {
  fs.mkdirSync(path.dirname(reviewedFile()), { recursive: true })
  fs.writeFileSync(reviewedFile(), `${JSON.stringify(reviewed, null, 2)}\n`)
}

/** A chat's reply, kept beside the message it answers. */
export function keepChat(job: Job, reply: string | undefined, at = Date.now()): void {
  if (!job.task || !job.chat || !reply?.trim()) return
  const lines: TaskChatLine[] = [
    { id: job.chat.message, role: 'user', text: job.chat.body, at },
    { id: job.id, role: 'agent', text: reply, at, runtime: job.runtime, model: job.model ?? null },
  ]
  const file = taskChatFile(job.task, home())
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(''))
}

/** A chat as Cloud keeps it, over what this computer kept: another may have answered part of it. */
export function keepCloudChat(task: string, messages: { id: string; role: 'user' | 'agent'; body: string; created_at: string }[]): void {
  const file = taskChatFile(task, home())
  if (!messages.length) return fs.rmSync(file, { force: true })
  const lines: TaskChatLine[] = messages.map((m) => ({ id: m.id, role: m.role, text: m.body, at: Date.parse(m.created_at) || Date.now() }))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(''))
}

const tasksKept = (): string[] => {
  try {
    return fs.readdirSync(taskChatsDir(home())).map((n) => /^([\w-]{1,100})\.jsonl$/.exec(n)?.[1]).filter((t): t is string => !!t)
  } catch {
    return []
  }
}

/** Drop what is past the days kept; a chat left with nothing goes with what was reviewed of it. */
export function pruneChats(now = Date.now()): void {
  const reviewed = readReviewed()
  let changed = false
  for (const task of tasksKept()) {
    const lines = readTaskChat(task, home())
    const kept = lines.filter((l) => now - l.at < KEEP_MS)
    if (kept.length === lines.length) continue
    const file = taskChatFile(task, home())
    if (kept.length) fs.writeFileSync(file, kept.map((l) => `${JSON.stringify(l)}\n`).join(''))
    else {
      fs.rmSync(file, { force: true })
      delete reviewed.tasks[task]
      changed = true
    }
  }
  if (changed) writeReviewed(reviewed)
}

const lastOf = (task: string) => readTaskChat(task, home()).at(-1)

/** Each task's last message now: what a review that passes marks reviewed. */
export const reviewMarks = (tasks: string[]): { [task: string]: string } =>
  Object.fromEntries(tasks.flatMap((t) => (lastOf(t) ? [[t, lastOf(t)!.id]] : [])))

export function markReviewed(marks: { [task: string]: string }): void {
  const reviewed = readReviewed()
  writeReviewed({ ...reviewed, tasks: { ...reviewed.tasks, ...marks } })
}

/** The tasks of a review that have something here to read. */
export const withChats = (tasks: string[]): string[] => tasks.filter((t) => lastOf(t))

/** Once a day: a review job for each project holding chats this computer answered last that
 *  were not reviewed since their last message. Not reached, it tries again on the next call. */
export async function reviewChats(machineId: string, now = Date.now()): Promise<void> {
  const reviewed = readReviewed()
  if (now - reviewed.checkedAt < REVIEW_EVERY_MS) return
  pruneChats(now)
  const waiting = tasksKept().filter((t) => {
    const last = lastOf(t)
    return last && last.id !== reviewed.tasks[t]
  })
  if (waiting.length) {
    const owned = await api.listChats(machineId)
    if (!owned.ok) return
    const byProject = new Map<string, string[]>()
    for (const { task, project } of owned.value.chats) {
      if (waiting.includes(task)) byProject.set(project, [...(byProject.get(project) ?? []), task])
    }
    // Cloud takes 100 a review; the rest wait for the next day.
    for (const [project, tasks] of [...byProject].map(([p, t]) => [p, t.slice(0, 100)] as const)) {
      // On what replied last.
      const replied = tasks.flatMap((t) => readTaskChat(t, home())).filter((l) => l.runtime).sort((a, b) => a.at - b.at).at(-1)
      const runtime = (replied?.runtime ?? 'claude-code') as Job['runtime']
      const sent = await api.dispatchReview(machineId, project, tasks, runtime, replied?.model ?? null)
      if (!sent.ok) console.error(`runner: the chats of ${project} were not sent for review: ${sent.error}`)
    }
  }
  writeReviewed({ ...readReviewed(), checkedAt: now })
}
