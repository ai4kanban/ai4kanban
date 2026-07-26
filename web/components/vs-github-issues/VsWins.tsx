import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa";
import { kanbanWins, issuesWins } from "./vs-content";
import { SectionHeading } from "../SectionHeading";
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

export function VsWins() {
  return (
    <section className="mt-24">
      <SectionHeading num="03" eyebrow="Trade-offs" title="Where each one wins" />
      <p className="text-ink">
        Neither is strictly better. ai4kanban optimizes for one agent
        moving fast; GitHub Issues optimizes for many people staying in sync.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <WinColumn heading="AI4Kanban" tag="🗂️" items={kanbanWins} />
        <WinColumn
          heading="GitHub Issues"
          tag={<FaGithub className="text-ink" aria-hidden="true" />}
          items={issuesWins}
        />
      </div>
    </section>
  );
}
