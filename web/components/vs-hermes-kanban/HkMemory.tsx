import type { ReactNode } from "react";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";

// Expands the table's terse "Review & memory" row — but around the one
// essential difference, not an inventory: the skill's memory is an *input to
// planning* (curated, forgets on purpose), Hermes's log is an *output of
// execution* (append-only, forgets nothing). Each card is a verdict plus one
// concrete question it can answer that the other can't.

function MemoryCard({
  tag,
  heading,
  verdict,
  body,
  q,
  a,
}: {
  tag: ReactNode;
  heading: string;
  verdict: string;
  body: ReactNode;
  q: string;
  a: ReactNode;
}) {
  return (
    <div className={`${panelStatic} p-6`}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <p className="mb-2 text-lg font-semibold text-ink">{verdict}</p>
      <p className="text-[0.9rem] text-muted">{body}</p>
      <div className="mt-4 rounded-lg bg-code p-4">
        <p className="text-sm font-medium text-ink">&ldquo;{q}&rdquo;</p>
        <p className="mt-1.5 text-sm text-muted">{a}</p>
      </div>
    </div>
  );
}

export function HkMemory() {
  return (
    <section className="mt-24">
      <SectionHeading num="04" eyebrow="Memory vs. audit" title="What each board remembers" />
      <p className="text-ink">
        The essential difference: the skill&apos;s memory is an{" "}
        <span className="font-semibold">input to planning</span> — it exists so
        the next proposal is smarter. Hermes&apos;s log is an{" "}
        <span className="font-semibold">output of execution</span> — it exists
        so the past can be replayed.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MemoryCard
          tag="🗂️"
          heading="AI4Kanban"
          verdict="Remembers conclusions, forgets the rest."
          body={
            <>
              Four small files,{" "}
              <span className="text-ink">pruned on purpose</span>:{" "}
              <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">archive.md</code>{" "}
              (what shipped),{" "}
              <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">rejected.md</code>{" "}
              (what we turned down, and why),{" "}
              <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">redesign.md</code>{" "}
              (design mistakes not to repeat),{" "}
              <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">memory.md</code>{" "}
              (what past scans learned). The agent reads them all before
              proposing or writing a card; the full history is git&apos;s job.
            </>
          }
          q="Why isn't idea X on the board?"
          a={
            <>
              One line in{" "}
              <code className="rounded bg-elev px-1 py-0.5 text-[0.85em]">rejected.md</code>{" "}
              — the idea and why it was turned down. Dead ideas stay dead.
            </>
          }
        />
        <MemoryCard
          tag={<HermesMark className="h-6 w-6" />}
          heading="Hermes Kanban"
          verdict="Remembers every event, summarizes nothing."
          body={
            <>
              Every state transition lands in an{" "}
              <span className="text-ink">append-only log</span>; every attempt
              keeps its exit code and full worker output. Built for audit and
              crash recovery, not for steering the next idea.
            </>
          }
          q="What happened to task 42 overnight?"
          a={
            <>
              <code className="rounded bg-elev px-1 py-0.5 text-[0.85em]">
                claimed → crashed → reclaimed → completed
              </code>
              , with per-attempt logs to read.
            </>
          }
        />
      </div>

      <p className="mt-5 text-[0.95rem] text-muted">
        Curated memory makes the agent smarter next time; the audit log makes
        the past reconstructable. Neither substitutes for the other.
      </p>
    </section>
  );
}
