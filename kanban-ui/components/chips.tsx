"use client";

import { useEffect, useState } from "react";
import { FiBox, FiCheckCircle, FiClock, FiFlag, FiHelpCircle, FiLayers, FiLock, FiPlayCircle, FiRepeat, FiTag, FiUser } from "react-icons/fi";
import type { IconType } from "react-icons";
import { type CadenceUnit, formatCadence, parseCadence } from "@/lib/cadence";
import type { QuestionTag } from "@/lib/questions";
import { NO_RELEASE, type CardStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Meaning-coded chips + level selects, all built from the design language's
// borderless pill and quiet select. Priority/roi map onto the signal pastels.

// The pickable chips below are ui/select.tsx dressed down to nb-chip size: the
// trigger drops the CONTROL frame (the wrapper's meaning fill is the only
// chrome) and the open list shrinks its type to match. The 1em icons follow.
const CHIP_TRIGGER =
  "h-auto w-auto gap-1 rounded-[6px] border-0 px-[6px] py-[2.5px] text-[10px] font-[700] uppercase tracking-[0.04em] leading-none";
const CHIP_ITEM = "py-1.5 pr-7 text-[10px] font-[700] uppercase tracking-[0.04em]";

// One high/med/low scale shared by priority and roi. `dot` is the solid signal
// colour; `soft`/`ink` are the filled-chip pair.
const LEVEL: Record<string, { soft: string; ink: string; dot: string }> = {
  high: {
    soft: "var(--color-nb-peach-soft)",
    ink: "var(--color-nb-peach-ink)",
    dot: "var(--color-nb-peach)",
  },
  med: {
    soft: "var(--color-nb-sky-soft)",
    ink: "var(--color-nb-sky-ink)",
    dot: "var(--color-nb-sky)",
  },
  low: {
    soft: "var(--color-nb-wash)",
    ink: "var(--color-nb-ink-soft)",
    dot: "color-mix(in srgb, var(--color-nb-ink) 28%, transparent)",
  },
};

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ display: "block", width: 5, height: 5, borderRadius: 999, flex: "0 0 auto", background: color }}
    />
  );
}

// Priority — the hero signal on a card. Filled chip carrying the level word
// itself (high/med/low); a flag marks it as priority so we never fall back to a
// cryptic "P" label.
export function PriorityChip({ value }: { value: string }) {
  const c = LEVEL[value] || LEVEL.low;
  return (
    <span className="nb-chip" style={{ background: c.soft, color: c.ink }}>
      <FiFlag aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {value}
    </span>
  );
}

// ROI — secondary. Dot + muted label, no fill, so it reads one rung below the
// priority chip instead of mirroring it as a second identical pill.
export function RoiTag({ value }: { value: string }) {
  const c = LEVEL[value] || LEVEL.low;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
      <Dot color={c.dot} />
      ROI {value}
    </span>
  );
}

// Todo progress — a thin bar + count for the card's top meta row. Reads as
// status (empty → full, mint when complete) rather than yet another chip.
// `width` lets the card page draw a longer bar than the board's 26px sliver.
export function TodoProgress({ done, total, width = 26 }: { done: number; total: number; width?: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          display: "block",
          width,
          height: 4,
          borderRadius: 999,
          overflow: "hidden",
          background: "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: complete ? "var(--color-nb-mint)" : "var(--color-nb-accent)",
          }}
        />
      </span>
      <span className="text-[10.5px] font-[700] tabular-nums text-nb-ink-soft">
        {done}/{total}
      </span>
    </span>
  );
}

