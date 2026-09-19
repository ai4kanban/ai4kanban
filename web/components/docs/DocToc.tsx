"use client";

import { useMemo, useRef } from "react";
import { FiAlignLeft, FiArrowUp, FiChevronDown } from "react-icons/fi";
import { useActiveHeading } from "../blog/BlogToc";
import { hairline } from "../styles";
import type { TocItem } from "@/lib/blog";

// "On this page" for a documentation page: a rail right of the body from `xl`
// up, a folded block above it below that. One heading is not a contents list.

export function DocTocRail({ items }: { items: TocItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveHeading(ids);
  if (items.length < 2) return null;
  const at = items.findIndex((i) => i.id === active);

  return (
    <nav
      aria-label="On this page"
      className="hidden xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100vh-8rem)] xl:w-48 xl:shrink-0 xl:flex-col xl:self-start"
    >
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink">
        <FiAlignLeft className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        On this page
      </p>
      {/* The track runs down the icon column's centre; labels start 20px in. */}
      <ul className="relative flex min-h-0 list-none flex-col gap-px overflow-y-auto overscroll-contain before:absolute before:inset-y-0 before:left-[6.5px] before:w-px before:bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)]">
        {items.map((item, i) => {
          const current = i === at;
          return (
            <li key={item.id} className="relative">
              {current && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-[5.5px] w-[3px] rounded-full bg-accent"
                />
              )}
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={`block py-1 pr-2 text-[0.8125rem] leading-5 no-underline transition-colors ${
                  item.depth === 3 ? "pl-8" : "pl-5"
                } ${
                  current
                    ? "font-medium text-ink"
                    : i < at
                      ? "text-ink/70 hover:text-ink"
                      : "text-muted/80 hover:text-ink"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
      <a
        href="#"
        className="mt-4 flex items-center gap-1.5 text-xs text-muted no-underline transition-colors hover:text-ink"
      >
        <FiArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        Back to top
      </a>
    </nav>
  );
}

export function DocTocBlock({ items }: { items: TocItem[] }) {
  const details = useRef<HTMLDetailsElement>(null);
  if (items.length < 2) return null;

  return (
    <details
      ref={details}
      className={`group mt-6 border-y py-2.5 xl:hidden ${hairline}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted [&::-webkit-details-marker]:hidden">
        On this page
        <FiChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="mt-2 flex list-none flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={() => {
                if (details.current) details.current.open = false;
              }}
              className={`block py-1 text-sm leading-snug text-ink/75 no-underline hover:text-ink ${
                item.depth === 3 ? "pl-4" : ""
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
