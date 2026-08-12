import { Fragment } from "react";
import { FiArrowRight, FiCheckCircle, FiFlag, FiZap } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { panelInset, panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// One icon per AI4Kanban answer, in row order: the goal you hand over, the work it
// then runs by itself, the call that comes back to you. Icons aren't language, so
// they live here rather than in the copy.
const ICONS = [FiFlag, FiZap, FiCheckCircle];

// Which grid row each comparison row sits on — row 1 is the column heads. Written
// out because Tailwind only sees class names that appear literally.
const ROWS = ["row-start-2", "row-start-3", "row-start-4"];

// From task tracking to autonomous planning — two columns, the traditional board
// and AI4Kanban, with an arrow between them on every row. Each column is one
// panel painted behind the rows by the grid, so the rows sit flush inside a card
// rather than floating apart.
//
// Neither card is outlined: each is a fill laid behind the grid, lifted off the
// page by the hard ink shadow every panel on the site casts, and the rows are
// cut apart by the rule between them. That is the whole structure — the lines
// inside a table are what a table is, and an outline around the outside of one
// only boxes in something the rows have already squared off.
//
// Which card wins is said with the neutral ramp, not with a border color: the
// traditional board sits in the wash, AI4Kanban on the paper above it, so the
// answer column is literally the brighter of the two. (A border color can't say
// it — `border-accent` appended to a panel loses to the `border-border` already
// in the string, which is why this read as two identical cards before.) The blue
// is left to the column head and the per-row icons.
//
// Below `sm` it becomes one panel with a block per row, each value naming its
// column.
export function Compare({ c }: { c: HomeCopy["compare"] }) {
  return (
    <section id="method" className="mt-28 scroll-mt-24">
      <SectionTitle num="01" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      {/* The table arrives as one block, not row by row: it is a comparison,
          and a comparison that assembles itself is three claims you read
          before the thing they are being compared against exists. */}
      <div
        data-reveal
        data-delay="2"
        className="mt-10 hidden grid-cols-[7rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)] sm:grid"
      >
        {/* The two cards, spanning every comparison row behind the text. */}
        <div
          aria-hidden="true"
          className={`${panelInset} col-start-2 row-start-2 row-span-3`}
        />
        <div
          aria-hidden="true"
          className={`${panelStatic} col-start-4 row-start-2 row-span-3`}
        />

        <span className="col-start-2 row-start-1 px-7 pb-3 text-[0.8rem] font-semibold text-muted">
          {c.columns.classic}
        </span>
        <span className="col-start-4 row-start-1 px-7 pb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          {c.columns.kanban}
        </span>

        {c.rows.map((row, i) => {
          const Icon = ICONS[i];
          const divider = i > 0 ? "border-t-2" : "";
          return (
            <Fragment key={row.dimension}>
              <p
                className={`${ROWS[i]} col-start-1 flex items-center pr-6 text-[0.95rem] text-muted`}
              >
                {row.dimension}
              </p>
              <p
                className={`${ROWS[i]} ${divider} col-start-2 flex items-center border-border px-7 py-6 text-[1rem] text-muted`}
              >
                {row.classic}
              </p>
              <span
                aria-hidden="true"
                className={`${ROWS[i]} col-start-3 flex items-center justify-center`}
              >
                <FiArrowRight className="h-4 w-4 text-accent-deep" />
              </span>
              <p
                className={`${ROWS[i]} ${divider} col-start-4 flex items-center gap-3 border-border px-7 py-6 text-[1rem] font-medium text-ink`}
              >
                <Icon
                  aria-hidden="true"
                  className="h-[1.15rem] w-[1.15rem] shrink-0 text-accent-deep"
                />
                {row.kanban}
              </p>
            </Fragment>
          );
        })}
      </div>

      {/* Below `sm` the grid becomes one card per row of it — the dimension is
          the card's title bar and the two answers are its only contents, so
          what a line belongs to is said by the card edge rather than by
          reading order. As one long card it wasn't: nine bands separated by
          the same rule, and a dimension looked like a third answer with no
          text under it.
          Each answer names its column on its own line above it, because at
          this width the value wraps and an inline label reads as the first
          words of the sentence. Which one wins is the ramp again — the
          traditional board in the wash, ours on the paper below it, same as
          the wide layout.
          The title bar takes the accent bar `SectionTitle` puts in front of a
          section number: on this page that mark means "what follows is
          titled", and it is the one blue here that isn't the AI4Kanban
          label. */}
      <div className="mt-9 space-y-4 sm:hidden">
        {c.rows.map((row, i) => {
          const Icon = ICONS[i];
          return (
            <div
              key={row.dimension}
              data-reveal
              className={`${panelStatic} overflow-hidden`}
            >
              <p className="flex items-center gap-2.5 border-b-2 border-border px-5 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-ink">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-1 shrink-0 rounded-full bg-accent"
                />
                {row.dimension}
              </p>
              <div className="bg-code px-5 py-3.5">
                <p className="text-[0.78rem] font-semibold text-muted">
                  {c.columns.classic}
                </p>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">
                  {row.classic}
                </p>
              </div>
              <div className="border-t-2 border-border px-5 py-3.5">
                <p className="flex items-center gap-2 font-mono text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-accent-deep">
                  <Icon
                    aria-hidden="true"
                    className="h-[1.05rem] w-[1.05rem] shrink-0"
                  />
                  {c.columns.kanban}
                </p>
                <p className="mt-1 text-[0.95rem] font-medium leading-relaxed text-ink">
                  {row.kanban}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
