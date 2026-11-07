// The task chats this computer answered (#2065): kept here as they are answered and dropped
// after CHAT_KEEP_DAYS, as Cloud drops its own. Once a day the archived tasks Cloud gives this
// computer, chat or none (#165), are reviewed for memory unless already reviewed as they stand:
// one review job per project, which only this computer runs.

import fs from 'node:fs'
import path from 'node:path'

import { CHAT_KEEP_DAYS } from '../../cli/src/lib/shared/chats.ts'
import { readTaskChat, taskChatFile, taskChatsDir, type TaskChatLine } from '../../cli/src/lib/agent/task-chats'
import * as api from './api'
import type { Job } from './api'
import { runnerHome } from './home'

const DAY_MS = 24 * 60 * 60_000
/** How often the chats are reviewed; inside the days they are kept, or one could go unread. */
export const REVIEW_EVERY_MS = DAY_MS
const KEEP_MS = CHAT_KEEP_DAYS * DAY_MS

/** What a review of a task read: the archiving it followed and the chat's last message, if any. */
export interface ReviewMark {
  archivedAt: string
  message?: string
}

/** What was reviewed of each task, and when the review was last asked for. */
interface Reviewed {
  checkedAt: number
  tasks: { [task: string]: ReviewMark }
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

/** What the user wrote on a task's reviews, among its chat by when it was said (#212). Not
 *  reached, the review goes on what is kept. */
export async function keepDecisions(task: string, read: typeof api.readDecisions): Promise<void> {
  const comments: TaskChatLine[] = []
  let after: string | null = null
  do {
    const page = await read(task, after)
    if (!page.ok) return
    for (const d of page.value.data) {
      if (d.comment.trim()) comments.push({ id: d.id, role: 'user', text: d.comment, at: Date.parse(d.created_at) || Date.now() })
    }
    after = page.value.next
  } while (after)
  if (!comments.length) return
  const ids = new Set(comments.map((c) => c.id))
  const lines = [...readTaskChat(task, home()).filter((l) => !ids.has(l.id)), ...comments].sort((a, b) => a.at - b.at)
  const file = taskChatFile(task, home())
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

/** Drop what is past the days kept. */
export function pruneChats(now = Date.now()): void {
  for (const task of tasksKept()) {
    const lines = readTaskChat(task, home())
    const kept = lines.filter((l) => now - l.at < KEEP_MS)
    if (kept.length === lines.length) continue
    const file = taskChatFile(task, home())
    if (kept.length) fs.writeFileSync(file, kept.map((l) => `${JSON.stringify(l)}\n`).join(''))
    else fs.rmSync(file, { force: true })
  }
}

const lastOf = (task: string) => readTaskChat(task, home()).at(-1)

/** Each task's mark now: what a review that passes writes. */
export const reviewMarks = (tasks: { task: string; archivedAt: string }[]): { [task: string]: ReviewMark } =>
  Object.fromEntries(tasks.map(({ task, archivedAt }) => {
    const last = lastOf(task)
    return [task, last ? { archivedAt, message: last.id } : { archivedAt }]
  }))

export function markReviewed(marks: { [task: string]: ReviewMark }): void {
  const reviewed = readReviewed()
  writeReviewed({ ...reviewed, tasks: { ...reviewed.tasks, ...marks } })
}

/** Once a day: a review job for each project holding archived tasks of this computer's, new or
 *  with a message since their review. Not reached, it tries again on the next call. */
export async function reviewChats(machineId: string, runtimes: api.RuntimeReport[], now = Date.now()): Promise<void> {
  const reviewed = readReviewed()
  if (now - reviewed.checkedAt < REVIEW_EVERY_MS) return
  pruneChats(now)
  const owned = await api.listChats(machineId)
  if (!owned.ok) return
  const byProject = new Map<string, string[]>()
  for (const { task, project, archivedAt } of owned.value.chats) {
    const mark = reviewed.tasks[task]
    const last = lastOf(task)
    if (mark?.archivedAt === archivedAt && (!last || last.id === mark.message)) continue
    byProject.set(project, [...(byProject.get(project) ?? []), task])
  }
  const signedIn = runtimes.find((r) => r.installed && r.loggedIn !== false)?.name
  // Cloud takes 100 a review; the rest wait for the next day.
  for (const [project, tasks] of [...byProject].map(([p, t]) => [p, t.slice(0, 100)] as const)) {
    // On what replied last, and with no reply on this computer's first.
    const replied = tasks.flatMap((t) => readTaskChat(t, home())).filter((l) => l.runtime).sort((a, b) => a.at - b.at).at(-1)
    const runtime = (replied?.runtime ?? signedIn ?? 'claude-code') as Job['runtime']
    const sent = await api.dispatchReview(machineId, project, tasks, runtime, replied?.model ?? null)
    if (!sent.ok) console.error(`runner: the chats of ${project} were not sent for review: ${sent.error}`)
  }
  // Cloud no longer lists a task once it is past the days kept; what was reviewed of it goes then.
  const listed = new Set(owned.value.chats.map((c) => c.task))
  const held = readReviewed()
  writeReviewed({ checkedAt: now, tasks: Object.fromEntries(Object.entries(held.tasks).filter(([t]) => listed.has(t))) })
}
