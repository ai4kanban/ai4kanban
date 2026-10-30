// Copied from legacy kanban-ui/components/chips.tsx: the status pill, priority, todo progress
// and blocked marks. Read only; ROI is gone.

import { FiAlertCircle, FiCheckCircle, FiClock, FiEye, FiFlag, FiLock, FiPauseCircle, FiPlayCircle, FiXCircle } from "react-icons/fi";
import type { Task } from "../api";
import { T } from "../i18n";
import type { Level, Status } from "../lib/card";
import { workflowIcon } from "./workflow-icon";

const ELASTIC_CHIP = { minWidth: 0, maxWidth: "100%" } as const;

export type PillStatus = Status | "done" | "cancelled";

const SKIN: Record<PillStatus, { icon: typeof FiEye; soft: string; ink: string }> = {
  review: { icon: FiEye, soft: "var(--color-nb-accent-soft)", ink: "var(--color-nb-accent-deep)" },
  running: { icon: FiPlayCircle, soft: "var(--color-nb-sky-soft)", ink: "var(--color-nb-sky-ink)" },
  queued: { icon: FiClock, soft: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  failed: { icon: FiAlertCircle, soft: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  stopped: { icon: FiPauseCircle, soft: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", ink: "var(--color-nb-ink-soft)" },
  done: { icon: FiCheckCircle, soft: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" },
  cancelled: { icon: FiXCircle, soft: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", ink: "var(--color-nb-ink-soft)" },
};

/** The pill's name for a task where the status alone says too little: 等待运行 for a queued task held by the plan
 *  (#2209), the step a running one is on (#79). */
export const pillLabel = (task: Task): string | undefined =>
  task.status === "queued" && task.waiting_for_slot ? T.waitingForSlot : task.status === "running" && task.run?.step ? T.step[task.run.step] : undefined;

/** `label`: another name for the status, such as 等待运行 for a queued task held by the plan (#2209). */
export function StatusPill({ status, label = T.status[status] }: { status: PillStatus; label?: string }) {
  const c = SKIN[status];
  const Icon = c.icon;
  return (
    <span className="nb-chip" title={label} style={{ ...ELASTIC_CHIP, background: c.soft, color: c.ink }}>
      <Icon aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function WorkflowTag({ id, name }: { id: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
      {workflowIcon(id, { style: { width: 10, height: 10 } })}
      {name}
    </span>
  );
}

const LEVEL: Record<Level, { soft: string; ink: string }> = {
  high: { soft: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  med: { soft: "var(--color-nb-sky-soft)", ink: "var(--color-nb-sky-ink)" },
  low: { soft: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", ink: "var(--color-nb-ink-soft)" },
};

export function PriorityChip({ value }: { value: Level }) {
  const c = LEVEL[value];
  return (
    <span className="nb-chip" style={{ background: c.soft, color: c.ink }}>
      <FiFlag aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      {T.level[value]}
    </span>
  );
}

export function TodoProgress({ done, total, width = 26 }: { done: number; total: number; width?: number }) {
  const complete = done >= total;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span style={{ display: "block", width, height: 4, borderRadius: 999, overflow: "hidden", background: "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.round((done / Math.max(total, 1)) * 100)}%`, background: complete ? "var(--color-nb-mint)" : "var(--color-nb-accent)" }} />
      </span>
      <span className="text-[10.5px] font-[700] tabular-nums text-nb-ink-soft">
        {done}/{total}
      </span>
    </span>
  );
}

export function BlockedChip({ by }: { by: string }) {
  return (
    <span className="nb-chip nb-tip" data-tip={T.blocked(by)} style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}>
      <FiLock aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
    </span>
  );
}

// A card still being created (legacy kanban-ui): a ringing dot, not a pill.
export function CreatingChip() {
  return (
    <span
      className="nb-tip nb-tip-below nb-tip-end inline-flex min-w-0 items-center gap-1.5 text-[10px] font-[800] uppercase leading-none tracking-[0.08em] text-nb-sky-ink"
      tabIndex={0}
      data-tip={T.creatingTip}
      style={ELASTIC_CHIP}
    >
      <span className="a4k-creating-dot" aria-hidden />
      <span className="truncate">{T.step.create}</span>
    </span>
  );
}
