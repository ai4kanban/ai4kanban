"use client";

// The compact parts a settings pane is built from: a captioned group, the card its
// settings sit in, one row per setting, a switch and a status pill. One row is one
// decision — its name on the left, its control on the right — so a pane reads as a list
// you can run your eye down rather than a page of paragraphs.
//
// What parts two groups is the card, not a rule. A pane of hairline-separated blocks made
// everything one flat list and left the eye to work out where a group started; a caption
// on the pane's ground with its settings in one inset under it says it before it is read.
// Anything that is not a setting — a note, a line to copy, a fold — stays outside the card,
// which is what keeps the card meaning "these are the things you can change".

import { useState } from "react";

/** A captioned block. `action` sits at the caption's right edge — a Check again, never a
 *  setting. */
export function Group({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex min-h-[30px] items-center justify-between gap-3">
        <h4 className="text-[11px] font-[700] uppercase tracking-[0.1em] text-nb-ink-soft">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The card a group's settings sit in — one quiet inset inside the dialog, so a hairline
 *  frame and no shadow. Its own side padding is what insets the rules between its rows. */
export function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-nb-ink/12 bg-nb-sheet px-4">{children}</div>;
}

/** One setting: its name, at most a line or two of what it does, and its control. */
export function Row({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-nb-ink/10 py-3 last:border-b-0 max-sm:flex-col max-sm:items-start max-sm:gap-2">
      <div className="min-w-0">
        <p className="text-[13.5px] font-[700] leading-tight text-nb-ink">{label}</p>
        {hint && (
          <p className="mt-1 max-w-[62ch] text-[12px] leading-snug text-nb-ink-soft">{hint}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** A row's right-hand answer: a dot you can glance at and the word itself in a pill. Mint
 *  when the answer is "nothing to do" — the word says it too, so the colour is never the
 *  whole message. */
export function Status({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="size-[8px] shrink-0 rounded-full"
        style={{
          background: ready
            ? "var(--color-nb-mint-ink)"
            : "color-mix(in srgb, var(--color-nb-ink) 28%, transparent)",
        }}
        aria-hidden
      />
      <span
        className="rounded-[7px] px-2.5 py-1 text-[12px] font-[700] leading-none"
        style={{
          background: ready
            ? "var(--color-nb-mint-soft)"
            : "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)",
          color: ready ? "var(--color-nb-mint-ink)" : "var(--color-nb-ink-soft)",
        }}
      >
        {children}
      </span>
    </span>
  );
}

/** One on/off setting. `on` is null until the board has answered, and the switch stands
 *  down until then. The new side is drawn at once and put back if the save fails — a
 *  switch that silently didn't land is a setting nobody can trust. */
export function Switch({
  on,
  label,
  onFlip,
}: {
  on: boolean | null;
  /** Read out loud in place of a visible On/Off word, which the switch already shows. */
  label: string;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const flip = async () => {
    if (on === null || saving) return;
    setSaving(true);
    try {
      await onFlip(!on);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on === true}
      aria-label={label}
      disabled={on === null || saving}
      onClick={() => void flip()}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-nb-ink transition-[background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-nb-accent" : "bg-nb-wash"
      }`}
    >
      <span
        className={`inline-block size-[16px] rounded-full border border-nb-ink bg-nb-paper transition-transform duration-150 ${
          on ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
        aria-hidden
      />
    </button>
  );
}

/** The button a group's caption carries — Check again. It sits outside the card, on the
 *  pane's own ground, so it takes a hairline frame to read as something you press. */
export const CAPTION_BTN =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-nb-ink/20 bg-nb-paper px-2.5 py-1.5 text-[12px] font-[700] text-nb-ink transition-colors duration-100 hover:border-nb-ink/35 hover:bg-nb-wash focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-50";
