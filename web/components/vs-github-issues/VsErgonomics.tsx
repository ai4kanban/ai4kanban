import { ergoIssuesKinds, ergoKanbanKinds, type ErgoKind } from "./vs-content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { VsGithubCopy } from "@/i18n/types";

function Transcript({
  title,
  chip,
  chipClass,
  lines,
  kinds,
  footer,
}: {
  title: string;
  chip: string;
  chipClass: string;
  lines: string[];
  kinds: ErgoKind[];
  footer: string;
}) {
  return (
    <div className={`${panelStatic} overflow-hidden bg-code`}>
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-2.5">
        <span className="font-mono text-xs text-muted">{title}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider ${chipClass}`}
        >
          {chip}
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-4 font-mono text-[0.82rem] leading-relaxed">
        {lines.map((line, i) => {
          if (kinds[i] === "you") {
            return (
              <div key={i} className="flex items-baseline gap-2">
                <span className="select-none text-accent">›</span>
                <span className="font-semibold text-ink">{line}</span>
              </div>
            );
          }
          if (kinds[i] === "call") {
            return (
              <div key={i} className="flex items-baseline gap-2 pl-4 text-muted">
                <span className="select-none text-accent/60">⚙</span>
                <span>{line}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex items-baseline gap-2 pl-4 text-muted/70">
              <span className="select-none">←</span>
              <span>{line}</span>
            </div>
          );
        })}
        <div className="flex items-baseline gap-2 border-t border-border pt-2.5 text-muted">
          <span className="select-none">{"∑"}</span>
          <span>{footer}</span>
        </div>
      </div>
    </div>
  );
}

// The core argument, made concrete: the same request, two very different paths.
export function VsErgonomics({ c }: { c: VsGithubCopy["ergonomics"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="04" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Transcript
          {...c.issues}
          kinds={ergoIssuesKinds}
          chipClass="bg-muted/15 text-muted"
        />
        <Transcript
          {...c.kanban}
          kinds={ergoKanbanKinds}
          chipClass="bg-accent/15 text-accent"
        />
      </div>

      <p className="mt-5 text-sm text-muted">{c.note}</p>
    </section>
  );
}
