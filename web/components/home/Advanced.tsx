import {
  ladderOrder,
  ladderTags,
  learnFileNames,
  learnFileOrder,
  recurringExampleOrder,
} from "../content";
import { LoopDiagram } from "./LoopDiagram";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { ThroughputChart } from "./ThroughputChart";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

const GROUP_TREE = `todo/42-payments/
  root.md                  # the tracking task
  feature/43-checkout.md   # a subtask, its own card + id
  feature/44-refunds.md
  bug/45-webhook-retry.md`;

// Accent fill ramps left→right so the ladder reads as "less human each rung".
const rungFill = ["bg-elev", "bg-accent/25", "bg-accent/50"];

function Tree({ children }: { children: string }) {
  return (
    <pre className={`${panelStatic} mt-4 overflow-x-auto bg-code p-5`}>
      <code className="font-mono text-sm leading-7 text-ink">{children}</code>
    </pre>
  );
}

function SubHeading({ children }: { children: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-xl font-semibold">
      <span className="h-4 w-1 bg-accent/60" aria-hidden="true" />
      {children}
    </h3>
  );
}

export function Advanced({ c }: { c: HomeCopy }) {
  const t = c.advanced;
  return (
    <section id="deeper" className="mt-24 scroll-mt-20">
      <SectionHeading num="05" {...t.heading} />
      <p className="text-ink">{t.lead}</p>

      {/* Recurring tasks: run on a loop */}
      <div className="mt-12">
        <SubHeading>{t.recurring.title}</SubHeading>
        <p className="mt-2 text-muted">
          <Rich>{t.recurring.body}</Rich>
        </p>

        {/* Concrete examples */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {recurringExampleOrder.map((key) => (
            <div key={key} className={`${panelStatic} bg-code p-5`}>
              <h4 className="text-[0.95rem] font-semibold text-ink">
                {t.recurring.examples[key].label}
              </h4>
              <p className="mt-1.5 text-sm text-muted">
                {t.recurring.examples[key].body}
              </p>
            </div>
          ))}
        </div>

        {/* Automation ladder */}
        <p className="mt-6 text-muted">{t.recurring.ladderLead}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
          {ladderOrder.map((key, i) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className={`rounded-lg border-2 border-border px-4 py-3 shadow-[3px_3px_0_0_#010409] ${rungFill[i]}`}
              >
                <span className="font-mono text-sm font-semibold text-accent">
                  {ladderTags[key]}
                </span>
                <span className="ml-2 text-[0.95rem] text-ink">
                  {t.recurring.ladder[key].label}
                </span>
              </div>
              {i < ladderOrder.length - 1 && (
                <span className="text-lg font-bold text-accent" aria-hidden="true">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">{t.recurring.ladderNote}</p>
      </div>

      {/* Group / tracking task */}
      <div className="mt-12">
        <SubHeading>{t.group.title}</SubHeading>
        <p className="mt-2 text-muted">
          <Rich>{t.group.body}</Rich>
        </p>
        <Tree>{GROUP_TREE}</Tree>
      </div>

      {/* Learns over time */}
      <div className="mt-12">
        <SubHeading>{t.memory.title}</SubHeading>
        <p className="mt-2 text-muted">{t.memory.body}</p>

        {/* The loop, drawn as a real circle — the three sources live inside it */}
        <LoopDiagram c={t.memory} />

        {/* The hub that collects your feedback and its learnings */}
        <div className={`${panelStatic} mt-6 overflow-hidden bg-code`}>
          <div className="border-b-2 border-border px-5 py-2.5 font-mono text-sm text-muted">
            {t.memory.hubLabel}
          </div>
          <div className="divide-y divide-border">
            {learnFileOrder.map((key) => (
              <div key={key} className="px-5 py-4 sm:flex sm:gap-5">
                <code className="font-mono text-sm font-semibold text-accent sm:w-32 sm:shrink-0">
                  {learnFileNames[key]}
                </code>
                <p className="mt-1 text-[0.95rem] text-muted sm:mt-0">
                  {t.memory.files[key].body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-12">
        <SubHeading>{t.metrics.title}</SubHeading>
        <p className="mt-2 text-muted">{t.metrics.body}</p>
        <ThroughputChart c={t.metrics.chart} />
      </div>
    </section>
  );
}
