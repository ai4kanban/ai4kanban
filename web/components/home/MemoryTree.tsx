import { printFrame } from "./Mat";

// The memory is a directory of Markdown files, so the visual is that directory —
// real paths, one module expanded, a second left collapsed to show there's one
// per module. Paths and glyphs are structure, not copy, so they stay here; the
// note beside each file is the caller's, because the landing page's is
// translated and a post's is not.
//
// The print only: mounting it is the caller's, since the landing page gives it
// half a row and a post gives it the width of the prose column.
//
// `prefix` is the drawn connector, stored apart from the name so it can be set
// in the muted grey: the connectors are the listing's rules, not its content,
// and at the ink they weighed as much as the filenames they were pointing at.
// They are drawn at one dash rather than the canonical two, and the nested level
// is indented three columns rather than four — the whole listing is then five
// characters narrower than a terminal would print it, which is what buys the
// note a place on the same line at phone width.

export type MemoryTreeNotes = {
  goal: string;
  module: string;
  readme: string;
  decisions: string;
  rejected: string;
  redesign: string;
};

type Row = {
  prefix: string;
  name: string;
  dir?: boolean;
  note?: keyof MemoryTreeNotes;
};

const TREE: Row[] = [
  { prefix: "", name: "docs/kanban/memory/", dir: true },
  { prefix: "├─ ", name: "goal.md", note: "goal" },
  { prefix: "├─ ", name: "local-ui/", dir: true, note: "module" },
  { prefix: "│  ├─ ", name: "readme.md", note: "readme" },
  { prefix: "│  ├─ ", name: "decisions.md", note: "decisions" },
  { prefix: "│  ├─ ", name: "rejected.md", note: "rejected" },
  { prefix: "│  └─ ", name: "redesign.md", note: "redesign" },
  { prefix: "└─ ", name: "site/", dir: true },
];

// One listing at every width. It used to be two — a two-column grid from `sm`
// up and, on the phone, a connectorless version with the note tucked under its
// path — because a note in its own grid column can't survive a 320px viewport.
// What removed the fork was making the note share the path's line instead of
// taking a column: the path sets left, the note sets right, and the space
// between them is whatever the width happens to leave. Nothing has to reflow,
// so nothing has to be redrawn for the phone.
//
// The print fills what it is given, up to `className`'s cap. The default cap
// is for a caller that hands it a whole prose column — eight short lines run to
// that width open the gap between a path and its note far enough that the pair
// stops reading as one row. A caller whose mat already sets the margin as a
// share of its own width passes `max-w-none` and lets the print track it.
//
// Two faces, because the two halves of a row are different kinds of thing: the
// path is what the terminal printed, in the mono, and the note is our
// annotation of it, in the sans a step smaller. That is what separates the
// columns now that no rule and no wide gutter does. A note long enough to wrap
// — French runs to 27 characters — wraps within its own right-aligned block,
// and `items-baseline` keeps its first line sitting on the path's.
//
// The rows are set tighter than body leading, because the connectors are drawn
// characters and the drawing only closes up when the rows are close enough for
// one row's `│` to point at the next one's. A tree is a shape; loosen it and it
// is eight lines that happen to be near each other.
export function MemoryTree({
  notes,
  className = "max-w-[23rem]",
}: {
  notes: MemoryTreeNotes;
  className?: string;
}) {
  return (
    <div
      className={`${printFrame} w-full ${className} bg-elev px-3.5 py-4 font-mono text-[0.75rem] leading-[1.6] sm:px-5 sm:text-[0.8rem] lg:text-[0.85rem]`}
    >
      {TREE.map((row) => (
        <div
          key={row.name}
          className="flex items-baseline justify-between gap-2 sm:gap-3"
        >
          <code className="whitespace-pre">
            <span className="text-muted">{row.prefix}</span>
            <span
              className={row.dir ? "font-medium text-accent-deep" : "text-ink"}
            >
              {row.name}
            </span>
          </code>
          {row.note && (
            <span className="text-right font-sans text-[0.68rem] leading-snug text-muted sm:text-[0.72rem] lg:text-[0.77rem]">
              {notes[row.note]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
