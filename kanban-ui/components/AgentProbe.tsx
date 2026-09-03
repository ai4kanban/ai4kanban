"use client";

// Finding the agent instead of asking for it (#404).
//
// The first thing a new install used to ask for was a setting: pick an agent, fill in its
// fields, press Test. Someone who already runs Claude Code had nothing to decide there, and
// someone who runs nothing was asked for a key before the product had shown them anything.
//
// So the agent step answers itself first. The machine is asked which agents it has that could
// run on what is already saved, and each is tried in declared order with the same call the
// Test button makes — one at a time, stopping at the first that answers. The picker is what
// happens when that fails, not what happens first.
//
// Three rules hold it together:
//
//   • Nothing is settled until one answers. Trying an agent writes the board's harness, so a
//     probe that ends with no answer — and one the user walks out of — writes back what the
//     board named before it started. The picker then opens on that, never on the last agent
//     tried.
//   • Nothing cuts it short. No time limit and no cap: a machine with four logged-out CLIs
//     works through all four unless the user takes the link.
//   • Nothing is drawn until there is something to say. Asking the machine what it has spawns
//     nothing and comes back in milliseconds, and a machine with nothing worth trying goes
//     straight to the picker — the probing view never flashes past.

import { useEffect, useRef, useState } from "react";
import {
  finishSetupAgentStepAction,
  runnableAgentsAction,
  setHarnessAction,
  testConnectionAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { AgentInfo, ConnectionTest } from "@/lib/types";

// How long the agent that answered stays on screen before the flow moves on. It is the one
// place the user is told which agent the board was set up with, so it has to be readable —
// and it is a name, not a sentence, so this is all it takes.
const NAMED_MS = 1100;

/** Where the probe has got to. `asking` and `trying` own the whole window; `done` is the
 *  probe standing aside for the picker, carrying what the last agent said when one failed. */
export type ProbeState =
  | { at: "off" }
  | { at: "asking" }
  | { at: "trying"; label: string }
  | { at: "found"; label: string }
  | { at: "done"; failed: ConnectionTest | null };

/** Try the agents this machine has, one at a time, and settle the step on the first that
 *  answers. One pass, started once when the agent step mounts: a step already answered is
 *  never probed, and a probe the user walked out of stays walked out of. */
export function useAgentProbe({
  on,
  agent,
  onSettled,
}: {
  /** Whether this is the agent step, still unanswered. False anywhere else, and then the
   *  probe never starts and never draws. */
  on: boolean;
  agent: AgentInfo;
  /** An agent answered and setup's agent box is ticked — the same hand-off the Test button
   *  makes. The flow moves to the project step from here. */
  onSettled: (agent: AgentInfo) => void;
}): { state: ProbeState; leave: () => void } {
  const [state, setState] = useState<ProbeState>(() => (on ? { at: "asking" } : { at: "off" }));
  // What the board named before anything was written, and whether anything was. Both are the
  // whole of putting the setting back: the probe writes one key, `harness`, and only ever
  // for an agent it is about to try.
  const was = useRef(agent.name);
  const wrote = useRef(false);
  // The user took the link, or an agent answered. Either ends the pass: whatever the CLI in
  // flight comes back with settles nothing and moves nothing on.
  const over = useRef(false);
  const settle = useRef(onSettled);
  settle.current = onSettled;
  // Read at mount and never again — this is one pass, not something a re-render restarts.
  const start = useRef(on);
  const labels = useRef(agent.options);
  labels.current = agent.options;

  useEffect(() => {
    if (!start.current) return;
    let alive = true;
    const stopped = (): boolean => !alive || over.current;
    const restore = (): void => {
      if (!wrote.current) return;
      wrote.current = false;
      void setHarnessAction(was.current).catch(() => {});
    };
    const label = (name: string): string =>
      labels.current.find((o) => o.name === name)?.label ?? name;

    void (async () => {
      const names = await runnableAgentsAction().catch(() => [] as string[]);
      if (stopped()) return;
      // Nothing on this machine can be tried, so there is nothing to show trying it. The
      // picker draws first, exactly as it did before any of this existed.
      if (names.length === 0) return setState({ at: "done", failed: null });

      let failed: ConnectionTest | null = null;
      for (const name of names) {
        if (stopped()) return;
        setState({ at: "trying", label: label(name) });
        // The test spawns whatever the board's setting names, so trying an agent means
        // saving it first. This is the one write the probe makes, and it is undone below.
        // Marked as written before the write, not after: the user can take the link while it
        // is in flight, and a setting nobody remembers writing is a setting nobody puts back.
        wrote.current = true;
        const picked = await setHarnessAction(name).catch(() => ({ ok: false }));
        if (stopped()) return;
        if (!picked.ok) continue;
        const answer = await testConnectionAction().catch((e) => ({
          ok: false,
          ms: 0,
          output: e instanceof Error ? e.message : String(e),
        }));
        if (stopped()) return;
        if (!answer.ok) {
          failed = answer;
          continue;
        }
        // It answered. The board's harness is already this agent, so all that is left is the
        // box the Test button ticks.
        const done = await finishSetupAgentStepAction();
        if (stopped()) return;
        over.current = true;
        if (!done.ok || !done.agent) {
          // The agent works and the setting is right; only the tick failed. Keeping the
          // agent that answered is the honest end of that, so the picker takes over on it
          // with the reason on screen.
          wrote.current = false;
          return setState({ at: "done", failed: { ok: false, ms: 0, output: done.error } });
        }
        setState({ at: "found", label: label(name) });
        await new Promise((r) => setTimeout(r, NAMED_MS));
        if (!alive) return;
        // Named and read, so the probe stands aside before handing over: the flow's next
        // step draws in this window, and a view still saying "found" would hold it.
        setState({ at: "done", failed: null });
        return settle.current(done.agent);
      }

      // Nothing answered. Put the setting back before the picker draws, so it opens on the
      // agent the board named rather than on the last one tried.
      if (stopped()) return;
      restore();
      setState({ at: "done", failed });
    })();

    return () => {
      alive = false;
      // The window went away mid-probe — closed, or stepped off onto the screens behind
      // "Enter details manually". Nothing was settled, so nothing stays written.
      if (!over.current) restore();
    };
  }, []);

  const leave = (): void => {
    if (over.current) return;
    over.current = true;
    if (wrote.current) {
      wrote.current = false;
      void setHarnessAction(was.current).catch(() => {});
    }
    // Nothing failed — the user simply wants the picker — so it opens clean.
    setState({ at: "done", failed: null });
  };

  return { state, leave };
}

/** The probe as the user meets it: one full window, a character at work in the middle of it,
 *  and the line saying which agent is being tried. No picker, no fields, nothing to
 *  configure — the one control is the way out to the picker. */
export function AgentProbeView({
  label,
  settled,
  onPicker,
}: {
  label: string;
  /** This agent answered, and it is being named on the way past. */
  settled: boolean;
  onPicker: () => void;
}) {
  const c = useCopy().setup.firstRun.agent;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-nb-paper px-6 py-10">
      <AgentSprite />
      <p aria-live="polite" className="text-[17px] font-[700] leading-snug">
        {settled ? c.found(label) : c.trying(label)}
      </p>
      {/* Kept in place once an agent has answered rather than taken away: the view is a
          moment from moving on, and a line that jumps as it goes reads as a glitch. */}
      <button
        type="button"
        className={`cursor-pointer text-[13px] font-[700] text-nb-accent-deep underline-offset-2 hover:underline ${
          settled ? "invisible" : ""
        }`}
        onClick={onPicker}
      >
        {c.bySelf}
      </button>
    </div>
  );
}

