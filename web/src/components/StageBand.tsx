// Where a card with several approvals is (#2154), after legacy kanban-ui's StageBand (#1790,
// #1808): its stages, each named by its agents, one status, and Approve when one waits on it.

import { FiArrowRightCircle, FiCheck, FiCheckCircle, FiChevronRight, FiHelpCircle } from "react-icons/fi";
import { Button } from "@review/components/button";
import { T } from "../i18n";
import { PULSE_DOT } from "./SubtaskMap";

export type StageState = "running" | "questions" | "waiting" | "done" | null;

const ICON = { width: 15, height: 15, flex: "0 0 auto" } as const;

export function StageBand({
  stages,
  stage,
  state,
  questions,
  approve,
}: {
  /** Each stage's name. */
  stages: string[];
  /** The one the card is on, 1-based. */
  stage: number;
  state: StageState;
  questions: number;
  approve?: { busy: boolean; onApprove: () => void };
}) {
  const s = T.stage;
  const current = stages[stage - 1] ?? "";
  const done = state === "done";
  const text = state && { running: s.running(current), questions: s.questions(questions), waiting: s.waiting(current), done: s.done(current) }[state];
  return (
    <div className="nb-section flex items-center gap-4 bg-nb-sheet py-2 pl-4 pr-2.5 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:px-3.5 max-md:py-3">
      <ol className="flex shrink-0 flex-wrap items-center gap-1.5 text-[12px] font-[700] leading-none text-nb-ink-soft">
        {stages.map((name, k) => {
          const n = k + 1;
          const past = n < stage || (done && n === stage);
          return (
            <li key={k} className="inline-flex items-center gap-1.5">
              {k > 0 && <FiChevronRight aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto", opacity: 0.5 }} />}
              {n === stage && !done ? (
                <span
                  aria-current="step"
                  className="nb-chip"
                  style={{ textTransform: "none", fontSize: 12, background: "color-mix(in srgb, var(--color-nb-ink) 8%, transparent)", color: "var(--color-nb-ink)" }}
                >
                  {name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-[2px]" style={n > stage ? { opacity: 0.5 } : undefined}>
                  {past && <FiCheck aria-hidden style={{ width: 11, height: 11, flex: "0 0 auto", color: "var(--color-nb-mint-ink)" }} />}
                  {name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {text && (
        <>
          <span aria-hidden className="h-5 w-px shrink-0 max-md:hidden" style={{ background: "color-mix(in srgb, var(--color-nb-ink) 15%, transparent)" }} />
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-[700]">
            {state === "running" && <span aria-hidden className={PULSE_DOT} />}
            {state === "questions" && <FiHelpCircle aria-hidden style={{ ...ICON, color: "var(--color-nb-accent-deep)" }} />}
            {state === "waiting" && <FiArrowRightCircle aria-hidden style={{ ...ICON, color: "var(--color-nb-accent-deep)" }} />}
            {done && <FiCheckCircle aria-hidden style={{ ...ICON, color: "var(--color-nb-mint-ink)" }} />}
            <span className={state === "running" ? "font-[600] text-nb-ink-soft" : undefined}>{text}</span>
          </p>
        </>
      )}
      {state === "waiting" && approve && (
        <Button variant="ghost" size="sm" className="shrink-0 max-md:w-full" disabled={approve.busy} onClick={approve.onApprove}>
          <FiCheck className="text-[14px]" aria-hidden style={{ color: "var(--color-nb-mint-ink)" }} />
          {s.approve(stages[stage])}
        </Button>
      )}
    </div>
  );
}
