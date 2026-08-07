import { FiBookmark, FiPlayCircle, FiShield } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { IconChip } from "../ui/IconChip";
import { panelInset } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// The memory is a directory of Markdown files, so the visual is that directory —
// real paths, one module expanded, a second left collapsed to show there's one
// per module. Paths and glyphs are structure, not copy, so they stay here; the
// note beside each file comes from the copy module.
type Row = {
  line: string;
  dir?: boolean;
  note?: keyof HomeCopy["memory"]["tree"];
};

const TREE: Row[] = [
  { line: "docs/kanban/memory/", dir: true },
  { line: "├── goal.md", note: "goal" },
  { line: "├── local-ui/", dir: true, note: "module" },
  { line: "│   ├── readme.md", note: "readme" },
  { line: "│   ├── decisions.md", note: "decisions" },
  { line: "│   ├── rejected.md", note: "rejected" },
  { line: "│   └── redesign.md", note: "redesign" },
  { line: "└── site/", dir: true },
];

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

        {/* Two columns from `sm` up, the note beside the path it annotates.
            Below that the note moves under its path and indents.

            It has to move. The path column is `max-content` on a `whitespace-pre`
            tree, so the pair has a floor of about 380px — wider than a phone,
            and a grid column never shrinks under its content, so this panel was
            what put the whole page on a horizontal scrollbar. Squeezed to fit it
            would break "Reasons for rejection" over three lines against a
            one-line path. `overflow-x-auto` keeps a longer path in a translation
            inside this frame rather than back on the page. */}
        <div
          className={`${panelInset} overflow-x-auto px-6 py-5 font-mono text-[0.9rem] leading-relaxed sm:grid sm:grid-cols-[max-content_1fr] sm:items-baseline sm:gap-x-8 sm:gap-y-2`}
        >
          {TREE.map((row) => (
            <div key={row.line} className="mb-2 last:mb-0 sm:contents">
              <code
                className={`block whitespace-pre ${row.dir ? "text-accent-deep" : "text-ink"}`}
              >
                {row.line}
              </code>
              {/* A row with no note still has to hold its grid cell from `sm`
                  up, or every row after it shifts a column. On a phone there is
                  no column to hold, so it takes no line either. */}
              <span
                className={`pl-8 text-[0.85rem] text-muted sm:block sm:pl-0 ${
                  row.note ? "block" : "hidden"
                }`}
              >
                {row.note ? c.tree[row.note] : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
