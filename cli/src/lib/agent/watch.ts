// The process that watches one run.
//
// A run has to outlive the command that started it: close the terminal and the agent keeps
// working, and the run is still there to follow and to stop. So the command writes the run
// down and spawns this — detached, with nothing attached to the terminal — and returns.
// This is what actually starts the agent, writes its log, and does the bookkeeping either
// side of it.
//
// It is one process per run. That is what makes a stop a real signal to a real process,
// and what lets a run queued behind the shared-file lock keep waiting after whoever asked
// for it has gone home.

import { spawn } from 'node:child_process'
import fs from 'node:fs'

import { SESSIONS_DIR } from '../paths'
import { markBoard, refinesAfter, type BoardMarks } from './follow'
import { costLine, durationLine, modelLine, RESULT_MARKER, usageLine } from './log'
import { RESUME_PROMPT } from './prompts'
import { openPlan } from './resolve'
import {
  acquireIndexLock,
  claimCard,
  closeRun,
  needsIndexLock,
  patch,
  peekRun,
  readSpec,
} from './sessions'
import { startRun } from './start'
import type { AgentAction } from './types'

// How long a run gets to end on its own after a stop asks it to, before it is killed
// outright.
const STOP_GRACE_MS = 5_000
// And how long after that before the run is closed out whatever the child's pipes are
// doing. See the note beside askToStop.
const STOP_CLOSE_MS = 2_000

