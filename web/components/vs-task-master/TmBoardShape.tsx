import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { TmHeading } from "./TmSections";
import { Mat, printFrame } from "../home/Mat";
import { LogoMark } from "@/components/ui/Logo";
import { TmMark } from "./TmMark";
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";

type Line = { text: string; depth: number; strong?: boolean };

const OURS: Line[] = [
  { text: "docs/kanban/", depth: 0 },
  { text: "todo/", depth: 1 },
  { text: "features/", depth: 2 },
  { text: "142-warn-on-a-huge-card.md", depth: 3, strong: true },
  { text: "147-name-the-next-card.md", depth: 3, strong: true },
  { text: "skill/", depth: 2 },
  { text: "151-two-runs-at-once.md", depth: 3, strong: true },
  { text: "memory/", depth: 1 },
  { text: "goal.md", depth: 2 },
  { text: "agents/planner/decisions.md", depth: 2 },
];

const THEIRS: Line[] = [
  { text: ".taskmaster/", depth: 0 },
  { text: "docs/", depth: 1 },
  { text: "prd.txt", depth: 2 },
  { text: "tasks/", depth: 1 },
  { text: "tasks.json", depth: 2, strong: true },
  { text: "reports/", depth: 1 },
  { text: "task-complexity-report.json", depth: 2 },
  { text: "state.json", depth: 1 },
];

function Tree({ lines }: { lines: Line[] }) {
  return (
    <pre tabIndex={0} className="mt-4 overflow-x-auto focus-visible:outline-2 focus-visible:outline-accent-deep font-mono text-[0.72rem] leading-relaxed">
      {lines.map((line) => (
        <div
          key={line.text}
          className={line.strong ? "font-semibold text-ink" : "text-muted"}
        >
          {"  ".repeat(line.depth)}
          {line.text}
        </div>
      ))}
    </pre>
  );
}

function Side({
  tag,
  label,
  lines,
  caption,
  highlight,
}: {
  tag: ReactNode;
  label: string;
  lines: Line[];
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <Mat wash={highlight ? "mintSky" : "skyLilac"} className="p-4 sm:p-6">
        <div className={`${printFrame} bg-elev p-5 sm:p-6`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl" aria-hidden="true">{tag}</span>
            <h3 className="font-semibold text-ink">{label}</h3>
          </div>
          <Tree lines={lines} />
        </div>
      </Mat>
      <p className="mt-5 text-[0.95rem] leading-relaxed text-muted">
        <Rich>{caption}</Rich>
      </p>
    </div>
  );
}

export function TmBoardShape({ c }: { c: VsTaskMasterCopy["boardShape"] }) {
  return (
    <section className="mt-24 lg:mt-32">
      <TmHeading {...c.heading} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">{c.lead}</p>
      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Side
          tag={<LogoMark size="xs" />}
          label={c.oursLabel}
          lines={OURS}
          caption={c.oursCaption}
          highlight
        />
        <Side
          tag={<TmMark className="h-5 w-5" />}
          label={c.theirsLabel}
          lines={THEIRS}
          caption={c.theirsCaption}
        />
      </div>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
