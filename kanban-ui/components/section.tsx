"use client";

import type { ReactNode } from "react";
import { FiChevronRight } from "react-icons/fi";

// ---- a section of a page -----------------------------------------------------
//
// A page is one sheet, not a stack of boxes. What parts two sections is the wash strip
// their name sits in — the same band the board's columns wear — and the content under it
// is on the page's own paper. The frames that used to go round each section were outlines
// saying only "these lines belong together", which the strip says on its own. A hairline
// rule was tried in this job first and could not do it: no edges and no colour change, so
// the page had to be read to be parted.
//
// Whatever a section has to signal it signals in ink, never in another edge: an ember
// spine down the side of the one that wants an answer, a coloured mark in the strip. A
// raised block on a page of sections now means something is happening in it — a delivery,
// a log, a diff.

/** The strip itself, and the two ways a section wears it. */
const STRIP = "nb-strip nb-tag";

/** The hover a strip you can press takes. A strip that only names its section never
 *  moves, so anything that lightens under the cursor is a control. */
const PRESSABLE =
  "w-full cursor-pointer list-none transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,var(--color-nb-paper))]";

export function Section({
  label,
  mark,
  aside,
  /** The ember down its left side — this section wants an answer. Nothing else takes one:
   *  a spine on every section is a second boundary saying what the strip already said. */
  spine,
  children,
}: {
  label: string;
  mark?: ReactNode;
  aside?: ReactNode;
  spine?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <div className={`${STRIP} mb-3`}>
        {mark}
        <span className="shrink-0">{label}</span>
        {aside}
      </div>
      {spine ? (
        <div className="pl-3.5" style={{ borderLeft: "2px solid var(--color-nb-accent)" }}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** The same section, shut (#262). Its strip IS the control — it is the one section you
 *  open, so the band that names it is the band you press.
 *
 *  A native <details> rather than a div hidden by hand: the window's own Find reaches into
 *  a closed one and opens it at the word, in the browsers that can do that, and the
 *  `toggle` it fires is how the caller's state catches up. */
export function FoldSection({
  label,
  mark,
  aside,
  open,
  onToggle,
  children,
}: {
  label: string;
  mark?: ReactNode;
  /** Worth saying while it is shut — how many lines are inside, what is waiting. */
  aside?: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details className="nb-fold" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      {/* w-full because .nb-tag is inline-flex, which would otherwise shrink the band to
          its words. */}
      <summary className={`${STRIP} ${PRESSABLE}`}>
        <FiChevronRight
          size={13}
          aria-hidden
          className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`}
        />
        {mark}
        <span className="shrink-0">{label}</span>
        {aside}
      </summary>
      <div className="pt-3.5">{children}</div>
    </details>
  );
}
