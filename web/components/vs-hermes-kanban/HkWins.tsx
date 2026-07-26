import type { ReactNode } from "react";
import { kanbanWins, hermesWins } from "./vs-hermes-content";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panel } from "../styles";

function WinColumn({
  heading,
  tag,
  items,
}: {
  heading: string;
  tag: ReactNode;
  items: { icon: string; title: string; body: string }[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="text-lg font-semibold text-ink">{heading}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {items.map((it) => (
          <div key={it.title} className={`${panel} p-5`}>
            <div className="mb-2 flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-code text-lg"
                aria-hidden="true"
              >
                {it.icon}
              </span>
              <h4 className="font-semibold text-ink">{it.title}</h4>
            </div>
            <p className="text-[0.9rem] text-muted">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HkWins() {
  return (
    <section className="mt-24">
      <SectionHeading num="07" eyebrow="Trade-offs" title="Where each one wins" />
      <p className="text-ink">
        Neither is strictly better. ai4kanban optimizes for a lean,
        file-based board with no infra of its own; Hermes Kanban optimizes for a
        durable, shared work queue that many agents run against, unattended.
        Harness features — parallel runs, orchestration, a dashboard — are on both
        sides, so they aren&apos;t listed here.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <WinColumn heading="AI4Kanban" tag="🗂️" items={kanbanWins} />
        <WinColumn heading="Hermes Kanban" tag={<HermesMark className="h-6 w-6" />} items={hermesWins} />
      </div>
    </section>
  );
}
