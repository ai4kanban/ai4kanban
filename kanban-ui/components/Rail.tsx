"use client";

// The rail down the left of the window: the board at the top, then every card
// this window has open, each one closeable (see app/design/layouts).
//
// It exists because a desktop window has neither a back gesture nor a back
// button — a trackpad swipe does nothing in an Electron window — so opening a
// card has to leave a mark on screen that is also the way back. That mark is a
// row here. All cards is the first row and never closes: it is the board.
//
// The rail has no surface of its own. It sits on the window's cream with the top
// row, so the two read as one L-shaped chrome rather than as two regions that
// each need an edge drawn to say where they stop.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiColumns, FiX } from "react-icons/fi";
import type { OpenCard } from "@/lib/open-cards";
import { HAIRLINE } from "./chrome";

// Wide enough that a title says something before it truncates, and rows tall
// enough to be aimed at with a trackpad. Under `md` the rail is gone: at phone
// width it would take most of the window, and a browser there has the back
// button the desktop window doesn't.
const RAIL_W = 216;

export function Rail({
  rows,
  activeId,
  total,
  onClose,
}: {
  /** The open cards, in the order they were opened. */
  rows: OpenCard[];
  /** The card this window is showing, or null for the board. */
  activeId: number | null;
  /** How many cards the board holds open — the count on All cards. */
  total: number;
  onClose: (id: number) => void;
}) {
  const router = useRouter();

  // Closing the row you are standing on has to say where to stand instead: the
  // card after it, else the one before, else the board. Closing a row you are
  // not on moves nothing.
  const close = (id: number) => {
    onClose(id);
    if (id !== activeId) return;
    const at = rows.findIndex((c) => c.id === id);
    const next = rows[at + 1] ?? rows[at - 1] ?? null;
    router.push(next ? `/${next.id}` : "/");
  };

  return (
    <nav
      className="hidden shrink-0 flex-col gap-0.5 overflow-y-auto p-2 md:flex"
      style={{ width: RAIL_W }}
      aria-label="Open cards"
    >
      <RailRow href="/" label="All cards" active={activeId === null} count={total} />
      {rows.length > 0 && <RailLabel text="Open cards" count={rows.length} />}
      {rows.map((card) => (
        <RailRow
          key={card.id}
          href={`/${card.id}`}
          label={card.title}
          id={card.id}
          active={card.id === activeId}
          onClose={() => close(card.id)}
        />
      ))}
    </nav>
  );
}

/** One row. The open row is paper with an inset ink outline rather than a hard
 *  shadow: at row height a shadow reads as a lifted button instead of as where
 *  you are.
 *
 *  The ✕ is a sibling of the link and not a child of it — a button inside an
 *  anchor is neither valid nor reachable — so it is placed over the row's right
 *  edge, and the link keeps room for it. */
function RailRow({
  href,
  label,
  id,
  count,
  active,
  onClose,
}: {
  href: string;
  label: string;
  id?: number;
  count?: number;
  active: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        title={label}
        className={`flex h-[30px] w-full items-center gap-2 rounded-[8px] pl-2.5 text-left text-[12.5px] ${
          onClose ? "pr-7" : "pr-2"
        } ${
          active
            ? "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]"
            : "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
        }`}
      >
        {id === undefined ? (
          <FiColumns size={13} className="shrink-0" aria-hidden />
        ) : (
          <span
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{ color: active ? "var(--color-nb-accent)" : "inherit", opacity: active ? 1 : 0.6 }}
          >
            {id}
          </span>
        )}
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">
            {count}
          </span>
        )}
      </Link>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          title={`Close ${label}`}
          aria-label={`Close ${label}`}
          className={`absolute right-1 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:opacity-100 group-hover:opacity-60 group-hover:hover:opacity-100 ${
            active ? "opacity-40" : "opacity-0"
          }`}
        >
          <FiX size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A rail section title: 10px, upper, and carrying the count on the same line so
 *  the label row is never spent on the label alone. The hairline above it is
 *  what separates the board from the cards opened off it. */
function RailLabel({ text, count }: { text: string; count: number }) {
  return (
    <div
      className="mb-1 mt-2.5 flex items-center justify-between px-2.5 pb-1.5 pt-2.5"
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
    >
      <span className="text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        {text}
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-nb-ink-soft opacity-70">
        {count}
      </span>
    </div>
  );
}
