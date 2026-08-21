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

import { spawn, type ChildProcessByStdio, type StdioNull, type StdioPipe } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import fs from 'node:fs'

import { REPO_ROOT, SESSIONS_DIR } from '../paths'
import { markedEnv } from './flow'
import { markBoard, refinesAfter, specRunsAfter, type BoardMarks } from './follow'
import { costLine, durationLine, modelLine, RESULT_MARKER, usageLine } from './log'
import { createStderrFilter } from './stream'
import { RESUME_PROMPT } from './prompts'
import { openPlan } from './resolve'
import {
  acquireIndexLock,
  claimCard,
  clearSpecAsks,
  closeRun,
  needsIndexLock,
  patch,
  peekRun,
  readSpec,
  readSpecAsks,
} from './sessions'
import { startRun } from './start'
import type { TurnEnd } from './client'
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
  // A connector the board talks to is started differently in two ways: the prompt is sent
  // in the conversation rather than spelled on the command line, and its stdin stays open,
  // because that is the half of the conversation this end writes (agent/client.ts).
  const client = active.client
  // Spelled out rather than written inline so both shapes stay one spawn: stdin is a pipe
  // for a conversation and closed for a command that only prints.
  const stdio: [StdioNull | StdioPipe, StdioPipe, StdioPipe] = [client ? 'pipe' : 'ignore', 'pipe', 'pipe']
  // stdout and stderr are pipes whichever shape this is; only stdin differs.
  let child: ChildProcessByStdio<Writable | null, Readable, Readable>
  try {
    child = spawn(cmd!, client ? args : [...args, prompt], {
      // The project the run belongs to. The watcher is already started there, so this is
      // what its cwd holds anyway — named outright so it stays true if that ever changes.
      cwd: REPO_ROOT,
      // The run's own id goes into the agent's environment, and this is the one place it
      // can: the environment a run starts under is settled by the settings (resolve.ts),
      // which never see a session id. It is what stops a run spawning a copy of itself —
      // an agent inside a run that asks for a board action gets the flow printed instead
      // (lib/agent/flow.ts). `markedEnv` also takes the conversation's mark back off: this
      // run may have been started by a chat, and it is a run now.
      env: markedEnv(active.env, 'run', sessionId),
      shell: false,
      // `claude -p` waits ~3s on a piped stdin, then logs a "no stdin data" warning into
      // our log. Close stdin so the log is only agent output.
      stdio,
    }) as ChildProcessByStdio<Writable | null, Readable, Readable>
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
  const gotResumeId = (id: string | undefined) => {
    if (!sawResumeId) sawResumeId = catchResumeId(sessionId, id)
  }
  const gotModel = (model: string | undefined) => {
    if (!sawModel) sawModel = catchModel(sessionId, model)
  }

  // stdout is the agent's event stream — render it to readable lines as it arrives, with
  // the parser its own agent brings. stderr is plain text and passes through, whichever
  // kind of command this is: it is where a CLI puts its warnings either way — minus the
  // agent's own housekeeping chatter, which says nothing about the run.
  if (renderer) {
    child.stdout.on('data', (d: Buffer) => {
      append(renderer.push(d.toString()))
      gotResumeId(renderer.resumeId?.())
      gotModel(renderer.model?.())
    })
  }
  const errs = createStderrFilter(active.quietStderr)
  child.stderr.on('data', (d: Buffer) => append(errs.push(d.toString())))

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
    // How the conversation ended, on a run the board talked to. It stands in for
    // everything a printing agent's own output would have said.
    let spoken: TurnEnd | undefined
    const finish = (code: number | null, asked: boolean) => {
      if (done) return
      done = true
      if (renderer) {
        append(renderer.flush())
        // The ids may have been in the last partial line, on a very short run.
        gotResumeId(renderer.resumeId?.())
        gotModel(renderer.model?.())
      }
      append(errs.flush())

      const endedAt = Date.now()
      // Stamp the elapsed time through the same stream (not an append after the stream is
      // closed, which would race its pending flush), and hand the same instant to the
      // record so the file and the record agree.
      log.write(durationLine(endedAt - record.startedAt))
      const cost = spoken ? spoken.costUsd : renderer?.costUsd?.()
      if (cost !== undefined) log.write(costLine(cost))
      const usage = spoken ? spoken.usage : renderer?.usage?.()
      if (usage) log.write(usageLine(usage))
      const model = peekRun(sessionId)?.model
      if (model) log.write(modelLine(model))
      // The final message goes to the log behind a marker line, so the file alone is the
      // complete durable record and a later read can split events from message again.
      const final = spoken ? spoken.result : renderer?.result()
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
        // What went wrong, in whoever's words know: ours when the command wouldn't start,
        // the agent's own when the conversation ended badly.
        error: spawnError ?? (asked ? undefined : spoken?.error),
        endedAt,
      })
      letGo()
      // Only after a run that finished. One that failed or was ended left the board
      // half-written, and a refine of half a card is a refine you throw away — and a spec
      // agent sent at half a plan would answer the wrong plan.
      if (status === 'done') followUp(sessionId, record.action, before)
      resolve(code === 0 ? 0 : 1)
    }

    // A stop signals THIS process; pass it on and give the agent a moment to end on its
    // own, then kill it — and close the run out either way.
    //
    // That last step is not belt and braces. The child's `close` waits on the output PIPE,
    // not on the process: a tool the agent left behind inherits that pipe and can hold it
    // open long after the agent itself is gone, which would leave the run reading as
    // running and its card locked for good. So the ending is ours to declare.
    // Ending the command ourselves, whether because a stop asked or because the
    // conversation is over. It gets a moment to end on its own, then it is killed.
    const endChild = () => {
      try {
        child.stdin?.end()
      } catch {
        // already gone
      }
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
    }

    let stopped = false
    const askToStop = () => {
      if (stopped || done) return
      stopped = true
      endChild()
      after(STOP_GRACE_MS + STOP_CLOSE_MS, () => {
        finish(null, true)
        // Nothing else is waiting on this process, and something is still holding a pipe
        // open — so leave rather than sit here for as long as it does.
        process.exit(0)
      })
    }
    process.on('SIGTERM', askToStop)
    process.on('SIGINT', askToStop)

    // The conversation, on a run the board talks to. It is the run: a command that answers
    // back is a server and never exits on its own, so the turn's ending is the run's
    // ending, and the process is closed out after it rather than waited on. What the turn
    // says happened is the verdict — the exit code of a process we killed says nothing.
    if (client) {
      const toAgent = child.stdin
      if (!toAgent) {
        log.write(`\n[error] nothing could be written to ${cmd}, so there was no way to send it the task\n`)
        finish(1, false)
      } else {
        void client
          .turn({
            stdout: child.stdout,
            stdin: toAgent,
            prompt,
            cwd: REPO_ROOT,
            // Only a resumed run carries a conversation to continue. A fresh run's session
            // is opened inside the conversation, and its id comes back here.
            resumeId: record.resumedFrom ? record.resumeId : undefined,
            log: append,
            gotResumeId: (id) => gotResumeId(id),
            gotModel: (model) => gotModel(model),
          })
          .then((end) => {
            spoken = end
            endChild()
            finish(end.ok ? 0 : 1, peekRun(sessionId)?.stopping === true || stopped)
          })
      }
    }

    child.on('close', (code) => finish(code, peekRun(sessionId)?.stopping === true || stopped))
  })
}

// What follows this run: the spec agents it asked for, and a refine on each card it wrote,
// changed, or set free. Each one is an ordinary run of its own, so it shows in the panel
// with its own log and can be stopped.
//
// The spec agents go first — they were asked for by name, and a refine was not.
//
// A refusal is not worth reporting: the only one that comes up is a card that already has a
// run on it, and that run is doing more than this one would have. Nothing here can fail the
// run that just ended — it is over.
function followUp(sessionId: string, action: AgentAction, before: BoardMarks): void {
  try {
    // Started first, then forgotten — so a crash between the two costs a repeated agent at
    // worst, and never a section nobody ever writes.
    for (const req of specRunsAfter(readSpecAsks(sessionId))) startRun(req)
    clearSpecAsks(sessionId)
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
