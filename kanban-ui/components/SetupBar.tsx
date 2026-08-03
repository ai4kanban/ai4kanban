"use client";

// The setup card (#85), floating over the board's bottom-right corner. It sits
// outside the layout on purpose: setup is a nudge running alongside the work,
// not a band the board has to start below, so nothing shifts when it appears or
// goes. It shows two things, and drops out when neither is true:
//
//  1. Setup is unfinished — `docs/kanban/setup-checklist.md` is still there. The
//     bar says how far setup got and what comes next. When the next step needs
//     the agent it hands over the line to paste into the coding harness; the
//     board never runs setup itself. When the step is the user's own (the goal),
//     it opens the goal editor instead.
//  2. Setup is long done but there is no goal to plan from — `goal.md` is empty,
//     or the agent has judged it weak again. Then the bar comes back with that
//     one item, the goal.
//
// A board with no checklist and a goal that reads fine shows nothing, so boards
// set up before the checklist existed — and a board whose backlog is simply
// empty — stay quiet. Empty columns are never the signal; only the file is.
//
// It's a nudge, not a gate: the board works either way, and the ✕ hides it for
// the browser session (sessionStorage — nothing is written to the board files).

import { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiFlag, FiX } from "react-icons/fi";
import type { SetupState } from "@/lib/types";
import { Button } from "./button";
import { GoalEditor } from "./Goal";

const DISMISS_KEY = "kanban-ui.setup-bar-dismissed";

// The checklist's own step for writing the goal. The bar gives this one a button
// — it's the step the board can finish itself — and every other step the line to
// paste. The name is the script's (skill/lib/setup.mjs).
const GOAL_STEP = "goal";

export function SetupBar({
  setup,
  goalNeedsWork,
  setupInstruction,
  onSaved,
}: {
  setup: SetupState | null;
  goalNeedsWork: boolean;
  /** The line to paste into the coding harness — one wording, from lib/agent.ts. */
  setupInstruction: string;
  onSaved: () => void;
}) {
  // Start hidden and reveal after mount: sessionStorage doesn't exist during
  // SSR, so reading it in the first render would mismatch the server markup.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const [editing, setEditing] = useState(false);

  if (dismissed) return null;
  if (!setup && !goalNeedsWork) return null;

  const next = setup?.next ?? null;
  const writesGoal = setup ? next?.name === GOAL_STEP : true;

  return (
    <div
      className="nb-panel fixed bottom-5 right-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] animate-[nbPopIn_150ms_ease] p-3.5"
      style={{ background: "color-mix(in srgb, var(--color-nb-accent-soft) 45%, var(--color-nb-paper))" }}
    >
      {/* Top line: how far setup got, or — with no checklist left — what this is
          about at all. The ✕ rides along with it, away from the button. */}
      <div className="flex items-center gap-2">
        {setup ? (
          <Meter done={setup.done} total={setup.total} />
        ) : (
          <span className="nb-tag">
            {/* Inline color: `.nb-tag` sets the ink on itself, so the one bit of
                accent has to be put on the icon directly. */}
            <FiFlag
              className="h-[12px] w-[12px]"
              style={{ color: "var(--color-nb-accent)" }}
              aria-hidden
            />
            Project goal
          </span>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          title="Hide for this session"
          className="-mr-1 -mt-0.5 ml-auto grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/8 hover:text-nb-ink active:scale-90"
        >
          <FiX className="h-[14px] w-[14px]" />
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-snug">
        {setup ? (
          <>
            <span className="font-[750]">Setting up this board.</span>{" "}
            {next ? (
              <span className="text-nb-ink-soft">
                Next: <Ticks text={next.text} />
              </span>
            ) : (
              <span className="text-nb-ink-soft">Finishing the last step.</span>
            )}
          </>
        ) : (
          <>
            <span className="font-[750]">The project goal is missing or unclear.</span>{" "}
            <span className="text-nb-ink-soft">
              Every proposal the agent makes is judged against it. Say where the project is headed and
              roughly how far — rough and short is fine, you can change it later.
            </span>
          </>
        )}
      </p>

      {writesGoal ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => setEditing(true)}>
            Write the goal
          </Button>
        </div>
      ) : (
        <CopyLine text={setupInstruction} />
      )}

      {editing && (
        <GoalEditor
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            // The refresh is enough to clear the bar now: a saved goal is written
            // and `reviewed: pending`, so the board stops asking. In setup, the
            // same refresh moves the bar on to the next step — the save ticked
            // the goal's box.
            onSaved();
          }}
        />
      )}
    </div>
  );
}

// The checklist writes a step's file paths in backticks. Render them as code and
// leave the rest as plain text — the step's wording is the script's, shown as
// written.
function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="font-mono text-[12px]">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// How far setup got: one short segment per step, filled as far as it got, with
// the count beside it. A bar run the width of the strip read as a stray rule —
// a handful of steps is small enough to just show them.
function Meter({ done, total }: { done: number; total: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-2"
      role="img"
      aria-label={`Setup: ${done} of ${total} steps done`}
    >
      <span className="flex items-center gap-[4px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="h-[6px] w-[26px] rounded-[3px]"
            style={{
              background:
                i < done
                  ? "var(--color-nb-accent)"
                  : "color-mix(in srgb, var(--color-nb-ink) 18%, transparent)",
            }}
          />
        ))}
      </span>
      <span className="font-mono text-[13px] font-[700] text-nb-ink-soft tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

// The instruction to paste into the coding harness, with a copy button. The line
// is shown in full — a user without a working clipboard can still select it — so
// it wraps inside the card rather than being cut to one row.
function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard permission (or no clipboard at all) — the line is on screen
      // to select by hand, so there is nothing to report.
    }
  };

  return (
    <div className="mt-3">
      <code className="block rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper px-2.5 py-1.5 font-mono text-[11.5px] leading-snug text-nb-ink">
        {text}
      </code>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="ghost" onClick={copy} title="Copy for your coding agent">
          {copied ? <FiCheck className="h-[14px] w-[14px]" /> : <FiCopy className="h-[14px] w-[14px]" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