// The card's saved stage, shown when no agent is running on it (a live session
// shows the RunningBadge instead — one mark per card, never both). `todo` is the
// resting default and shows nothing, so the board stays quiet until a card is
// vetted or in flight. `ready` (mint) marks a vetted card the user can scan for.
//
// Each stage carries an icon so the pill reads as a state marker (like the
// PriorityChip flag), not a stray word, plus a `long` phrase for when it stands
// alone with room to spare (the card page) vs. the terse `label` used in the
// board's tight chip row.
const STATUS: Record<string, { label: string; long: string; icon: IconType; soft: string; ink: string }> = {
  ready: {
    label: "ready",
    long: "Ready to implement",
    icon: FiCheckCircle,
    soft: "var(--color-nb-mint-soft)",
    ink: "var(--color-nb-mint-ink)",
  },
  implementing: {
    label: "implementing",
    long: "Being implemented",
    icon: FiPlayCircle,
    soft: "var(--color-nb-accent-soft)",
    ink: "var(--color-nb-accent-deep)",
  },
};

export function StatusPill({ status, detailed = false }: { status: CardStatus; detailed?: boolean }) {
  const c = STATUS[status];
  if (!c) return null; // `todo` — no pill
  const Icon = c.icon;
  return (
    <span className="nb-chip" style={{ background: c.soft, color: c.ink }}>
      <Icon aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {detailed ? c.long : c.label}
    </span>
  );
}

// Group marker — flags a board card as a group root. A layers icon reads as
// "stacked cards" so the group is obvious at a glance; the progress bar next to
// it already carries the tally (root todos), so the chip stays a pure marker and
// names itself on hover instead of stamping a number that competes with the bar.
export function GroupChip() {
  return (
    <span
      className="nb-chip nb-tip"
      tabIndex={0}
      data-tip="Group task — open its page for subtasks"
      style={{ background: "var(--color-nb-lilac-soft)", color: "var(--color-nb-lilac-ink)" }}
    >
      <FiLayers aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
    </span>
  );
}

// Blocked marker — the card's `blocked_by` still names an open card, so starting
// it now means starting out of order. Peach, the same colour the card page gives
// its Blocked-by chips, so the two read as one thing. Icon-only like GroupChip:
// the board's chip row is tight, and the tooltip carries which cards are in the
// way. A marker only — the card stays on the board and every button still works.
export function BlockedChip({ blockers }: { blockers: { id: number; title: string }[] }) {
  const ids = blockers.map((b) => `#${b.id}`).join(", ");
  return (
    <span
      className="nb-chip nb-tip"
      tabIndex={0}
      data-tip={`Blocked — ${ids} ${blockers.length === 1 ? "is" : "are"} still open`}
      style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
    >
      <FiLock aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
    </span>
  );
}

// The track a card came from — the card page's chip. The board doesn't draw
// it: it bands its cards by track and heads each band with its name.
// `blockers` and `recurring` are reserved folders, not tracks someone named, so
// each says so — peach for the blocker (the colour the board gives work in the
// way), a repeat icon for recurring, which comes round again instead of being
// built once.
export function TrackChip({ track }: { track: string }) {
  const blocker = track === "blockers";
  const recurring = track === "recurring";
  return (
    <span
      className="nb-chip"
      style={{
        background: blocker
          ? "var(--color-nb-peach-soft)"
          : "var(--color-nb-lilac-soft)",
        color: blocker
          ? "var(--color-nb-peach-ink)"
          : "var(--color-nb-lilac-ink)",
      }}
    >
      {recurring && <FiRepeat aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />}
      {track}
    </span>
  );
}

// Module — what part of the product the card touches (from modules.md). Its own
// mint colour and a box icon keep it from reading as a second TrackChip (lilac):
// the track is the kind of effort, the module is the part it lands in. One chip
// per module — a card can name two. Read-only; the CLI writes the field.
export function ModuleChip({ module }: { module: string }) {
  return (
    <span
      className="nb-chip"
      style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}
    >
      <FiBox aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {module}
    </span>
  );
}

