import { createElement, type ReactNode } from "react";
import { panel } from "../styles";
import { docIcon } from "./doc-icons";

// The one thing a documentation page can write that prose has no syntax for: a
// grid of links into other pages. `<CardGroup>` lays the grid out, `<Card>` is
// one titled, icon'd link. Both are in scope inside any `.mdx` body under
// `web/content/docs/` — `DocArticle.tsx` hands the pair to the compiler.
//
// A card is the site's raised panel: paper, the hard ink shadow, and the lift on
// hover. The icon tile inside it is bare wash — a raised block inside a raised
// block is the one nesting the design rules out.
//
// The link's underline reset lives in `app/blog-prose.css` (`.blog-prose a.mdx-card`),
// since `.blog-prose a` would otherwise win on specificity.

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

export function CardGroup({
  cols = 2,
  children,
}: {
  cols?: number;
  children: ReactNode;
}) {
  return (
    <div className={`mdx-block grid grid-cols-1 gap-4 ${COLS[cols] ?? COLS[2]}`}>
      {children}
    </div>
  );
}

export function Card({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon?: string;
  href: string;
  children?: ReactNode;
}) {
  const external = href.startsWith("http");

  return (
    <a
      href={href}
      rel={external ? "noopener" : undefined}
      className={`mdx-card ${panel} flex items-start gap-3.5 px-5 py-4`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-code text-accent">
        {/* createElement, so the resolved icon isn't aliased to a capitalized
            variable in the middle of the render body. */}
        {createElement(docIcon(icon), {
          size: 17,
          "aria-hidden": "true",
        })}
      </span>
      {/* Divs, not spans: MDX wraps a card's description in a <p>, which is not
          valid inside a <span>. */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="font-semibold leading-snug text-ink">{title}</div>
        {children && (
          <div className="text-sm leading-relaxed text-muted">{children}</div>
        )}
      </div>
    </a>
  );
}
