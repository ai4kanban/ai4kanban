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
import { boardComplaints } from '../reconcile'
import { boardCommand } from './command'
import { deliveryRunAfter } from './deliveries'
import { advanceLanding } from './landing'
import { runEnv } from './flow'
import { refineRunsAfter, specRunsAfter } from './follow'
import { costLine, durationLine, modelLine, RESULT_MARKER, usageLine } from './log'
import { createStderrFilter } from './wire'
import { resumePrompt } from './prompts'
import { openPlan } from './resolve'
import {
  claimChanges,
  markBoard,
  refinementRunsAfter,
  type BoardMarks,
  type RefinementFollowUp,
} from './refine'
import {
  acquireIndexLock,
  claimCard,
  clearAsks,
  closeRun,
  finishWriting,
  needsIndexLock,
  patch,
  peekRun,
  readRefineAsks,
  readSpec,
  readSpecAsks,
  setCardStatus,
  type CardClaim,
} from './sessions'
import { startRun } from './start'
import type { TurnEnd } from './wire'
import type { AgentRequest, RunRecord } from './types'

// How long a run gets to end on its own after a stop asks it to, before it is killed
// outright.
const STOP_GRACE_MS = 5_000
// And how long after that before the run is closed out whatever the child's pipes are
// doing. See the note beside askToStop.
const STOP_CLOSE_MS = 2_000
// And how long the ending path itself gets to write the board out before the process
// leaves anyway.
const STOP_FINISH_MS = 10_000

