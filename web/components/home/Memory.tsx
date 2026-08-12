import { FiBookmark, FiPlayCircle, FiShield } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { IconChip } from "../ui/IconChip";
import { panelInset } from "../styles";
import { CDN } from "@/lib/site";
import type { HomeCopy } from "@/i18n/home/types";

// The watercolour the tree is mounted on — the same set `Loop.tsx` mounts its
// four shots on, so a listing and a screenshot read as the same kind of object
// wherever the page shows one.
const TREE_MAT = `${CDN}/bloom-2.jpg`;

// The memory is a directory of Markdown files, so the visual is that directory —
// real paths, one module expanded, a second left collapsed to show there's one
// per module. Paths and glyphs are structure, not copy, so they stay here; the
// note beside each file comes from the copy module.
//
// `prefix` is the drawn connector, stored apart from the name so it can be set
// in the muted grey: the connectors are the listing's rules, not its content,
// and at the ink they weighed as much as the filenames they were pointing at.
// They are drawn at one dash rather than the canonical two, and the nested level
// is indented three columns rather than four — the whole listing is then five
// characters narrower than a terminal would print it, which is what buys the
// note a place on the same line at phone width.
type Row = {
  prefix: string;
  name: string;
  dir?: boolean;
  note?: keyof HomeCopy["memory"]["tree"];
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

// One icon per claim, in the order the copy lists them: what's kept, what's
// avoided, where the next run picks up.
const ICONS = [FiBookmark, FiShield, FiPlayCircle];

export function Memory({ c }: { c: HomeCopy["memory"] }) {
  return (
    <section id="memory" className="mt-28 scroll-mt-24">
      <SectionTitle num="03" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      {/* Two halves of one row, at the same width: the claims are what the
          memory is for and the listing is what it is, and neither outranks the
          other. The tree column being sized to its own content instead put the
          split wherever the longest note in the current language happened to
          land, which moved the seam between the two panels from language to
          language. The mat takes the half and the print sits centred on it —
          that is the mat's job, and a picture is allowed to have a margin. */}
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        {/* Three ranks per row so the panel isn't flat: a filled blue icon block
            anchors the left edge, the claim reads first, the evidence sits under
            it at a smaller size. The rows share the height evenly, which matches
            the tree beside them. */}
        {/* The two halves of the row arrive a beat apart, left then right —
            the claims are the sentence and the listing is the evidence for it,
            so they land in that order. */}
        <div
          data-reveal
          data-delay="1"
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

        {/* One listing at every width. It used to be two — a two-column grid
            from `sm` up and, on the phone, a connectorless version with the
            note tucked under its path — because a note in its own grid column
            can't survive a 320px viewport. What removed the fork was making the
            note share the path's line instead of taking a column: the path sets
            left, the note sets right, and the space between them is whatever
            the width happens to leave. Nothing has to reflow, so nothing has to
            be redrawn for the phone.

            It is mounted the way `Loop.tsx` mounts its shots: a watercolour
            mat, and the listing laid on it as a print — paper, soft shadow, no
            outline. It is the same object those are, a picture of the product's
            files, so it is mounted and not framed. The mat also gives the
            listing a margin of its own, which is what a terminal frame was
            doing before with an ink box.

            The print is capped and centred rather than filling its column. The
            listing is eight short lines; run to the full width of a tablet the
            gap between a path and its note opens far enough that the pair stops
            reading as one row, and the cap is the width at which it still does.
            Centring is also what lets the claims beside it set the height of
            the row.

            Two faces, because the two halves of a row are different kinds of
            thing: the path is what the terminal printed, in the mono, and the
            note is our annotation of it, in the sans a step smaller. That is
            what separates the columns now that no rule and no wide gutter
            does. A note long enough to wrap — French runs to 27 characters —
            wraps within its own right-aligned block, and `items-baseline`
            keeps its first line sitting on the path's.

            The rows are set tighter than body leading, because the connectors
            are drawn characters and the drawing only closes up when the rows
            are close enough for one row's `│` to point at the next one's. A
            tree is a shape; loosen it and it is eight lines that happen to be
            near each other. */}
        <Mat
          src={TREE_MAT}
          data-reveal
          data-delay="2"
          className="flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className={`${printFrame} w-full max-w-[23rem] bg-elev px-3.5 py-4 font-mono text-[0.75rem] leading-[1.6] sm:px-5 sm:text-[0.8rem]`}
          >
            {TREE.map((row) => (
              <div
                key={row.name}
                className="flex items-baseline justify-between gap-2 sm:gap-3"
              >
                <code className="whitespace-pre">
                  <span className="text-muted">{row.prefix}</span>
                  <span
                    className={
                      row.dir ? "font-medium text-accent-deep" : "text-ink"
                    }
                  >
                    {row.name}
                  </span>
                </code>
                {row.note && (
                  <span className="text-right font-sans text-[0.68rem] leading-snug text-muted sm:text-[0.72rem]">
                    {c.tree[row.note]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Mat>
      </div>
    </section>
  );
}
