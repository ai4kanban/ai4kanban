"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { panelInset } from "../styles";
import type { TocItem } from "@/lib/blog";

// "On this page", rendered twice by a post: as a rail beside the column from
// `lg` up, and as a block that opens above the body below it. Both read the
// current heading from one observer each, which is cheap and keeps the state
// out of the server component that lays the page out.
//
// The mark for the heading you are in is a bar in the resting ember — a rail is
// a shape, which is the one job that colour has. An item you are not in draws
// no line at all rather than a fainter one.

const LABEL =
  "font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted";

// The topmost heading currently on screen, or — when the reader is in the gap
// below one — the last heading they scrolled past, so the rail never blanks.
function useActiveHeading(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) {
          setActive(first);
          return;
        }
        const passed = headings.filter((el) => el.getBoundingClientRect().top < 120);
        if (passed.length > 0) setActive(passed[passed.length - 1].id);
      },
      // Ignore the band under the sticky header, and the bottom two thirds of
      // the viewport — a heading is "current" once it is near the top.
      { rootMargin: "-88px 0px -66% 0px" },
    );

    for (const el of headings) observer.observe(el);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function TocList({
  items,
  active,
  onNavigate,
}: {
  items: TocItem[];
  active: string | undefined;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex list-none flex-col">
      {items.map((item) => {
        const current = item.id === active;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={onNavigate}
              aria-current={current ? "location" : undefined}
              className={`block border-l-2 py-1.5 text-sm leading-snug no-underline transition-colors ${
                item.depth === 3 ? "pl-6" : "pl-3"
              } ${
                current
                  ? "border-accent font-semibold text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** The rail beside the column, from `lg` up. */
export function TocRail({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveHeading(ids);
  // One heading is not a table of contents.
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="On this page"
      className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain"
    >
      <p className={`${LABEL} mb-3 pl-3`}>On this page</p>
      <TocList items={items} active={active} />
    </nav>
  );
}

/**
 * The same list, folded into a block above the body, below `lg`.
 *
 * `noRail` keeps it at every width, for a page whose left column is already a
 * route rail (the documentation) and so has no room for `TocRail` beside it.
 */
export function TocBlock({
  items,
  noRail = false,
}: {
  items: TocItem[];
  noRail?: boolean;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveHeading(ids);
  const details = useRef<HTMLDetailsElement>(null);
  if (items.length < 2) return null;

  return (
    // Closed at rest even where it is the page's only contents list: a long
    // documentation page has twenty headings, and opening with all of them
    // pushes the first sentence off the screen.
    <details
      ref={details}
      className={`${panelInset} group mb-10 px-5 py-4 ${noRail ? "" : "lg:hidden"}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className={LABEL}>On this page</span>
        <span
          aria-hidden="true"
          className="text-lg leading-none text-accent-deep transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-4">
        <TocList
          items={items}
          active={active}
          onNavigate={() => {
            if (details.current) details.current.open = false;
          }}
        />
      </div>
    </details>
  );
}
