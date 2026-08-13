import { boardRules } from "./cli";
import { autoWorkAllowed } from "./desktop";
import { startSession } from "./registry";

// --- the dispatcher (#43, #139, #169) ----------------------------------------
// A background timer inside the local-UI server that works the board on its own, so it
// runs without being asked. It refines the cards a refine would move, and it runs the
// recurring cards whose cadence has elapsed. Neither is the only way that work starts — a
// card page's Refine and Run buttons do the same thing on one card on demand — but these
// are the ones that need no user at all.
//
// What it does NOT decide is which cards those are. That is `nextWork()` in the CLI: which
// cards a refine would move, in what order, how many may be going at once, and which
// recurring cards are due. The timer is this file's; the judgment is the board's, and the
// board is one place. A run started here is the same run `akb` starts.
//
// One process = one UI server, so a single timer pinned to globalThis is enough. It wakes
// once a minute and starts whatever comes back — which is also the floor under a cadence: a
// card set to repeat faster than the tick still runs once a tick, since the tick is the only
// moment anything is started.
//
// The one thing held here is whether to ask at all: in the desktop app a project keeps its
// own server, and a server the user has switched away from keeps running so the run inside
// it can finish (#178). Starting fresh work in a board nobody is looking at is the one
// thing that must not follow from that (see autoWorkAllowed in lib/desktop.ts).

const TICK_MS = 60_000;

// One pass. Never throws — a bad tick (unreadable board, missing rules, a spawn failure)
// must not kill the timer, so the next minute still tries.
async function tick(): Promise<void> {
  try {
    if (!autoWorkAllowed()) return;
    const rules = await boardRules();
    for (const req of rules.nextWork()) {
      // Each start is independently refused-or-not by the run record's own rules; a refusal
      // on one card is not a reason to skip the rest.
      await startSession(req, rules.buildPrompt(req));
    }
  } catch {
    // swallow — keep the timer alive for the next tick
  }
}

// Start the timer once. Idempotent and pinned to globalThis so Next re-evaluating this
// module (across its server bundles) can't leave two timers running. Called from the polled
// server actions, so the dispatcher is live for as long as the UI server is. `unref()` keeps
// the timer from holding the process open on its own.
export function ensureDispatcher(): void {
  const g = globalThis as unknown as { __kanbanDispatcher?: ReturnType<typeof setInterval> };
  if (g.__kanbanDispatcher) return;
  const timer = setInterval(() => void tick(), TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  g.__kanbanDispatcher = timer;
}
