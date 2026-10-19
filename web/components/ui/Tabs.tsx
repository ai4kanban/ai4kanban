import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

// Tabs and page numbers, per `web/design.md`: the selected one is deep-ember
// text over a short ember bar, the rest muted text.

const tone = (on: boolean) => (on ? "text-accent-deep" : "text-muted hover:text-ink");

function Bar({ centered }: { centered?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute bottom-0 h-[3px] w-5 rounded-full bg-accent ${centered ? "left-1/2 -translate-x-1/2" : "left-0"}`}
    />
  );
}

export function Tab({
  href,
  on,
  count,
  onClick,
  children,
}: {
  href: string;
  on: boolean;
  count?: number;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`relative flex shrink-0 items-baseline gap-1.5 whitespace-nowrap py-2 text-sm font-semibold no-underline transition-colors ${tone(on)}`}
    >
      {children}
      {count !== undefined && <span className="font-mono text-xs font-medium opacity-70">{count}</span>}
      {on && <Bar />}
    </Link>
  );
}

/** A row of tabs; on a phone it scrolls past the column's edges instead of wrapping. */
export function Tabs({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className={className}>
      <div className="-mx-6 flex items-center gap-6 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {children}
      </div>
    </nav>
  );
}

export function Pager({
  page,
  pages,
  onPage,
  label,
  prev,
  next,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  label: string;
  prev: string;
  next: string;
}) {
  if (pages < 2) return null;
  const step = (off: boolean) =>
    `flex h-9 items-center gap-1 px-3 text-sm font-semibold transition-colors ${off ? "text-muted/40" : tone(false)}`;
  return (
    <nav aria-label={label} className="mt-14 flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" className={step(page === 1)} disabled={page === 1} onClick={() => onPage(page - 1)}>
        <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
        {prev}
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
          className={`relative flex h-9 w-9 items-center justify-center text-sm font-semibold transition-colors ${tone(n === page)}`}
        >
          {n}
          {n === page && <Bar centered />}
        </button>
      ))}
      <button type="button" className={step(page === pages)} disabled={page === pages} onClick={() => onPage(page + 1)}>
        {next}
        <FiChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
