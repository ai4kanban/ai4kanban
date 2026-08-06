import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelInset, panelStatic } from "../styles";
import type { VsHermesCopy } from "@/i18n/vs-hermes-kanban/types";

// The honest TL;DR up front. The two projects largely overlap, so the skill is
// framed as a lightweight *alternative* to Hermes Kanban: two parallel cards
// carry the actual difference side by side, and a strip below answers "so when
// do I use the skill?" without scrolling to the decision section.

function DiffCard({
  tag,
  heading,
  items,
}: {
  tag: ReactNode;
  heading: string;
  items: string[];
}) {
  return (
    <div className={`${panelStatic} p-6`}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-baseline gap-2.5 text-[0.95rem] text-muted">
            <span className="select-none text-accent-deep" aria-hidden="true">
              →
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HkSummary({ c }: { c: VsHermesCopy["summary"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DiffCard tag="🗂️" heading={c.oursHeading} items={c.ours} />
        <DiffCard
          tag={<HermesMark className="h-6 w-6" />}
          heading={c.theirsHeading}
          items={c.theirs}
        />
      </div>

      <div className={`${panelInset} mt-5 p-6`}>
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          {c.whenLabel}
        </p>
        <p className="text-[0.95rem] text-muted">
          <Rich>{c.when}</Rich>
        </p>
      </div>
    </section>
  );
}
