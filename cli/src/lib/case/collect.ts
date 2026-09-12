// Finding the refine a case is about, and packing what would reproduce it (#628).
//
// The split runs through the whole file. The AGENT reads: it decides which refine the user
// means, it finds that harness's own raw trace wherever that CLI keeps it, and it says which
// project files the refine read and what it saw that on. The PROGRAM checks: no path leaves
// the project, no file is counted twice, no trace is believed to be there because somebody
// said so, and nothing that could not be established is dropped instead of being written
// down as a gap.
//
// Nothing here reads a harness's store. That is the point of handing the clues over: a case
// is not limited to the connectors this release happens to know, and no path table in here
// goes stale behind one.

import fs from 'node:fs'
import path from 'node:path'

import { LIMITS } from '../../../../telemetry/contract'
import type { SentCase, SentCaseFile, SentCaseRun } from '../../../../telemetry/contract'
import { SKILL_VERSION } from '../../version'
import { git } from '../agent/worktree'
import { readRuns } from '../agent/store'
import type { AgentAction, RunRecord } from '../agent/types'
import { usageDay, usageSurface } from '../machine/usage'
import { ENV_FILE, REPO_ROOT } from '../paths'
import type { CaseRecord } from './state'

/** The actions that ARE a refine: the QA passes, the spec agents they ask for, and the pass
 *  that settles the writing. A flow holding none of these is not a refine, whatever else it
 *  did on the card. */
const REFINE_ACTIONS = new Set<AgentAction>(['clarify', 'spec', 'writing'])

/** How much of one trace goes. A refine's trace runs to megabytes and the whole pack has a
 *  ceiling, so the tail is kept — where a refine settled the card is the end of it — and the
 *  cut is written down as a gap rather than passed off as the whole thing. */
const TRACE_BYTES = 4 * 1024 * 1024

/** One run of a refine, with everything the agent needs to find that harness's own trace of
 *  it. Every field here is the board's own record of the run — nothing is guessed. */
export interface CaseClue {
  sessionId: string
  action: AgentAction
  startedAt: number
  endedAt?: number
  status: string
  harness: string
  runtime?: string
  resumeId?: string
  cwd?: string
  argv?: string[]
  version?: string
  input?: string
  specAgent?: string
}

/** One candidate refine on a card — the flow, and every run it went on. */
export interface CaseRefine {
  flowId: string
  startedAt: number
  endedAt: number
  /** What the card was called when this refine ran, as its own runs recorded the input. */
  runs: CaseClue[]
}

/**
 * The refines recorded against one card, newest first.
 *
 * This is the whole of what the agent picks from. More than one is the ordinary case — a
 * card is refined again every time it is answered — and picking between them is a question
 * about the card's own content, which is why the guide has the agent ask in the user's words
 * rather than showing them this list.
 */
export function refinesOf(cardId: number): CaseRefine[] {
  const byFlow = new Map<string, RunRecord[]>()
  for (const run of readRuns()) {
    if (run.cardId !== cardId || !run.flowId) continue
    const held = byFlow.get(run.flowId)
    if (held) held.push(run)
    else byFlow.set(run.flowId, [run])
  }
  const refines: CaseRefine[] = []
  for (const [flowId, runs] of byFlow) {
    if (!runs.some((run) => REFINE_ACTIONS.has(run.action))) continue
    const ordered = [...runs].sort((a, b) => a.startedAt - b.startedAt)
    refines.push({
      flowId,
      startedAt: ordered[0]!.startedAt,
      endedAt: Math.max(...ordered.map((run) => run.endedAt ?? run.startedAt)),
      runs: ordered.map(clueOf),
    })
  }
  return refines.sort((a, b) => b.startedAt - a.startedAt)
}

