import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { LogoMark } from "@/components/ui/Logo";
import { TmMark } from "./TmMark";
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";

// Day one, both sides, in the order the work happens. Ours sits on the paper
// and theirs in the wash — the ramp is what says which column this page is
// arguing for, and it says it without a colour or a badge.
//
// The steps are numbered because the claim is about sequence: what you have to
// have finished before step one is worth running.
function Column({
  tag,
  label,
  title,
  steps,
  highlight,
}: {
  tag: ReactNode;
  label: string;
  title: string;
  steps: readonly string[];
  highlight?: boolean;
}) {
  return (
    <div className={`${highlight ? panelStatic : panelInset} p-6`}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span
              className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-border bg-code font-mono text-[0.65rem] font-semibold text-ink"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <p className="text-[0.9rem] text-muted">
              <Rich code={highlight ? "paper" : "wash"}>{step}</Rich>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TmStart({ c }: { c: VsTaskMasterCopy["start"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="02" {...c.heading} />
      <p className="text-ink">{c.lead}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Column tag={<LogoMark size="xs" />} {...c.ours} highlight />
        <Column tag={<TmMark className="h-5 w-5" />} {...c.theirs} />
      </div>
      <p className="mt-5 text-sm text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
