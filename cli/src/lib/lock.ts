// One writer at a time on one board.
//
// Every writing move reads a file, changes it, and writes it back — next-id most of all.
// Two moves running at once would read the same id, and one of them would hand out a
// number the other already used. That was theory while a human typed one command at a
// time; it stops being theory the moment the UI and a terminal both drive the same board.
//
// The lock is a directory, because making one is atomic on every filesystem we run on:
// either mkdir succeeds and the lock is ours, or it fails because someone holds it. It is
// per board — two boards are two locks, so working on both at once never makes either wait.
//
// Inside the folder sits one file naming the process that took it. Without it, a waiter
// can't tell a writer that is mid-write from a lock a killed run left behind, so it waits
// the full ten seconds for a holder that no longer exists — and because the board server
// runs the same code in its own process, that wait stops every screen answering. With it,
// a waiter asks whether that process is still alive and takes over the moment it isn't.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, KANBAN, LOCK } from './paths'

// How long to keep trying before giving up. A board move is milliseconds of work, so any
// real wait here means another process is mid-write, not that the board is slow.
const WAIT_MS = 10_000
// The fallback for a lock that names nobody: one taken by a CLI older than the owner file,
// or caught in the instant between the folder being made and the name being written. A lock
// older than this belongs to a process that died holding it. Nothing takes this long, so
// breaking it is safe and beats a board that refuses every write until someone deletes a
// folder by hand.
const STALE_MS = 60_000
const RETRY_MS = 25
// Who holds the lock, written inside it as the holder's process id and nothing else.
const OWNER = 'owner'
// The one waiter breaking a dead lock leaves this behind it while it does (see claimBreak).
const BREAKING = 'breaking'

// Sleep without going async: every move is synchronous, and making them all async to wait
// a few milliseconds would rewrite the whole board for no gain.
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function ageOf(dir: string): number {
  try {
    return Date.now() - fs.statSync(dir).mtimeMs
  } catch {
    return 0
  }
}

/** Signal 0 doesn't kill; it just asks "is this pid alive and can I signal it?". EPERM means
 *  alive but owned by someone else — still alive. */
export function pidAlive(pid?: number): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// Who holds this lock, or undefined for a lock that names nobody — which is what the age
// rule above is for.
function ownerOf(dir: string): number | undefined {
  try {
    const pid = Number(fs.readFileSync(path.join(dir, OWNER), 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

// Claim the right to take a dead lock away. Two waiters can judge the same lock dead in the
// same instant, and two deletes racing would have the second one delete the fresh lock the
// first just took — leaving two writers writing at once, the one thing the lock exists to
// stop. mkdir settles which of them breaks it, the same way it settles who holds the lock;
// the loser waits and races for the lock itself. The marker sits inside the lock's own
// folder, so it never outlives it and git never sees it.
function claimBreak(dir: string): boolean {
  try {
    fs.mkdirSync(path.join(dir, BREAKING))
    return true
  } catch {
    // Another waiter is breaking it, or it is already gone — either way the retry sorts it.
    return false
  }
}

// Take one lock folder, run `fn`, release it however `fn` ends — so a refused move never
// leaves anything locked. `what` names the lock in the refusal, since a board has more
// than one now: the writing lock below, and the record of what is running.
export function withLock<T>(dir: string, what: string, fn: () => T): T {
  const until = Date.now() + WAIT_MS
  let held: number | undefined
  for (;;) {
    try {
      fs.mkdirSync(dir, { recursive: false })
      // Ours. Say so, so the next writer along can tell us from a lock nobody holds. Failing
      // to write the name is not worth failing the move over: a lock naming nobody is what
      // the age rule below is for, and refusing here would leave the folder locked instead.
      try {
        fs.writeFileSync(path.join(dir, OWNER), `${process.pid}\n`)
      } catch {
        // no name on it — the age rule covers it
      }
      break
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        // The board folder isn't there yet — make it and race again.
        fs.mkdirSync(path.dirname(dir), { recursive: true })
        continue
      }
      if (code !== 'EEXIST') throw err
      // The backstop, for every lock the check below can't judge: one from a CLI too old to
      // name its holder, and one whose breaker died mid-break.
      if (ageOf(dir) > STALE_MS) {
        fs.rmSync(dir, { recursive: true, force: true })
        continue
      }
      held = ownerOf(dir)
      // Whoever held this is gone — a killed run, a closed laptop. Take it over now rather
      // than making every writer, and every screen the board server owes an answer to, wait
      // out a holder that no longer exists.
      if (held !== undefined && !pidAlive(held) && claimBreak(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
        continue
      }
      if (Date.now() > until) {
        die(
          `another command is ${what}${held ? ` (process ${held})` : ''} and did not finish ` +
            `in ${WAIT_MS / 1000}s. If nothing else is running, remove ${rel(dir)}/ and try again.`,
          'board-busy',
        )
      }
      sleep(RETRY_MS)
    }
  }
  try {
    return fn()
  } finally {
    // Only ours to release. If a waiter decided we were dead and another writer has the lock
    // now, deleting the folder would be deleting theirs mid-write.
    const owner = ownerOf(dir)
    if (owner === undefined || owner === process.pid) fs.rmSync(dir, { recursive: true, force: true })
  }
}

// How deep this process already is inside the board's own lock. The board's operations hold
// it around their file work (lib/board/local.ts), and one of them may call another — a
// scheduled card's mark comes off inside the pass that hands its run back. Without this the
// inner call would wait ten seconds for a lock this very process holds and then refuse.
// Only synchronous nesting counts, which is all there is: nothing holds this lock across an
// `await`.
let depth = 0

// Run `fn` with this board's writing lock held.
export function withBoardLock<T>(fn: () => T): T {
  // No board yet (a fresh `init`) — there is nothing for a second writer to corrupt, and
  // creating the folder here would make `init` think the board already exists.
  if (!fs.existsSync(KANBAN)) return fn()
  if (depth > 0) return fn()
  depth++
  try {
    return withLock(LOCK, 'writing this board', fn)
  } finally {
    depth--
  }
}

// The lock folder is transient — it exists for the milliseconds a write takes. It only
// ever reaches git if a process is killed mid-write, which is exactly when nobody should
// be asked to think about it.
export const LOCK_IGNORE_LINE = '.lock/'