/** Watch one run from start to finish. Resolves when the record is closed out. */
export async function watchRun(sessionId: string): Promise<number> {
  const spec = readSpec(sessionId)
  const run = peekRun(sessionId)
  if (!run || !spec) {
    // Nothing to watch. Either the record has gone (a stop that landed before this process
    // was up closed it) or the plan was never written.
    if (run?.status === 'running') await closeRun(sessionId, { status: 'interrupted', code: null })
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
      if (!stopping()) await closeRun(sessionId, { status: 'interrupted', code: null })
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
  //
  // Two steps, because `patch` holds the run record's lock across its callback and the
  // board write is awaited: the record remembers the prior stage under the lock, and the
  // card is marked once the lock is back.
  let claim: CardClaim | undefined
  const claimed = patch(sessionId, (r) => {
    claim = claimCard(r)
  })
  const record = claimed ?? run
  if (claim) await setCardStatus(claim.cardId, claim.status)

  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const log = fs.createWriteStream(record.logPath, { flags: 'a' })
  // What the board settled before the agent said a word — a spec agent's setting whose saved
  // value it no longer offers, and what it ran at instead. It goes above the output so the
  // reason sits before the work it changed.
  for (const note of spec.notes ?? []) log.write(`[board] ${note}\n`)

  // The keys are read here and nowhere else: the plan on disk carries the command and the
  // agent's name, never a key, and this is the one moment one is needed.
  const active = openPlan(spec.plan)
  // A resumed run's prompt is the "carry on" one — the conversation already holds the
  // card, the work done and the error it died on, so the whole action prompt would be a
  // second instruction nobody gave. Inside a delivery it says more: re-enter the flow and
  // check each step's precondition, rather than carrying on from a half-finished sentence.
  const prompt = record.resumedFrom ? resumePrompt(record.deliveryId, record.cardId) : spec.prompt

  // The board as it was the moment before the agent touched it. The difference between this
  // and the same read at the close is what this run could be answerable for; which of it
  // really is its own — and not a neighbouring run's — is settled at the close by
  // `claimChanges`, and that is what earns a card the refine that follows.
  const before = markBoard()
  // And what was already broken about it. Only what a run BREAKS is worth reporting on that
  // run: a board carrying a stale link from last month would otherwise put the same line on
  // the end of every run forever, which is how a real warning gets read as furniture.
  const wasBroken = new Set(boardComplaints())

  const [cmd, ...args] = active.argv
  const workDir = active.cwd ?? REPO_ROOT
  // A connector the board talks to is started differently in two ways: the prompt is sent
  // in the conversation rather than spelled on the command line, and its stdin stays open,
  // because that is the half of the conversation this end writes (agent/wire/client.ts).
  const client = active.client
  // Spelled out rather than written inline so both shapes stay one spawn: stdin is a pipe
  // for a conversation and closed for a command that only prints.
  const stdio: [StdioNull | StdioPipe, StdioPipe, StdioPipe] = [client ? 'pipe' : 'ignore', 'pipe', 'pipe']
  // stdout and stderr are pipes whichever shape this is; only stdin differs.
  let child: ChildProcessByStdio<Writable | null, Readable, Readable>
  try {
    child = spawn(cmd!, client ? args : [...args, prompt], {
      // Where this run works: the project, or — inside a delivery with a worktree of its
      // own (#303) — that worktree. Settled when the run was planned and written down with
      // it, so the spawn, the connector's own folder flag and `PWD` are one answer.
      cwd: workDir,
      // The run's own id goes into the agent's environment, and this is the one place it
      // can: the environment a run starts under is settled by the settings (resolve.ts),
      // which never see a run id. It is what stops a run spawning a copy of itself —
      // an agent inside a run that asks for a board action gets the flow printed instead
      // (lib/agent/flow.ts).
      env: runEnv(active.env, sessionId),
      shell: false,
      // `claude -p` waits ~3s on a piped stdin, then logs a "no stdin data" warning into
      // our log. Close stdin so the log is only agent output.
      stdio,
    }) as ChildProcessByStdio<Writable | null, Readable, Readable>
  } catch (e) {
    log.end()
    await closeRun(sessionId, { status: 'error', ok: false, code: null, error: String(e) })
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
    const finish = async (code: number | null, asked: boolean): Promise<void> => {
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
      // An implementation may exit cleanly after recording that it cannot continue. The
      // blocker, not its shell code, makes that run unfinished and keeps the delivery ready
      // for Resume rather than sending incomplete work to review.
      const blocker = peekRun(sessionId)?.blocker
      const status = asked ? 'stopped' : blocker ? 'error' : code === 0 ? 'done' : 'error'
      // Writing is the last refinement session. A clean exit is its verdict; lifecycle
      // bookkeeping belongs to the watcher, not to an agent editing prose. The board keeps
      // the card at todo if questions appeared or refuses the transition for another reason.
      if (status === 'done' && record.action === 'writing' && record.cardId !== null) {
        try {
          await finishWriting(record.cardId)
        } catch {
          // The refinement state below reports the card still at todo.
        }
      }
      // What this run changed, taken now and taken once (agent/refine.ts). Every ending
      // claims, a failure included: a half-written card is not a card to refine, but leaving
      // its edits unclaimed would hand them to whichever run closes next.
      const changed = claimChanges(before, sessionId)
      // The refines themselves are only for a run that finished. One that failed or was
      // ended left the board half-written, and a refine of half a card is a refine you throw
      // away — and a spec agent sent at half a plan would answer the wrong plan.
      //
      // Worked out BEFORE the record closes, so anything watching for the run to end sees
      // the note it ended with rather than catching the record a beat too early.
      const settled = status === 'done' ? settleBoard(record, changed, before) : null
      const note = status === 'done' ? joinNotes(settled?.stalled, brokeBoard(wasBroken)) : undefined
      await closeRun(sessionId, {
        status,
        // `ok` stays unset on a stopped run, as it does on one that was cut off: it
        // neither passed nor failed, it was ended.
        ok: asked ? undefined : !blocker && code === 0,
        code: asked ? null : code,
        // What went wrong, in whoever's words know: ours when the command wouldn't start,
        // the agent's own when the conversation ended badly.
        error: spawnError ?? (asked ? undefined : spoken?.error),
        note,
        endedAt,
      })
      letGo()
      // The delivery's own next run first, when it has one — the review after a build. It is
      // read from the record the close just wrote, so it is taken once and started once.
      const carryOn = deliveryRunAfter(record)
      // Then the landing queue (#304): a delivery review has just passed takes the slot and
      // lands here, and what it hands back is the run that landing wants — conflict
      // resolution or review of a rebased result.
      const landing = await advanceLanding()
      followUp(sessionId, record.flowId, settled?.runs ?? [], carryOn, landing)
      resolve(status === 'done' ? 0 : 1)
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
        // Nothing else is waiting on this process, and something is still holding a pipe
        // open — so leave rather than sit here for as long as it does. The ending path
        // writes the board, so it is awaited first: exiting on the same tick would drop
        // the card's stage, a stopped run's question, and the delivery's next run. The
        // second timer is the bound — a landing that hangs cannot hold the process open.
        after(STOP_FINISH_MS, () => process.exit(0))
        void finish(null, true).finally(() => process.exit(0))
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
        void finish(1, false)
      } else {
        void client
          .turn({
            stdout: child.stdout,
            stdin: toAgent,
            prompt,
            cwd: workDir,
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
            void finish(end.ok ? 0 : 1, peekRun(sessionId)?.stopping === true || stopped)
          })
      }
    }

    child.on('close', (code) => void finish(code, peekRun(sessionId)?.stopping === true || stopped))
  })
}

