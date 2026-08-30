// One small chat through the setup that is saved right now — the picked agent, the picked
// provider, the model, the endpoint, the key, the reasoning level — so the user learns the
// setup is broken here instead of on the first card run that fails.
//
// It is spawned exactly the way a run is: the same plan and the same environment, so a
// test that passes is a run that starts. What it deliberately is NOT is a run. Nothing here
// touches the record, so there is no card, no card lock, no queue place, no log and no file
// on the board. It is a chat that goes nowhere.
//
// The board reads the exit code and nothing else. Whether the agent answered "OK" or
// something else is not the question — that it answered at all is.

import { spawn, type ChildProcessByStdio, type StdioNull, type StdioPipe } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { randomUUID } from 'node:crypto'

import { REPO_ROOT } from '../paths'
import { openPlan, planRun } from './resolve'
import { createStderrFilter } from './wire'
import type { ConnectionTest } from './types'

// What the test asks for. A few words, because the answer is never read: an answer at all
// is the pass, so a longer prompt would only cost more tokens.
const TEST_PROMPT = 'Reply with OK and nothing else.'

// How long a test gets before it gives up and reports that as a failure. Long enough for a
// cold CLI start plus a model's first token on a slow line, short enough to sit through —
// and it is what stops a dead endpoint leaving the command hanging.
const TIMEOUT_MS = 60_000

// After the give-up signal, how long the child gets to end on its own before it is killed
// outright — the same two-step a stop uses.
const KILL_AFTER_MS = 2_000

// How much of a failing run's output is shown. The reason is at the END of a failing run,
// so this keeps the last of it; anything cut is said out loud rather than left to look like
// the whole story.
const OUTPUT_MAX = 8000

function tail(text: string): string | undefined {
  const out = text.trimEnd()
  if (!out) return undefined
  if (out.length <= OUTPUT_MAX) return out
  return `… (earlier output not shown)\n${out.slice(-OUTPUT_MAX)}`
}

// What a failing run said, in the agent's own words.
//
// stdout is the agent's event stream, so it goes through the SAME parser a run's log does —
// the words are the agent's, verbatim, lifted out of the transport format it wraps them in.
// Left raw, "the selected model may not exist" arrives as one field of a 4KB JSON line.
// stderr is already plain text and passes through untouched, after the stream, because that
// is the order the two happened in.
//
// Nothing is added: no summary, no guess at what went wrong, no advice. An explanation
// invented on top of a real error message sends people down the wrong path.
function said(events: string, result: string | undefined, stderr: string): string | undefined {
  const lines = events.replace(/\s+$/, '')
  // The renderer streams the closing turn and then reports the same text again as the
  // result. Show it once.
  const final = result?.trim()
  const body = final && !lines.endsWith(final) ? `${lines}\n${final}` : lines
  return tail(
    [body, stderr]
      .map((s) => s.replace(/\s+$/, ''))
      .filter(Boolean)
      .join('\n'),
  )
}

/** Send one small chat through the saved setup and say whether it worked. Never rejects:
 *  every way this can go wrong is a result worth showing. */
