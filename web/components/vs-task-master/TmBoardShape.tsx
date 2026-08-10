import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { LogoMark } from "@/components/ui/Logo";
import { TmMark } from "./TmMark";
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";

// What each board actually is on disk. File names are not words a translator
// touches, so both trees live here and only the labels, captions, and the note
// come from the copy.
//
// `strong` is the line the section is about: on our side every card, on theirs
// the one file the whole backlog is inside. The rest of the tree is context and
// stays muted, so each panel has exactly one thing to look at.

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
  { text: "site/decisions.md", depth: 2 },
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
    <pre className="mt-4 overflow-x-auto font-mono text-[0.72rem] leading-relaxed">
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
    <div className={`${highlight ? panelStatic : panelInset} p-6`}>
      <div className="flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{label}</h3>
      </div>
      <Tree lines={lines} />
      <p className="mt-4 text-[0.9rem] text-muted">
        <Rich code={highlight ? "paper" : "wash"}>{caption}</Rich>
      </p>
    </div>
  );
}

export function TmBoardShape({ c }: { c: VsTaskMasterCopy["boardShape"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="04" {...c.heading} />
      <p className="text-ink">{c.lead}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <p className="mt-5 text-sm text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