/** The character. Pixel art on a 12-unit grid: every edge is on the grid and every rect is a
 *  whole number of cells, so it stays crisp at any size the view gives it.
 *
 *  It hops on two frames — down, up, down — rather than gliding, because a sprite that eases
 *  is not a sprite. Its own shadow keeps the same beat, which is what makes the ground read
 *  as ground. Both stand still for a user who asked the system for less motion. */
function AgentSprite() {
  const ink = "var(--color-nb-ink)";
  const paper = "var(--color-nb-paper)";
  const ember = "var(--color-nb-accent)";
  return (
    <svg viewBox="0 0 12 17" width={96} height={136} shapeRendering="crispEdges" aria-hidden>
      {/* The ground it lands on, squashing as the character leaves it. */}
      <rect className="a4k-sprite-shadow" x="3" y="16" width="6" height="1" fill={ink} />
      <g className="a4k-sprite">
        {/* antenna */}
        <rect x="5" y="0" width="2" height="1" fill={ember} />
        <rect x="5" y="1" width="2" height="1" fill={ink} />
        {/* head */}
        <rect x="2" y="2" width="8" height="5" fill={ink} />
        <rect x="3" y="3" width="6" height="3" fill={paper} />
        <rect x="4" y="4" width="1" height="1" fill={ember} />
        <rect x="7" y="4" width="1" height="1" fill={ember} />
        {/* neck */}
        <rect x="5" y="7" width="2" height="1" fill={ink} />
        {/* arms, held off the body so they read as arms rather than corners */}
        <rect x="0" y="9" width="1" height="3" fill={ink} />
        <rect x="11" y="9" width="1" height="3" fill={ink} />
        {/* body */}
        <rect x="2" y="8" width="8" height="5" fill={ink} />
        <rect x="3" y="9" width="6" height="3" fill={paper} />
        <rect x="4" y="10" width="4" height="1" fill={ember} />
        {/* legs */}
        <rect x="3" y="13" width="2" height="2" fill={ink} />
        <rect x="7" y="13" width="2" height="2" fill={ink} />
      </g>
    </svg>
  );
}