export function testConnection(runtime?: string): Promise<ConnectionTest> {
  // The same single read a run does, so the test can't be testing one setup while the next
  // run uses another. The id is thrown away with the run — nothing tracks this. `runtime`
  // points it at one runtime (#343); with none named it is the board's global one, which is
  // what setup's own step tests.
  const run = openPlan(planRun(randomUUID(), REPO_ROOT, runtime))
  const startedAt = Date.now()
  const [cmd, ...args] = run.argv
  // The same two shapes a run has (agent/watch.ts): a command that prints is handed the
  // prompt on its command line and judged by its exit code, and one that answers back is
  // asked the same small question inside a conversation and judged by how the turn ended.
  const client = run.client
  const stdio: [StdioNull | StdioPipe, StdioPipe, StdioPipe] = [client ? 'pipe' : 'ignore', 'pipe', 'pipe']

  return new Promise<ConnectionTest>((resolve) => {
    let events = ''
    let stderr = ''
    let settled = false
    // Set once the give-up timer exists. It can't be started before the spawn (it needs the
    // child to signal), and a spawn that fails outright settles before there is anything
    // to stop.
    let stopTimer = () => {}

    const done = (res: Omit<ConnectionTest, 'ms'>) => {
      if (settled) return
      settled = true
      stopTimer()
      resolve({ ...res, ms: Date.now() - startedAt })
    }

    // The one failure the board explains in its own words, because the raw error ("spawn
    // claude ENOENT") tells a user nothing.
    const spawnFailed = (e: unknown) => {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
        done({ ok: false, missing: cmd, install: run.install })
        return
      }
      // Any other spawn failure is already a real message from the operating system (a
      // binary that isn't executable, say), so it is shown as it came.
      done({ ok: false, output: said(events, run.renderer?.result(), `${stderr}\n${String(e)}`) })
    }

    // stdout and stderr are pipes whichever shape this is; only stdin differs.
    let child: ChildProcessByStdio<Writable | null, Readable, Readable>
    try {
      child = spawn(cmd!, client ? args : [...args, TEST_PROMPT], {
        // The project, not wherever this process happens to be sitting. Inside the app the
        // board is found through KANBAN_BOARD_DIR and the server's own cwd is its bundled
        // folder — an agent started there is outside the repo, and codex refuses to run at
        // all ("Not inside a trusted directory").
        cwd: REPO_ROOT,
        env: run.env,
        shell: false,
        // Same as a run: a piped stdin makes `claude -p` wait and then warn, which would
        // land in the output as if it were the failure — and it is a pipe, and stays open,
        // for the agent this end has to answer.
        stdio,
      }) as ChildProcessByStdio<Writable | null, Readable, Readable>
    } catch (e) {
      spawnFailed(e)
      return
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      const kill = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS)
      if (typeof kill.unref === 'function') kill.unref()
      // Whatever it managed to say before it stopped answering is still the best clue there
      // is, so it goes under the give-up line.
      done({
        ok: false,
        timedOut: true,
        output: said(events + (run.renderer?.flush() ?? ''), run.renderer?.result(), stderr + errs.flush()),
      })
    }, TIMEOUT_MS)
    if (typeof timer.unref === 'function') timer.unref()
    stopTimer = () => clearTimeout(timer)

    // Both streams are kept, because a CLI splits the reason across them: the event stream
    // on stdout, a warning on stderr. Neither alone is the story.
    const renderer = run.renderer
    if (renderer) {
      child.stdout.on('data', (d: Buffer) => {
        events += renderer.push(d.toString())
      })
    }
    // The agent's own housekeeping chatter is left out (agent/harnesses/types.ts). It matters
    // most here: a failed test shows this text in full, and a real reason buried under a
    // dozen identical cache warnings reads as if the cache warnings were the reason.
    const errs = createStderrFilter(run.quietStderr)
    child.stderr.on('data', (d: Buffer) => {
      stderr += errs.push(d.toString())
    })
    child.on('error', spawnFailed)

    // The same one small question, asked inside a conversation. How the turn ended is the
    // verdict here — the command is a server and exits only when we end it, so its code
    // says nothing — and the conversation itself is the test: a setup that can open a
    // session and get an answer is a setup a run starts on.
    const toAgent = client ? child.stdin : null
    if (client && !toAgent) {
      // Nothing to write to means the question can never be asked — said now rather than
      // sat through until the give-up timer.
      done({ ok: false, output: said(`nothing could be written to ${cmd}`, undefined, stderr) })
    } else if (client && toAgent) {
      void client
        .turn({
          stdout: child.stdout,
          stdin: toAgent,
          prompt: TEST_PROMPT,
          cwd: REPO_ROOT,
          log: (text) => {
            events += text
          },
          // The session this opens is thrown away with the test — nothing tracks it, the
          // same way nothing tracks the run id above.
          gotResumeId: () => {},
          gotModel: () => {},
        })
        .then((end) => {
          child.kill('SIGTERM')
          if (end.ok) done({ ok: true })
          else done({ ok: false, output: said(events, end.result, stderr) })
        })
    }

    child.on('close', (code) => {
      events += renderer?.flush() ?? ''
      stderr += errs.flush()
      // The exit code is the whole verdict. The agent answered or it didn't; what the
      // answer said is not the board's business — so a pass carries no output at all.
      // A conversation has already settled this by the time its command closes; only a
      // command that died before the turn ended reaches here, and that is a failure.
      if (code === 0 && !client) done({ ok: true })
      else done({ ok: false, output: said(events, renderer?.result(), stderr) })
    })
  })
}
