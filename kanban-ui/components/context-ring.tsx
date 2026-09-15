"use client";

// How full the model's context window is (#675) — one small ring, drawn the same beside a
// conversation's message box and in a run's title bar.
//
// It draws NOTHING unless both numbers are known. A connector that never counts the prompt
// (Cursor), one whose protocol only reports a session total (dsh, Grok), a model the
// catalogue has never heard of — all of them leave the row exactly as it was, with no
// placeholder standing in for a number nobody has.

import { useCopy } from "@/i18n/use-copy";
import type { ContextWindow } from "@/lib/types";

/** A token count short enough to sit in a tip: `840`, `100k`, `1.2M`. Rounded on purpose —
 *  the ring is a sense of how full the window is, and a digit-exact figure would read as a
 *  precision the counts don't have. */
function short(tokens: number): string {
  if (tokens < 1_000) return String(Math.round(tokens));
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  const millions = tokens / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1).replace(/\.0$/, "") : Math.round(millions)}M`;
}

// 14px across, which is the smallest ring whose arc still reads at a glance. The circle is
// turned a quarter so the arc starts at the top, and the dash pattern is the whole
// circumference so `strokeDashoffset` alone says how far round it goes.
const R = 5.25;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ContextRing({
  context,
  ink,
}: {
  context: ContextWindow | undefined;
  /** Drawn on the run office's ink title bar (#760), where the ink strokes disappear. */
  ink?: boolean;
}) {
  const c = useCopy().shared;
  const used = context?.used;
  const limit = context?.limit;
  if (!used || !limit) return null;
  // Full is full: a prompt over the window happens — a connector counts its own overhead in,
  // a catalogue's figure is a notch under what the model really runs — and a ring past its
  // own circle would read as a bug. The two numbers in the tip stay as they were counted.
  const filled = Math.min(1, used / limit);
  const label = c.contextWindow(short(used), short(limit));
  return (
    <button
      type="button"
      // A button rather than a bare span so a keyboard reaches it: the ring writes nothing
      // down, and its whole purpose is the tip it carries.
      className="nb-tip inline-flex shrink-0 cursor-default rounded-full p-0.5 outline-offset-1 focus-visible:outline-2 focus-visible:outline-nb-accent"
      data-tip={label}
      aria-label={label}
    >
      <svg viewBox="0 0 14 14" className="size-[14px] -rotate-90" aria-hidden>
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          className={ink ? "stroke-nb-cream/25" : "stroke-nb-ink/12"}
          strokeWidth="2.5"
        />
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          className={ink ? "stroke-nb-cream/85" : "stroke-nb-ink-soft"}
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
        />
      </svg>
    </button>
  );
}