// The card page's release picker — the version this card ships in (#105), made
// pickable the way LevelSelect makes the priority chip pickable. A tag icon,
// since a release is a name pinned on the work rather than a kind of work (the
// track) or a part of the product (the module). It draws only here: the board
// cards don't carry the version (see BoardCard). The options are the open
// releases plus a bare "—" last for a card in no release — the "Release" label
// beside the chip says what the dash means, and the file value it writes is
// empty. Nothing can be typed, so a version id can't be misspelled into
// existence; making a release stays a CLI job.
//
// `releases` is the list as it is right now. A card can name a version that is no
// longer on it — the list is a file a person edits — so that value is kept as a
// first option and the card goes on saying what it says. Re-picking it is a
// no-op (same value, no change event), which is exactly right: the card is
// already there, and the only move on offer is onto a release that exists.
//
// Radix refuses an empty item value, so the "no release" item carries the dash
// itself as its value — an em dash can never be a real version id (those are
// letters, numbers, dot, dash, underscore) — and it maps back to the empty
// string on the way out.
const NO_RELEASE_ITEM = "—";

export function ReleaseSelect({
  value,
  releases,
  disabled,
  onChange,
}: {
  value: string;
  releases: string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const planned = value !== NO_RELEASE;
  const stale = planned && !releases.includes(value);
  return (
    <Select
      value={planned ? value : NO_RELEASE_ITEM}
      disabled={disabled}
      onValueChange={(v) => onChange(v === NO_RELEASE_ITEM ? NO_RELEASE : v)}
    >
      {/* stopPropagation: the chip sits on a clickable card row — opening the
          list must not also open the card. The portaled list is outside the
          row's DOM, so its clicks never reach it. */}
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        className={CHIP_TRIGGER}
        style={{
          background: planned ? "var(--color-nb-sky-soft)" : "var(--color-nb-wash)",
          color: planned ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
        }}
      >
        <FiTag aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stale && (
          <SelectItem value={value} className={CHIP_ITEM}>
            {value} — not on the list
          </SelectItem>
        )}
        {releases.map((r) => (
          <SelectItem key={r} value={r} className={CHIP_ITEM}>
            {r}
          </SelectItem>
        ))}
        <SelectItem value={NO_RELEASE_ITEM} className={CHIP_ITEM}>
          —
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Who owns an open question — parsed from its `[user]` tag. `user` is a
// judgment call waiting on the human (accent, so it stands out on the card);
// an untagged question is freshly raised and not yet triaged (a quiet wash).
// The colour carries the meaning at a glance.
//
// Borderless, like RoiTag: every question list this marks already sits inside a
// frame of its own (the card page's peach questions panel, the resolve dialog's
// labels), and a filled pill in there reads as a box pasted on a box — worse, the
// accent-soft `user` chip all but vanished against the accent-soft panel. Icon +
// coloured label carries the same meaning without the second surface. The line
// box matches the 13px question text beside it so the marker centres on its first
// line instead of floating above it.
//
// It's an inline leader, not a column: both call sites drop it in front of the
// question text so the text wraps back under it. A marker column would reserve the
// widest label's width down the whole question, squeezing multi-line questions into
// a narrow column beside an empty gutter. Hence the trailing margin here — every
// caller wants the same gap to the text it leads.
const QUESTION_TAG: Record<QuestionTag, { label: string; icon: IconType; ink: string }> = {
  user: {
    label: "needs you",
    icon: FiUser,
    ink: "var(--color-nb-accent-deep)",
  },
};

const UNTAGGED = { label: "new", icon: FiHelpCircle, ink: "var(--color-nb-ink-soft)" };

export function QuestionTagBadge({ tag }: { tag: QuestionTag | null }) {
  const c = tag ? QUESTION_TAG[tag] : UNTAGGED;
  const Icon = c.icon;
  return (
    <span
      className="mr-1.5 inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-[700] uppercase leading-[18px] tracking-[0.04em]"
      style={{ color: c.ink }}
    >
      <Icon aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {c.label}
    </span>
  );
}

// The card page's cadence control (#139) — how often a recurring card repeats,
// and so whether the board runs it in the background at all. Three pieces, read
// left to right as the sentence they make: "every 30 minutes", "every 1 days at
// 09:30".
//
// The unit list carries **No cadence** as a choice of its own, because taking a
// schedule off is the same kind of decision as setting one — not a separate
// clear button hidden beside it. Picking it writes an empty field and the card
// goes back to running only when someone clicks Run.
//
// The count is a box rather than a list: real jobs don't fall into a handful of
// numbers — a health check wants 5 minutes, a report 12 hours — and a list long
// enough to cover them is worse than typing two digits. It commits when it
// loses focus or on Enter, so a half-typed "3" on the way to "30" is never
// saved; a number that isn't a whole one, one or more, snaps back to what the
// card says.
//
// The time of day shows only for days, which is the only interval it can mean
// anything for, and only ever a time — the date is the interval's to decide.
const CADENCE_NONE = "none";
const CADENCE_UNITS: { value: CadenceUnit; label: string; start: number }[] = [
  { value: "m", label: "minutes", start: 30 },
  { value: "h", label: "hours", start: 6 },
  { value: "d", label: "days", start: 1 },
];
const CADENCE_WORD = "text-[10.5px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft";
const CADENCE_BOX =
  "nb-outline h-[21px] rounded-[6px] bg-nb-paper px-1.5 text-[11px] font-[700] tabular-nums text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:opacity-60";

export function CadenceSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const cadence = parseCadence(value);
  // The count is typed, so it needs a state of its own while it's being typed —
  // reset whenever the card says something else (another tab, the CLI, a run).
  const [count, setCount] = useState(cadence ? String(cadence.n) : "");
  useEffect(() => {
    const c = parseCadence(value);
    setCount(c ? String(c.n) : "");
  }, [value]);

  const push = (n: number, unit: CadenceUnit, at: string) =>
    onChange(formatCadence({ n, unit, at: unit === "d" ? at : "" }));

  const commitCount = () => {
    const n = Number(count);
    if (!cadence) return;
    if (!Number.isInteger(n) || n < 1) {
      setCount(String(cadence.n)); // not a count — the card's own value stands
      return;
    }
    if (n !== cadence.n) push(n, cadence.unit, cadence.at);
  };

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {cadence && (
        <>
          <span className={CADENCE_WORD}>every</span>
          <input
            type="number"
            min={1}
            step={1}
            className={CADENCE_BOX}
            style={{ width: 46 }}
            value={count}
            disabled={disabled}
            aria-label="How many"
            onChange={(e) => setCount(e.target.value)}
            onBlur={commitCount}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </>
      )}
      <Select
        value={cadence ? cadence.unit : CADENCE_NONE}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === CADENCE_NONE) return onChange("");
          const unit = v as CadenceUnit;
          const start = CADENCE_UNITS.find((u) => u.value === unit)?.start ?? 1;
          push(cadence?.n ?? start, unit, cadence?.at ?? "");
        }}
      >
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          className={CHIP_TRIGGER}
          style={{
            background: cadence ? "var(--color-nb-sky-soft)" : "var(--color-nb-wash)",
            color: cadence ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
          }}
        >
          <FiClock aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CADENCE_UNITS.map((u) => (
            <SelectItem key={u.value} value={u.value} className={CHIP_ITEM}>
              {u.label}
            </SelectItem>
          ))}
          <SelectItem value={CADENCE_NONE} className={CHIP_ITEM}>
            No cadence
          </SelectItem>
        </SelectContent>
      </Select>
      {cadence?.unit === "d" && (
        <>
          <span className={CADENCE_WORD}>at</span>
          <input
            type="time"
            className={CADENCE_BOX}
            value={cadence.at}
            disabled={disabled}
            aria-label="Time of day"
            onChange={(e) => push(cadence.n, cadence.unit, e.target.value)}
          />
        </>
      )}
    </span>
  );
}

// A quick-adjust level select for priority / roi. Looks like the other meaning
// chips — filled with the current level's signal colour — but is a select, so
// it edits in place. The fixed option set means a bad value can't slip in.
export function LevelSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const c = LEVEL[value] || LEVEL.low;
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      {/* stopPropagation — see ReleaseSelect above. */}
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        className={CHIP_TRIGGER}
        style={{ background: c.soft, color: c.ink }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["high", "med", "low"] as const).map((level) => (
          <SelectItem key={level} value={level} className={CHIP_ITEM}>
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
