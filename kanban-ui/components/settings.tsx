"use client";

// The compact parts a settings pane is built from: a captioned group, one row per
// setting, a switch and a status word. One row is one decision — its name on the left,
// its control on the right — so a pane reads as a list you can run your eye down rather
// than a page of paragraphs.

import { useState } from "react";

/** A captioned block of rows. `action` sits at the caption's right edge — a Check again,
 *  never a setting. */
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
      <div className="flex min-h-[26px] items-center justify-between gap-3 border-b border-nb-ink/15 pb-1.5">
        <h4 className="text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One setting: its name, at most one line of what it does, and its control. */
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
    <div className="flex items-center justify-between gap-4 border-b border-nb-ink/10 py-2.5 last:border-b-0 max-sm:flex-col max-sm:items-start max-sm:gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-[700] leading-tight text-nb-ink">{label}</p>
        {hint && (
          <p className="mt-1 max-w-[64ch] text-[12px] leading-snug text-nb-ink-soft">{hint}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** A row's right-hand answer, in words. Mint when the answer is "nothing to do" — the
 *  words say it too, so the colour is never the whole message. */
export function Status({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return (
    <span className={`text-[12.5px] font-[600] ${ready ? "text-nb-mint-ink" : "text-nb-ink-soft"}`}>
      {children}
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

/** The quiet text button a group's caption carries — Check again, Write it again. No
 *  frame: it sits in a caption row, and a framed button there reads as a setting. */
export const CAPTION_BTN =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-1.5 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors duration-100 hover:bg-nb-ink/[0.06] hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-50";
