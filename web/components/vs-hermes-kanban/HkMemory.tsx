import { LogoMark } from "@/components/ui/Logo";
import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";
import type { VsHermesCopy } from "@/i18n/vs-hermes-kanban/types";

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
  body: string;
  q: string;
  a: string;
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
      <p className="text-[0.9rem] text-muted">
        <Rich>{body}</Rich>
      </p>
      <div className="mt-4 rounded-lg bg-code p-4">
        <p className="text-sm font-medium text-ink">&ldquo;{q}&rdquo;</p>
        <p className="mt-1.5 text-sm text-muted">
          <Rich code="wash">{a}</Rich>
        </p>
      </div>
    </div>
  );
}

export function HkMemory({ c }: { c: VsHermesCopy["memory"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="04" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MemoryCard tag={<LogoMark size="xs" />} {...c.ours} />
        <MemoryCard tag={<HermesMark className="h-6 w-6" />} {...c.theirs} />
      </div>

      <p className="mt-5 text-[0.95rem] text-muted">{c.note}</p>
    </section>
  );
}
