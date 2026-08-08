import { FiBookmark, FiPlayCircle, FiShield } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { IconChip } from "../ui/IconChip";
import { panelInset } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// The memory is a directory of Markdown files, so the visual is that directory —
// real paths, one module expanded, a second left collapsed to show there's one
// per module. Paths and glyphs are structure, not copy, so they stay here; the
// note beside each file comes from the copy module.
// `line` is the drawn tree, for the two-column layout from `sm` up. `name` and
// `depth` are the same rows without the connectors, for the phone — see the
// panel below for why that width can't use the drawing.
type Row = {
  line: string;
  name: string;
  depth: 0 | 1 | 2;
  dir?: boolean;
  note?: keyof HomeCopy["memory"]["tree"];
};

const TREE: Row[] = [
  { line: "docs/kanban/memory/", name: "docs/kanban/memory/", depth: 0, dir: true },
  { line: "├── goal.md", name: "goal.md", depth: 1, note: "goal" },
  { line: "├── local-ui/", name: "local-ui/", depth: 1, dir: true, note: "module" },
  { line: "│   ├── readme.md", name: "readme.md", depth: 2, note: "readme" },
  { line: "│   ├── decisions.md", name: "decisions.md", depth: 2, note: "decisions" },
  { line: "│   ├── rejected.md", name: "rejected.md", depth: 2, note: "rejected" },
  { line: "│   └── redesign.md", name: "redesign.md", depth: 2, note: "redesign" },
  { line: "└── site/", name: "site/", depth: 1, dir: true },
];

// The phone tree's indent, one class per level — a rule per depth rather than a
// computed padding, so the values stay in the markup like every other spacing on
// the site. The nested step is the wider one because that is where the drawing
// used to put a `│` guide.
const INDENT = ["pl-0", "pl-4", "pl-9"] as const;

// One icon per claim, in the order the copy lists them: what's kept, what's
// avoided, where the next run picks up.
const ICONS = [FiBookmark, FiShield, FiPlayCircle];

export function Memory({ c }: { c: HomeCopy["memory"] }) {
  return (
    <section id="memory" className="mt-28 scroll-mt-24">
      <SectionTitle num="03" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      {/* The tree is only as wide as its longest path, so its column is sized to
          the content instead of taking half the row — otherwise the panel ends
          in dead space. The claims take whatever is left. */}
      <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* Three ranks per row so the panel isn't flat: a filled blue icon block
            anchors the left edge, the claim reads first, the evidence sits under
            it at a smaller size. The rows share the height evenly, which matches
            the tree beside them. */}
        <div
          className={`${panelInset} flex flex-col divide-y-2 divide-border `}
        >
          {c.cards.map((card, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={card.title}
                className="flex flex-1 items-center gap-4 px-6 py-5"
              >
                <IconChip icon={Icon} size="md" />
                <div>
                  <h3 className="text-[1.05rem] font-semibold leading-snug text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">
                    {card.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* The tree is two panels, one per width, because it is two different
            drawings — not one drawing that reflows.

            From `sm` up it is the listing a terminal prints: connectors drawn in
            the path, the note beside the path it annotates in a second column.
            The path column is `max-content` on a `whitespace-pre` tree, so that
            pair has a floor of about 380px, and a grid column never shrinks
            under its content — which is what once put the whole page on a
            horizontal scrollbar. `overflow-x-auto` keeps a longer path in a
            translation inside this frame rather than back on the page. */}
        <div
          className={`${panelInset} hidden overflow-x-auto px-6 py-5 font-mono text-[0.9rem] leading-relaxed sm:grid sm:grid-cols-[max-content_1fr] sm:items-baseline sm:gap-x-8 sm:gap-y-2`}
        >
          {TREE.map((row) => (
            <div key={row.line} className="contents">
              <code
                className={`block whitespace-pre ${row.dir ? "text-accent-deep" : "text-ink"}`}
              >
                {row.line}
              </code>
              {/* A row with no note still has to hold its grid cell, or every
                  row after it shifts a column. */}
              <span className="block text-[0.85rem] text-muted">
                {row.note ? c.tree[row.note] : ""}
              </span>
            </div>
          ))}
        </div>

        {/* On a phone there is no second column, so the note goes under its
            path — and then the connectors have to go. A drawn `├──` sets every
            path at the same left edge whatever its depth, so a note tucked
            under one landed left of the file it belongs to and the nesting read
            as noise. Here the indent is the structure: a file sits under its
            directory, and its note sits under it, one step further in. The blue
            still marks the directories, so the shape survives the change. */}
        <div
          className={`${panelInset} px-5 py-5 font-mono text-[0.85rem] leading-relaxed sm:hidden`}
        >
          {TREE.map((row) => (
            <div key={row.line} className={`${INDENT[row.depth]} mb-3 last:mb-0`}>
              <code className={row.dir ? "text-accent-deep" : "text-ink"}>
                {row.name}
              </code>
              {row.note && (
                <span className="mt-0.5 block pl-3 text-[0.8rem] text-muted">
                  {c.tree[row.note]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
