"use client";

import { FiBox, FiCheckCircle, FiChevronDown, FiCpu, FiFlag, FiHelpCircle, FiLayers, FiPlayCircle, FiUser } from "react-icons/fi";
import type { IconType } from "react-icons";
import type { QuestionTag } from "@/lib/questions";
import type { CardStatus } from "@/lib/types";

// Meaning-coded chips + level selects, all built from the design language's
// borderless pill and quiet select. Priority/roi map onto the signal pastels.

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
      style={{ display: "block", width: 6, height: 6, borderRadius: 999, flex: "0 0 auto", background: color }}
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
      <FiFlag aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
      {value}
    </span>
  );
}

// ROI — secondary. Dot + muted label, no fill, so it reads one rung below the
// priority chip instead of mirroring it as a second identical pill.
export function RoiTag({ value }: { value: string }) {
  const c = LEVEL[value] || LEVEL.low;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
      <Dot color={c.dot} />
      ROI {value}
    </span>
  );
}

// Todo progress — a thin bar + count for the card's top meta row. Reads as
// status (empty → full, mint when complete) rather than yet another chip.
// `width` lets the card page draw a longer bar than the board's 32px sliver.
export function TodoProgress({ done, total, width = 32 }: { done: number; total: number; width?: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          display: "block",
          width,
          height: 5,
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
      <span className="text-[11px] font-[700] tabular-nums text-nb-ink-soft">
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
      <Icon aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
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
      <FiLayers aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
    </span>
  );
}

export function TrackChip({ track }: { track: string }) {
  const blocker = track === "blockers";
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
      <FiBox aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
      {module}
    </span>
  );
}

// Who owns an open question — parsed from its `[user]`/`[agent]` tag. `user` is a
// judgment call waiting on the human (accent, so it stands out on the card);
// `agent` is one the auto-refine loop answers itself (sky — shown mid-answer,
// then cleared once recorded); an untagged question is freshly raised and not yet
// triaged (a quiet wash). The colour carries the meaning at a glance.
const QUESTION_TAG: Record<QuestionTag, { label: string; icon: IconType; soft: string; ink: string }> = {
  user: {
    label: "needs you",
    icon: FiUser,
    soft: "var(--color-nb-accent-soft)",
    ink: "var(--color-nb-accent-deep)",
  },
  agent: {
    label: "agent",
    icon: FiCpu,
    soft: "var(--color-nb-sky-soft)",
    ink: "var(--color-nb-sky-ink)",
  },
};

export function QuestionTagBadge({ tag }: { tag: QuestionTag | null }) {
  if (!tag) {
    return (
      <span className="nb-chip" style={{ background: "var(--color-nb-wash)", color: "var(--color-nb-ink-soft)" }}>
        <FiHelpCircle aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
        new
      </span>
    );
  }
  const c = QUESTION_TAG[tag];
  const Icon = c.icon;
  return (
    <span className="nb-chip" style={{ background: c.soft, color: c.ink }}>
      <Icon aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto" }} />
      {c.label}
    </span>
  );
}

// A quick-adjust level select for priority / roi. Looks like the other meaning
// chips — filled with the current level's signal colour — but is a native
// <select>, so it edits in place. The fixed option set means a bad value can't
// slip in.
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
    <span className="nb-levelselect" style={{ background: c.soft, color: c.ink }}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="high">high</option>
        <option value="med">med</option>
        <option value="low">low</option>
      </select>
      <FiChevronDown aria-hidden style={{ width: 10, height: 10 }} />
    </span>
  );
}
