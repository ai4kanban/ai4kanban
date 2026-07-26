import type { ReactNode } from "react";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";

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

export function HkSummary() {
  return (
    <section className="mt-24">
      <SectionHeading num="01" eyebrow="The short version" title="So why not just use Hermes Kanban?" />
      <p className="text-ink">
        Fair question — the two overlap a lot. Both are kanban boards agents plan
        and work from, so think of ai4kanban as{" "}
        <span className="font-semibold text-ink">a lightweight alternative to Hermes Kanban</span>:
        the same board idea, minus the bundled runtime. The difference is
        what&apos;s underneath.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DiffCard
          tag="🗂️"
          heading="AI4Kanban — a board made of files"
          items={[
            "Plain Markdown in your repo — every task and plan change is a reviewable diff.",
            "No infrastructure: nothing to install, nothing to keep running.",
            "Execution comes from whatever harness you already use — Claude Code, Codex, Cursor, even Hermes.",
          ]}
        />
        <DiffCard
          tag={<HermesMark className="h-6 w-6" />}
          heading="Hermes Kanban — a board inside a runtime"
          items={[
            "A durable SQLite queue at ~/.hermes/kanban.db, shared by many named agents and humans.",
            "A dispatcher hands ready tasks to agents and recovers crashed runs.",
            "Tied to the Hermes / Nous stack and its kanban_* tools.",
          ]}
        />
      </div>

      <div className={`${panelStatic} mt-5 bg-code p-6`}>
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          When to use ai4kanban
        </p>
        <p className="text-[0.95rem] text-muted">
          Pick the skill when you want the board{" "}
          <span className="font-semibold text-ink">versioned with your code</span>,
          when you&apos;re staying in a harness you already run, or when you
          don&apos;t want to operate a runtime just to get a task board. Reach
          for Hermes Kanban when{" "}
          <span className="font-semibold text-ink">you already work deeply with Hermes</span>{" "}
          — its board plugs straight into the dispatcher, named profiles, and
          chat control you&apos;ve set up. Both are durable queues in the end;
          the skill&apos;s is files in git, Hermes&apos;s is rows in SQLite.
        </p>
      </div>
    </section>
  );
}
