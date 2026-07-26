import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa";
import { decisionKanban, decisionIssues } from "./vs-content";
import { GITHUB_URL } from "../content";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

function Guide({
  tag,
  heading,
  items,
  highlight,
}: {
  tag: ReactNode;
  heading: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`${panelStatic} p-6 ${
        highlight ? "border-accent/40 bg-accent/[0.04]" : "bg-elev"
      }`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-baseline gap-2.5 text-[0.95rem] text-muted">
            <span className="select-none text-accent" aria-hidden="true">
              →
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VsDecision() {
  return (
    <section className="mt-24">
      <SectionHeading num="05" eyebrow="The call" title="Which should you use?" />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Guide
          tag="🗂️"
          heading="Reach for ai4kanban when"
          items={decisionKanban}
          highlight
        />
        <Guide
          tag={<FaGithub className="text-ink" aria-hidden="true" />}
          heading="Reach for GitHub Issues when"
          items={decisionIssues}
        />
      </div>

      {/* Bottom line */}
      <div className={`${panelStatic} mt-8 bg-code p-6 sm:p-8`}>
        <div className="flex items-center gap-3">
          <span className="h-5 w-1.5 bg-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Bottom line
          </span>
        </div>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          They aren&apos;t really competitors. GitHub Issues is the{" "}
          <span className="font-semibold">shared system of record</span>;
          ai4kanban is the{" "}
          <span className="font-semibold">agent&apos;s fast local scratch-board</span>.
          If your bottleneck is coordination across people, use GitHub Issues. If
          it&apos;s throughput with an agent, use ai4kanban.
        </p>
        <p className="mt-4 text-[0.95rem] text-muted">
          Plenty of solo builders run both — GitHub Issues as the public tracker,
          ai4kanban as the private surface their agent drives every day.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/#install"
            className="rounded-lg border-2 border-accent bg-accent px-5 py-2.5 text-[0.95rem] font-semibold text-white no-underline shadow-[4px_4px_0_0_#1f6feb] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1f6feb]"
          >
            Install ai4kanban
          </a>
          <a
            href={GITHUB_URL}
            rel="noopener"
            className="rounded-lg border-2 border-border px-5 py-2.5 text-[0.95rem] font-semibold text-ink no-underline shadow-[4px_4px_0_0_#010409] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[6px_6px_0_0_var(--color-accent)]"
          >
            View on GitHub ↗
          </a>
        </div>
      </div>
    </section>
  );
}
