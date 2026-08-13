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

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { openPlan, planRun } from './resolve'
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
export function testConnection(): Promise<ConnectionTest> {
  // The same single read a run does, so the test can't be testing one setup while the next
  // run uses another. The id is thrown away with the run — nothing tracks this.
  const run = openPlan(planRun(randomUUID()))
  const startedAt = Date.now()
  const [cmd, ...args] = run.argv

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
      done({ ok: false, output: said(events, run.renderer.result(), `${stderr}\n${String(e)}`) })
    }

    let child
    try {
      child = spawn(cmd!, [...args, TEST_PROMPT], {
        cwd: process.cwd(),
        env: run.env,
        shell: false,
        // Same as a run: a piped stdin makes `claude -p` wait and then warn, which would
        // land in the output as if it were the failure.
        stdio: ['ignore', 'pipe', 'pipe'],
      })
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
        output: said(events + run.renderer.flush(), run.renderer.result(), stderr),
      })
    }, TIMEOUT_MS)
    if (typeof timer.unref === 'function') timer.unref()
    stopTimer = () => clearTimeout(timer)

    // Both streams are kept, because a CLI splits the reason across them: the event stream
    // on stdout, a warning on stderr. Neither alone is the story.
    child.stdout.on('data', (d: Buffer) => {
      events += run.renderer.push(d.toString())
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', spawnFailed)
    child.on('close', (code) => {
      events += run.renderer.flush()
      // The exit code is the whole verdict. The agent answered or it didn't; what the
      // answer said is not the board's business — so a pass carries no output at all.
      if (code === 0) done({ ok: true })
      else done({ ok: false, output: said(events, run.renderer.result(), stderr) })
    })
  })
}