/** Watch one run from start to finish. Resolves when the record is closed out. */
export async function watchRun(sessionId: string): Promise<number> {
  const spec = readSpec(sessionId)
  const run = peekRun(sessionId)
  if (!run || !spec) {
    // Nothing to watch. Either the record has gone (a stop that landed before this process
    // was up closed it) or the plan was never written.
    if (run?.status === 'running') closeRun(sessionId, { status: 'interrupted', code: null })
    return 1
  }

  // A stop can reach a run before it ever spawns, and an index run can wait a long time for
  // its turn — so the record, not this process's own memory, is what says whether to carry
  // on. It is re-read at every step.
  const stopping = (): boolean => peekRun(sessionId)?.status !== 'running'

  let releaseIndex: (() => void) | null = null
  if (needsIndexLock(run.action)) {
    releaseIndex = await acquireIndexLock(stopping)
    if (!releaseIndex) {
      // Stopped while queued, or waited past all reason. Either way nothing spawned.
      if (!stopping()) closeRun(sessionId, { status: 'interrupted', code: null })
      return 0
    }
  }
  const letGo = () => {
    if (releaseIndex) releaseIndex()
    releaseIndex = null
  }

  if (stopping()) {
    letGo()
    return 0
  }

  // Save the stage before the agent touches the card, so anything reading the board
  // mid-run finds it already marked. The record keeps what was there, so the end of the run
  // can put it back.
  const claimed = patch(sessionId, (r) => claimCard(r))
  const record = claimed ?? run

  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const log = fs.createWriteStream(record.logPath, { flags: 'a' })

  // The keys are read here and nowhere else: the plan on disk carries the command and the
  // agent's name, never a key, and this is the one moment one is needed.
  const active = openPlan(spec.plan)
  // A resumed run's prompt is the "carry on" one — the conversation already holds the card,
  // the work done and the error it died on, so the whole action prompt would be a second
  // instruction nobody gave.
  const prompt = record.resumedFrom ? RESUME_PROMPT : spec.prompt

  // The board as it was the moment before the agent touched it. What this run wrote — and
  // what it took off the board — is the difference between this and the same read at the
  // close, and that difference is what earns a card the refine that follows.
  const before = markBoard()

  const [cmd, ...args] = active.argv
  let child
  try {
    child = spawn(cmd!, [...args, prompt], {
      cwd: process.cwd(),
      env: active.env,
      shell: false,
      // `claude -p` waits ~3s on a piped stdin, then logs a "no stdin data" warning into
      // our log. Close stdin so the log is only agent output.
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    log.end()
    closeRun(sessionId, { status: 'error', ok: false, code: null, error: String(e) })
    letGo()
    return 1
  }

  const renderer = active.renderer
  const append = (str: string) => {
    if (str) log.write(str)
  }
  // Both ids are written into the record the first time the stream names them, and never
  // looked for again — every write takes the record's lock, and a run's output arrives in
  // hundreds of chunks.
  let sawResumeId = !!record.resumeId
  let sawModel = false
  const catchIds = () => {
    if (!sawResumeId) sawResumeId = catchResumeId(sessionId, renderer.resumeId?.())
    if (!sawModel) sawModel = catchModel(sessionId, renderer.model?.())
  }

  // stdout is the agent's event stream — render it to readable lines as it arrives, with
  // the parser its own agent brings. stderr is plain text and passes through.
  child.stdout.on('data', (d: Buffer) => {
    append(renderer.push(d.toString()))
    catchIds()
  })
  child.stderr.on('data', (d: Buffer) => append(d.toString()))

  let spawnError: string | undefined
  child.on('error', (err) => {
    // The one failure worth saying in our own words: the agent's binary isn't on this
    // machine — or isn't on the PATH this run started with. "spawn claude ENOENT" tells a
    // user nothing.
    spawnError =
      (err as NodeJS.ErrnoException)?.code === 'ENOENT'
        ? `${cmd} isn't installed, or isn't on this run's PATH. Install it with: ${active.install}`
        : String(err)
    log.write(`\n[error] ${spawnError}`)
  })

  return await new Promise<number>((resolve) => {
    // Whichever path gets here first wins and the rest are no-ops: the child's own close,
    // and the backstop below.
    let done = false
    const finish = (code: number | null, asked: boolean) => {
      if (done) return
      done = true
      append(renderer.flush())
      catchIds() // the ids may have been in the last partial line, on a very short run

      const endedAt = Date.now()
      // Stamp the elapsed time through the same stream (not an append after the stream is
      // closed, which would race its pending flush), and hand the same instant to the
      // record so the file and the record agree.
      log.write(durationLine(endedAt - record.startedAt))
      const cost = renderer.costUsd?.()
      if (cost !== undefined) log.write(costLine(cost))
      const usage = renderer.usage?.()
      if (usage) log.write(usageLine(usage))
      const model = peekRun(sessionId)?.model
      if (model) log.write(modelLine(model))
      // The final message goes to the log behind a marker line, so the file alone is the
      // complete durable record and a later read can split events from message again.
      const final = renderer.result()
      if (final) log.write(`\n${RESULT_MARKER}\n${final}\n`)
      log.end()

      patch(sessionId, (r) => {
        if (cost !== undefined) r.costUsd = cost
        if (usage) r.usage = usage
        if (final) r.result = final
      })
      // A run somebody ended exits non-zero — we killed it — but that is not a failure, so
      // the ask, not the code it died with, names the outcome.
      const status = asked ? 'stopped' : code === 0 ? 'done' : 'error'
      closeRun(sessionId, {
        status,
        // `ok` stays unset on a stopped run, as it does on one that was cut off: it
        // neither passed nor failed, it was ended.
        ok: asked ? undefined : code === 0,
        code: asked ? null : code,
        error: spawnError,
        endedAt,
      })
      letGo()
      // Only after a run that finished. One that failed or was ended left the board
      // half-written, and a refine of half a card is a refine you throw away.
      if (status === 'done') followUp(record.action, before)
      resolve(code === 0 ? 0 : 1)
    }

    // A stop signals THIS process; pass it on and give the agent a moment to end on its
    // own, then kill it — and close the run out either way.
    //
    // That last step is not belt and braces. The child's `close` waits on the output PIPE,
    // not on the process: a tool the agent left behind inherits that pipe and can hold it
    // open long after the agent itself is gone, which would leave the run reading as
    // running and its card locked for good. So the ending is ours to declare.
    let stopped = false
    const askToStop = () => {
      if (stopped || done) return
      stopped = true
      try {
        child.kill('SIGTERM')
      } catch {
        // already gone
      }
      after(STOP_GRACE_MS, () => {
        try {
          child.kill('SIGKILL')
        } catch {
          // already gone
        }
      })
      after(STOP_GRACE_MS + STOP_CLOSE_MS, () => {
        finish(null, true)
        // Nothing else is waiting on this process, and something is still holding a pipe
        // open — so leave rather than sit here for as long as it does.
        process.exit(0)
      })
    }
    process.on('SIGTERM', askToStop)
    process.on('SIGINT', askToStop)

    child.on('close', (code) => finish(code, peekRun(sessionId)?.stopping === true || stopped))
  })
}

// Start a refine on each card this run wrote, changed, or set free — each one an ordinary
// run of its own, so it shows in the panel with its own log and can be stopped.
//
// A refusal is not worth reporting: the only one that comes up is a card that already has a
// run on it, and that run is doing more than this one would have. Nothing here can fail the
// run that just ended — it is over.
function followUp(action: AgentAction, before: BoardMarks): void {
  try {
    for (const req of refinesAfter(action, before)) startRun(req)
  } catch {
    // an unreadable board, or a spawn that wouldn't — the run it followed is done either way
  }
}

// setTimeout that can't hold this process open on its own.
function after(ms: number, fn: () => void): void {
  const t = setTimeout(fn, ms)
  if (typeof t.unref === 'function') t.unref()
}

// An agent that mints its own session id reports it out of its output stream, so the id
// shows up partway through the run. Save it the moment it does — a stop or a crash a
// second later would otherwise leave a run with no way to continue it. First one wins: an
// agent that names its id more than once is still one conversation.
function catchResumeId(sessionId: string, id: string | undefined): boolean {
  if (!id) return false
  patch(sessionId, (r) => {
    if (!r.resumeId) r.resumeId = id
  })
  return true
}

// The model the agent named for this run, taken the instant its output says one — the
// opening banner, seconds in — so a live run can show what it is working with instead of
// waiting for the end.
function catchModel(sessionId: string, model: string | undefined): boolean {
  if (!model) return false
  patch(sessionId, (r) => {
    if (!r.model) r.model = model
  })
  return true
}