function clueOf(run: RunRecord): CaseClue {
  return {
    sessionId: run.sessionId,
    action: run.action,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    status: run.status,
    harness: run.harness,
    runtime: run.runtime,
    resumeId: run.resumeId,
    cwd: run.cwd,
    argv: run.argv,
    version: run.version,
    input: run.input,
    specAgent: run.specAgent,
  }
}

/** What the agent hands back when it has settled which refine this is, read off the file it
 *  wrote. Everything but `flowId` is optional: a refine whose traces are all gone still
 *  makes a case worth sending, with the gaps saying what is missing. */
export interface CaseFindings {
  flowId: string
  analysis?: string
  gaps?: string[]
  /** One per run of that refine, by the session id the clues named. `traceFile` is where the
   *  agent put that harness's raw trace — a file it found, or one it wrote the trace out to. */
  runs?: { sessionId: string; traceFile?: string }[]
  /** The project files that refine read, and what the agent saw that on. */
  reads?: { path: string; evidence?: string }[]
}

/** A built pack, and why it is not more than it is. */
export interface BuiltCase {
  pack: SentCase
  gaps: string[]
}

/**
 * Build the pack for one submission.
 *
 * Everything the agent said is checked against what is actually on this machine, and every
 * check that fails becomes a line in `gaps` rather than a field quietly left out — a case
 * whose trace is missing is still worth reading, and one that PRETENDS to hold a trace is
 * not.
 */
export function buildCase(record: CaseRecord, found: CaseFindings): BuiltCase {
  const gaps = [...(found.gaps ?? [])]
  const refine = refinesOf(record.cardId).find((r) => r.flowId === found.flowId)
  if (!refine) gaps.push(`no refine on #${record.cardId} answers to flow ${found.flowId}`)

  const traces = new Map((found.runs ?? []).map((run) => [run.sessionId, run.traceFile]))
  const runs: SentCaseRun[] = (refine?.runs ?? []).map((clue) => {
    const trace = readTrace(traces.get(clue.sessionId), clue, gaps)
    if (!clue.version) gaps.push(`run ${clue.sessionId} (${clue.action}) recorded no akb version`)
    return {
      action: clue.action,
      startedAt: clue.startedAt,
      harness: clue.harness,
      sessionId: clue.sessionId,
      ...(clue.runtime ? { runtime: clue.runtime } : {}),
      ...(clue.resumeId ? { resumeId: clue.resumeId } : {}),
      ...(clue.cwd ? { cwd: clue.cwd } : {}),
      ...(clue.argv ? { argv: clue.argv } : {}),
      ...(clue.version ? { version: clue.version } : {}),
      ...(clue.input ? { input: clue.input } : {}),
      ...(trace ? { trace } : {}),
    }
  })

  const files = collectFiles(found.reads ?? [], refine?.startedAt, gaps)

  return {
    pack: {
      v: 1,
      id: record.id,
      day: usageDay(),
      submittedAt: new Date().toISOString(),
      surface: usageSurface(),
      version: SKILL_VERSION,
      card: record.cardId,
      ...(refine ? { flowId: refine.flowId } : {}),
      text: record.text.slice(0, LIMITS.feedbackTextChars),
      ...(found.analysis ? { analysis: found.analysis } : {}),
      gaps,
      runs,
      files,
    },
    gaps,
  }
}

/** The pack a refusal leaves the user with: their own words, and nothing collected. What
 *  **Send the question description only** posts, under the id they were already shown. */
export function textOnlyCase(record: CaseRecord): SentCase {
  return {
    v: 1,
    id: record.id,
    day: usageDay(),
    submittedAt: new Date().toISOString(),
    surface: usageSurface(),
    version: SKILL_VERSION,
    card: record.cardId,
    text: record.text.slice(0, LIMITS.feedbackTextChars),
    gaps: ['sent as the question description alone — no trace and no project file went with it'],
  }
}

/** One run's raw trace, as far as it can be believed. A file the agent named and this
 *  machine does not have is a gap, never an empty string passed off as a trace. */
