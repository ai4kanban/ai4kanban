// The task chats a Runner answered, kept on its computer (#2065): one JSON line per message in
// `<home>/chats/<task>.jsonl`. The Runner writes them; `akb review-memory --task` reads them.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'

export interface TaskChatLine {
  /** Cloud's id for the user's message; the job's for the reply. */
  id: string
  role: 'user' | 'agent'
  text: string
  /** When it was said, in ms. */
  at: number
  /** What replied, on the agent's line. */
  runtime?: string
  model?: string | null
}

const TASK = /^[\w-]{1,100}$/

export const taskChatsDir = (home = machineHome()) => path.join(home, 'chats')

export function taskChatFile(task: string, home?: string): string {
  if (!TASK.test(task)) throw new Error(`${task} is not a task id.`)
  return path.join(taskChatsDir(home), `${task}.jsonl`)
}

/** Oldest first; a line that does not read is skipped. */
export function readTaskChat(task: string, home?: string): TaskChatLine[] {
  let text: string
  try {
    text = fs.readFileSync(taskChatFile(task, home), 'utf8')
  } catch {
    return []
  }
  const lines: TaskChatLine[] = []
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    try {
      const line = JSON.parse(raw) as TaskChatLine
      if (typeof line.id === 'string' && (line.role === 'user' || line.role === 'agent') && typeof line.text === 'string') lines.push(line)
    } catch {
      // A torn write.
    }
  }
  return lines
}
