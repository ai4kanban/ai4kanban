import { Fragment } from "react";
import { FiArrowRight, FiCheckCircle, FiFlag, FiZap } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

// One icon per AI4Kanban answer, in row order: the goal you hand over, the work it
// then runs by itself, the call that comes back to you. Icons aren't language, so
// they live here rather than in the copy.
const ICONS = [FiFlag, FiZap, FiCheckCircle];

// Which grid row each comparison row sits on — row 1 is the column heads. Written
// out because Tailwind only sees class names that appear literally.
const ROWS = ["row-start-2", "row-start-3", "row-start-4"];

// From task tracking to autonomous planning — two columns, the traditional board
// and AI4Kanban, with an arrow between them on every row. Both columns are one
// `panelStatic` each, painted behind the rows by the grid, so the rows sit flush
// inside a card and are told apart by a divider rather than a gap. The AI4Kanban
// card carries the accent border the panel already uses on hover, plus an icon per
// row. Below `sm` it becomes one panel with a block per row, each value naming its
// column.
export function Compare({ c }: { c: HomeCopy["compare"] }) {
  return (
    <section id="method" className="mt-28 scroll-mt-24">
      <SectionTitle num="01" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      <div className="mt-10 hidden grid-cols-[7rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)] sm:grid">
        {/* The two cards, spanning every comparison row behind the text. */}
        <div
          aria-hidden="true"
          className={`${panelStatic} col-start-2 row-start-2 row-span-3`}
        />
        <div
          aria-hidden="true"
          className={`${panelStatic} col-start-4 row-start-2 row-span-3 border-accent/50`}
        />

        <span className="col-start-2 row-start-1 px-7 pb-3 text-[0.8rem] font-semibold text-muted">
          {c.columns.classic}
        </span>
        <span className="col-start-4 row-start-1 px-7 pb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
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
                <FiArrowRight className="h-4 w-4 text-accent/50" />
              </span>
              <p
                className={`${ROWS[i]} ${divider} col-start-4 flex items-center gap-3 border-accent/15 px-7 py-6 text-[1rem] font-medium text-ink`}
              >
                <Icon
                  aria-hidden="true"
                  className="h-[1.15rem] w-[1.15rem] shrink-0 text-accent"
                />
                {row.kanban}
              </p>
            </Fragment>
          );
        })}
      </div>

      <div className={`${panelStatic} mt-9 divide-y-2 divide-border sm:hidden`}>
        {c.rows.map((row, i) => {
          const Icon = ICONS[i];
          return (
            <div key={row.dimension} className="px-5 py-4">
              <p className="text-[0.85rem] text-muted/60">{row.dimension}</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                <span className="mr-2 text-[0.8rem] text-muted/50">
                  {c.columns.classic}
                </span>
                {row.classic}
              </p>
              <p className="mt-2 flex items-start gap-2.5 text-[0.95rem] font-medium leading-relaxed text-ink">
                <Icon
                  aria-hidden="true"
                  className="mt-[0.25rem] h-[1.05rem] w-[1.05rem] shrink-0 text-accent"
                />
                <span>
                  <span className="mr-2 font-mono text-[0.8rem] font-normal text-accent/70">
                    {c.columns.kanban}
                  </span>
                  {row.kanban}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