function readTrace(file: string | undefined, clue: CaseClue, gaps: string[]): string | undefined {
  if (!file) {
    gaps.push(`run ${clue.sessionId} (${clue.action}) — no raw trace was found for it`)
    return undefined
  }
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    gaps.push(`run ${clue.sessionId} (${clue.action}) — ${file} could not be read`)
    return undefined
  }
  if (!text.trim()) {
    gaps.push(`run ${clue.sessionId} (${clue.action}) — its trace file is empty`)
    return undefined
  }
  if (Buffer.byteLength(text) <= TRACE_BYTES) return text
  gaps.push(`run ${clue.sessionId} (${clue.action}) — only the last ${TRACE_BYTES / (1024 * 1024)} MB of its trace went`)
  return Buffer.from(text).subarray(-TRACE_BYTES).toString('utf8')
}

/**
 * The project files the refine read.
 *
 * Three rules, and a path failing any of them is a gap rather than a file:
 *
 *   • it is inside this project — a path outside it is not a project file, whatever it is;
 *   • it is not the board's `.env`, the one file that exists to hold API keys;
 *   • it is named once — the same path twice is one file, and the second mention is dropped.
 *
 * The version is the version the refine SAW wherever git can still answer for it: the blob
 * at the last commit before that refine started. Failing that the checkout's copy goes,
 * marked `current`, and a file that is gone goes as `missing` with no content — because a
 * case whose files are quietly today's is one that reproduces something else.
 */
function collectFiles(
  reads: { path: string; evidence?: string }[],
  at: number | undefined,
  gaps: string[],
): SentCaseFile[] {
  const commit = at ? commitBefore(at) : null
  const files: SentCaseFile[] = []
  const seen = new Set<string>()
  for (const read of reads) {
    const named = String(read.path ?? '').trim()
    if (!named) continue
    const full = path.resolve(REPO_ROOT, named)
    const inside = path.relative(REPO_ROOT, full)
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
      gaps.push(`${named} is outside this project, so it was not collected`)
      continue
    }
    if (full === path.resolve(ENV_FILE)) {
      gaps.push(`${inside} holds this board's API keys and is never collected`)
      continue
    }
    if (seen.has(inside)) continue
    seen.add(inside)
    files.push(oneFile(inside, full, commit, read.evidence, gaps))
  }
  return files
}

function oneFile(
  inside: string,
  full: string,
  commit: string | null,
  evidence: string | undefined,
  gaps: string[],
): SentCaseFile {
  const evidenced = evidence ? { evidence } : {}
  const asRead = commit ? git(['show', `${commit}:${inside}`]) : null
  if (asRead !== null) return sized(inside, asRead, 'read', evidenced, gaps)
  let text: string
  try {
    text = fs.readFileSync(full, 'utf8')
  } catch {
    gaps.push(`${inside} is no longer on this machine`)
    return { path: inside, bytes: 0, text: '', version: 'missing', ...evidenced }
  }
  gaps.push(`${inside} went as this checkout's copy, not the version that refine read`)
  return sized(inside, text, 'current', evidenced, gaps)
}

function sized(
  inside: string,
  text: string,
  version: SentCaseFile['version'],
  evidenced: { evidence?: string },
  gaps: string[],
): SentCaseFile {
  const bytes = Buffer.byteLength(text)
  if (bytes <= LIMITS.caseFileBytes) return { path: inside, bytes, text, version, ...evidenced }
  gaps.push(`${inside} is ${Math.round(bytes / 1024)} kB and was left out whole`)
  return { path: inside, bytes, text: '', version: 'missing', ...evidenced }
}

/** The last commit at or before that moment — what the refine was reading against. Null
 *  outside git, and on a project whose history does not reach back that far. */
function commitBefore(at: number): string | null {
  const out = git(['rev-list', '-1', `--before=${new Date(at).toISOString()}`, 'HEAD'])
  const sha = out?.trim().split('\n')[0]?.trim()
  return sha || null
}