// How many broken links a run's note lists before it stops counting. The point is to say
// the board came out of this run inconsistent, not to reprint the whole of it.
const MAX_BROKEN = 5

// What this run broke that was whole before it: a link into the README index, a card that
// never got indexed, a `blocked_by` or `related` pointing at an id that isn't there any
// more. Nothing else notices — the moves that check for it are the ones the agent skipped —
// so a run that finished a card by deleting the file reads as a clean `✓ done` and the
// board goes on quietly disagreeing with itself. Null when it came out whole.
function brokeBoard(wasBroken: Set<string>): string | null {
  const broke = boardComplaints().filter((line) => !wasBroken.has(line))
  if (!broke.length) return null
  const shown = broke.slice(0, MAX_BROKEN)
  const rest = broke.length - shown.length
  return [
    `the work is done, but the board came out of this run inconsistent — ${broke.length} thing${broke.length === 1 ? '' : 's'} to put right:`,
    ...shown.map((line) => `  ${line}`),
    ...(rest ? [`  … and ${rest} more`] : []),
    `a card is taken off the board with \`${boardCommand()} board archive <id>\` or \`${boardCommand()} board reject <id>\`, never by deleting its file.`,
  ].join('\n')
}

const joinNotes = (...parts: (string | null | undefined)[]): string | undefined =>
  parts.filter(Boolean).join('\n\n') || undefined

// The refinement sessions this run leaves behind, worked out but not started, plus
// `stalled` — a refinement loop that ended with its card unsettled (agent/refine.ts). The
// pass's own call on the status stands: nothing out here has read the card.
function settleBoard(
  run: RunRecord,
  changed: readonly number[],
  before: BoardMarks,
): RefinementFollowUp | null {
  try {
    const waitingForSpec = readSpecAsks(run.sessionId).some((ask) => ask.cardId === run.cardId)
    return refinementRunsAfter(run, changed, before, waitingForSpec)
  } catch {
    // an unreadable board — the run it followed is done either way
    return null
  }
}

// What follows this run: the spec agents and refinements it asked for by name, and
// refinement on each card it wrote, changed, or set free. Each one is an ordinary run of its
// own, so it shows in the panel with its own log and can be stopped.
//
// Every one joins this run's flow, so the panel shows one job with its sessions on a
// timeline rather than a scatter of unrelated rows.
//
// What was asked for by name goes first — a refine nobody asked for was inferred.
//
// A refusal is not worth reporting: the only one that comes up is a card that already has a
// run on it, and that run is doing more than this one would have. Nothing here can fail the
// run that just ended — it is over.
function followUp(
  sessionId: string,
  flowId: string | undefined,
  runs: AgentRequest[],
  carryOn: AgentRequest | null,
  landing: AgentRequest | null = null,
): void {
  // A request that already names its flow keeps it — a refinement pass carries its loop's
  // id, and that loop is this flow anyway.
  const join = (req: AgentRequest): AgentRequest =>
    req.flowId || !flowId ? req : { ...req, flowId }
  try {
    // Started first, then forgotten — so a crash between the two costs a repeated agent at
    // worst, and never a section nobody ever writes.
    const asked = [...specRunsAfter(readSpecAsks(sessionId)), ...refineRunsAfter(readRefineAsks(sessionId))]
    for (const req of asked) startRun(join(req))
    clearAsks(sessionId)
    if (carryOn) startRun(join(carryOn))
    if (landing) startRun(join(landing))
    for (const req of runs) startRun(join(req))
  } catch {
    // a spawn that wouldn't — the run it followed is done either way
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
