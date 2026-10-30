// Copied from legacy kanban-ui/components/chips.tsx: ModuleChip as is; LevelSelect keeps its
// chip and loses the select, since nobody changes a level here.

import { FiBox, FiFlag } from "react-icons/fi";

const LEVEL: Record<string, { soft: string; ink: string }> = {
  high: { soft: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  med: { soft: "var(--color-nb-sky-soft)", ink: "var(--color-nb-sky-ink)" },
  low: { soft: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", ink: "var(--color-nb-ink-soft)" },
};

// Module — what part of the product the card touches (from modules.md). Its own
// mint colour and a box icon set it apart from the other chips. One chip per
// module — a card can name two. Read-only; the CLI writes the field.
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

export function LevelSelect({ value, label }: { value: string; label: string }) {
  const c = LEVEL[value] ?? LEVEL.low!;
  return (
    <span className="nb-chip" style={{ background: c.soft, color: c.ink }}>
      <FiFlag aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {label}
    </span>
  );
}
