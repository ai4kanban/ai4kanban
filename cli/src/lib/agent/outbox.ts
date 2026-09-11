// What a run tells the board, written inside the project (#622).
//
// A run's agent is a child process, and a sandboxed one may write the project and nothing
// else. Two things it does have to reach the board: the cards `akb raw create` wrote, so
// **Build now** can take its card and the run's close can refine them, and the plan file
// `akb raw plan new` named, so Discuss shows it. Both used to be written straight into the
// machine folder, which is exactly the folder the sandbox refuses.
//
// So the run writes them here instead — one small JSON file per report, under the project's
// own `.akb/` — and the process WATCHING the run collects them and does the machine write
// on the run's behalf (agent/watch.ts). Every run reports this way, whether or not the
// machine folder happens to be writable: one path, so nothing depends on the sandbox.
//
// A report is written once and read once. The collector deletes each file as it applies it,
// and the run's folder goes with the run.

import fs from 'node:fs'
import path from 'node:path'

import { AKB_DIR, ensureAkbDir } from '../paths'
import { insideRun } from './env'
import type { ChatTarget } from './types'

const RUNS = 'runs'

/** The cards one `akb raw create` wrote. */
export interface CardsReport {
  kind: 'cards'
  ids: number[]
}

/** The plan one `akb raw plan new` named, and the conversation it belongs to. */
export interface PlanReport {
  kind: 'plan'
  path: string
  title?: string
  /** The discussion the plan was written in, or null for the board's own conversation. */
  target: ChatTarget
}

export type RunReport = CardsReport | PlanReport

/** Where one run's reports wait. */
export const outboxDir = (sessionId: string): string => path.join(AKB_DIR, RUNS, sessionId)

/** Write one report for the run this process is working inside. Nothing happens outside a
 *  run — there is no board process waiting to collect it — and nothing happens when the
 *  project itself refuses the write: a report that cannot be left is one the board never
 *  hears, and the move it belonged to still succeeded.
 *
 *  True when a report was written. */
export function report(entry: RunReport): boolean {
  const sessionId = insideRun()
  if (!sessionId) return false
  try {
    ensureAkbDir()
    const dir = outboxDir(sessionId)
    fs.mkdirSync(dir, { recursive: true })
    // Named for when it was written and by whom, so two `akb` commands in one run never
    // land on one name and the collector reads them in the order they were made.
    const name = `${Date.now()}-${process.pid}-${fs.readdirSync(dir).length}.json`
    const tmp = path.join(dir, `.${name}`)
    fs.writeFileSync(tmp, `${JSON.stringify(entry)}\n`)
    // Rename rather than write in place: the collector runs while the run does, and a file
    // it catches half-written is a report it would drop.
    fs.renameSync(tmp, path.join(dir, name))
    return true
  } catch {
    return false
  }
}

/** Take everything one run has reported so far, oldest first, and remove it from the
 *  outbox. Each report comes back once, so a collector running twice never applies one
 *  twice. Empty for a run that has said nothing. */
export function takeReports(sessionId: string): RunReport[] {
  const dir = outboxDir(sessionId)
  let names: string[]
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort()
  } catch {
    return []
  }
  const out: RunReport[] = []
  for (const name of names) {
    const file = path.join(dir, name)
    let held: unknown
    try {
      held = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // Damaged, or gone between the listing and the read. Either way there is nothing to
      // apply, and leaving it would have every later collection trip over it.
      held = null
    }
    fs.rmSync(file, { force: true })
    const entry = readReport(held)
    if (entry) out.push(entry)
  }
  return out
}

/** Forget one run's outbox — its reports are collected and the run is over. */
export function dropOutbox(sessionId: string): void {
  fs.rmSync(outboxDir(sessionId), { recursive: true, force: true })
}

// A report is a file a child process wrote, so nothing in it is believed on sight.
function readReport(held: unknown): RunReport | null {
  const raw = held as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object') return null
  if (raw.kind === 'cards') {
    const listed = Array.isArray(raw.ids) ? (raw.ids as unknown[]) : []
    const ids = listed.filter((id): id is number => Number.isInteger(id) && (id as number) > 0)
    return ids.length ? { kind: 'cards', ids } : null
  }
  if (raw.kind === 'plan' && typeof raw.path === 'string' && raw.path) {
    const target = raw.target
    if (target !== null && typeof target !== 'string' && !Number.isInteger(target)) return null
    const title = typeof raw.title === 'string' ? raw.title : undefined
    return { kind: 'plan', path: raw.path, title, target: target as ChatTarget }
  }
  return null
}
