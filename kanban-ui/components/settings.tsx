"use client";

// The parts every Configuration pane is built from: a captioned group, the card its settings
// sit in, one row per setting, and the switch, pill, button, box, note and alert that go in
// and around them. One row is one decision — its name on the left, its control on the right —
// so a pane reads as a list you can run your eye down rather than a page of paragraphs.
//
// A pane has no title of its own. The sidebar beside it already names it, and a heading
// repeating that word costs a line on every pane; the captions are the whole of the structure.
//
// What parts two groups is the card, not a rule. A pane of hairline-separated blocks made
// everything one flat list and left the eye to work out where a group started; a caption
// on the pane's ground with its settings in one inset under it says it before it is read.
// Anything that is not a setting — a note, a line to copy, a fold — stays outside the card,
// which is what keeps the card meaning "these are the things you can change".

import { useState } from "react";
import { FiAlertCircle } from "react-icons/fi";

/** Every small uppercase label in the dialog: a group's caption, a field's label, the
 *  heading over a list inside a row. One size and one tracking, so a pane has one voice for
 *  "this is what the block under me is". The colour is left to the caller — soft ink for a
 *  caption, full ink where the label is itself the answer. */
export const CAPTION = "text-[11px] font-[700] uppercase leading-[14px] tracking-[0.1em]";

/** A captioned block. `action` sits at the caption's right edge — a Check again, never a
 *  setting. */
export function Group({
  title,
  action,
  fill,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Take the whole pane's height — for the one group that is a workspace rather than a
   *  list, so the box under the caption grows with the dialog. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className="mb-2 flex min-h-[30px] shrink-0 items-center justify-between gap-3">
        <h4 className={`${CAPTION} text-nb-ink-soft`}>{title}</h4>
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

/** A row's mark, the slot it is centred in, and the column anything under that row starts
 *  on. The slot is fixed so a card whose marks are different sizes — a brand logo, an
 *  avatar, an icon — still reads as one left edge. */
export const MARK = 18;
const SLOT = "flex w-[26px] shrink-0 items-center justify-center";
const INDENT = "pl-[36px]";

/** One setting: its name, at most a line or two of what it does, and its control. `below`
 *  carries what will not fit on that line — where a connection posts, what a choice costs —
 *  indented under the label rather than under the mark. */
export function Row({
  label,
  hint,
  icon,
  below,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** A brand mark or an avatar, at the row's left edge. */
  icon?: React.ReactNode;
  below?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-nb-ink/10 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <span className={SLOT}>{icon}</span>}
          <div className="min-w-0">
            <p className="text-[13.5px] font-[700] leading-tight text-nb-ink">{label}</p>
            {hint && (
              <p className="mt-1 max-w-[62ch] text-[12px] leading-snug text-nb-ink-soft">{hint}</p>
            )}
          </div>
        </div>
        {children && <div className="flex shrink-0 items-center gap-2.5">{children}</div>}
      </div>
      {below && <div className={`mt-2 ${icon ? INDENT : ""}`}>{below}</div>}
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
  busy,
  onFlip,
}: {
  on: boolean | null;
  /** Read out loud in place of a visible On/Off word, which the switch already shows. */
  label: string;
  /** Another save on the same card is in flight. */
  busy?: boolean;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const held = on === null || busy || saving;
  const flip = async () => {
    if (held) return;
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
      disabled={held}
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

/** A quiet line outside the card — what a change applies to, an error a read hit, the line
 *  that says why a row has nothing to press. Nothing that needs a coloured box. */
export function Note({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-nb-ink-soft">
      {icon && (
        <span className="mt-[3px] shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      <span className="max-w-[74ch]">{children}</span>
    </p>
  );
}

/** A pane's one attention band — a refusal, a service that cannot be reached, what a
 *  removal is about to cost. Peach, and never for anything that is merely off. */
export function Alert({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="mt-2.5 flex items-start gap-2.5 rounded-[10px] bg-nb-peach-soft px-3.5 py-3"
      role="status"
    >
      <FiAlertCircle className="mt-[2px] shrink-0 text-nb-peach-ink" size={14} aria-hidden />
      <div className="min-w-0">
        {title && <p className="text-[12.5px] font-[800] text-nb-peach-ink">{title}</p>}
        <p className={`text-[12px] leading-relaxed text-nb-ink ${title ? "mt-1" : ""}`}>
          {children}
        </p>
      </div>
    </div>
  );
}

/** A pane still asking the board for its list. The pulse is the board's one standing
 *  exception to still motion. */
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] text-nb-ink-soft" aria-live="polite">
      <span
        className="size-1.5 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]"
        aria-hidden
      />
      {children}
    </p>
  );
}

/** The pane's one quiet button — a caption's Check again, a row's Sign out, a field's Save.
 *  Flat on a hairline: the dialog is already one raised block, and the button family's ink
 *  frame and hard shadow belong to the one action a pane is really about. */
export const QUIET_BTN =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-nb-ink/20 bg-nb-paper px-2.5 py-1.5 text-[12px] font-[700] text-nb-ink transition-[background-color,border-color,transform] duration-100 hover:border-nb-ink/35 hover:bg-nb-wash active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

/** The same button, for the one move that takes something away — peach, the palette's
 *  attention signal, so Remove reads apart from Rename beside it without shouting. */
export const DANGER_BTN =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-nb-peach/60 bg-nb-paper px-2.5 py-1.5 text-[12px] font-[700] text-nb-peach-ink transition-[background-color,border-color,transform] duration-100 hover:border-nb-peach hover:bg-nb-peach-soft active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

/** The pane's one box to type in, and the frame ui/select.tsx gives its trigger — so a list
 *  and a text box read as the same control. A hairline frame and an ember focus ring;
 *  `disabled` here is always a save in flight, hence the wait cursor. */
export const CONTROL =
  "w-full rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait";
