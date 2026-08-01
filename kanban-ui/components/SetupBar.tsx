"use client";

// The setup bar (#85), a strip between the header and the columns. It shows two
// things, and drops out when neither is true:
//
//  1. Setup is unfinished — `docs/kanban/setup-checklist.md` is still there. The
//     bar says how far setup got and what comes next. When the next step needs
//     the agent it hands over the line to paste into the coding harness; the
//     board never runs setup itself. When the step is the user's own (the goal),
//     it opens the goal editor instead.
//  2. Setup is long done but the agent has judged `goal.md` weak again. Then the
//     bar comes back with that one item — the goal nudge of old, unchanged.
//
// A board with no checklist and a goal that reads fine shows nothing, so boards
// set up before the checklist existed — and a board whose backlog is simply
// empty — stay quiet. Empty columns are never the signal; only the file is.
//
// It's a nudge, not a gate: the board works either way, and the ✕ hides it for
// the browser session (sessionStorage — nothing is written to the board files).

import { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiX } from "react-icons/fi";
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
  goalWeak,
  setupInstruction,
  onSaved,
}: {
  setup: SetupState | null;
  goalWeak: boolean;
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
  if (!setup && !goalWeak) return null;

  const next = setup?.next ?? null;
  const writesGoal = setup ? next?.name === GOAL_STEP : true;

  return (
    <div
      className="mx-6 mt-4 nb-panel-sm flex items-center gap-4 p-3.5"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <div className="min-w-0 flex-1">
        {setup ? (
          <p className="text-[13px] leading-snug">
            <span className="font-[800]">Setting up this board — {setup.done} of {setup.total} steps done.</span>{" "}
            {next ? (
              <span className="text-nb-ink-soft">
                Next: <Ticks text={next.text} />
              </span>
            ) : (
              <span className="text-nb-ink-soft">Finishing the last step.</span>
            )}
          </p>
        ) : (
          <p className="text-[13px] leading-snug">
            <span className="font-[800]">The project goal is missing or unclear.</span>{" "}
            <span className="text-nb-ink-soft">
              Every proposal the agent makes is judged against it. Say where the project is headed and
              roughly how far — rough and short is fine, you can change it later.
            </span>
          </p>
        )}
        {setup && <Meter done={setup.done} total={setup.total} />}
      </div>

      {writesGoal ? (
        <Button size="sm" className="shrink-0" onClick={() => setEditing(true)}>
          Write the goal
        </Button>
      ) : (
        <CopyLine text={setupInstruction} />
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        title="Hide for this session"
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90"
      >
        <FiX className="h-[16px] w-[16px]" />
      </button>

      {editing && (
        <GoalEditor
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            // Saving hides the bar for the session too: `reviewed:` stays weak
            // until an agent flow re-judges it, and nagging right after the user
            // wrote would be wrong. In setup, the refresh moves the bar on to the
            // next step — the save ticked the goal's box.
            dismiss();
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

// How far setup got, as a bar — the same meter a card's todo list uses, run the
// full width of the strip.
function Meter({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span
      className="mt-2 block h-[5px] w-full overflow-hidden rounded-full"
      style={{ background: "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)" }}
      role="img"
      aria-label={`Setup: ${done} of ${total} steps done`}
    >
      <span
        className="block h-full"
        style={{ width: `${pct}%`, background: "var(--color-nb-accent)" }}
      />
    </span>
  );
}

// The instruction to paste into the coding harness, with a copy button. The line
// is shown in full — a user without a working clipboard can still select it.
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
    <div className="flex min-w-0 shrink items-center gap-2">
      <code className="truncate rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper px-2.5 py-1.5 font-mono text-[12px] text-nb-ink">
        {text}
      </code>
      <Button size="sm" variant="ghost" className="shrink-0" onClick={copy} title="Copy for your coding agent">
        {copied ? <FiCheck className="h-[14px] w-[14px]" /> : <FiCopy className="h-[14px] w-[14px]" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
