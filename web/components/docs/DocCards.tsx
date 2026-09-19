import { createElement, type ReactNode } from "react";
import { FiArrowRight, FiDownload } from "react-icons/fi";
import { hairline } from "../styles";
import { docIcon } from "./doc-icons";

// The tags a documentation page can write that prose has no syntax for. All are
// in scope inside any `.mdx` body under `web/content/docs/` — `DocArticle.tsx`
// hands them to the compiler.
//
// `<CardGroup>` is a list of links into other pages, one hairline row per
// `<Card>`; `numbered` swaps the icons for a reading order. The link's underline
// reset lives in `app/blog-prose.css` (`.blog-prose a.mdx-card`).

export function CardGroup({
  numbered = false,
  children,
}: {
  /** Ignored: rows replaced the grid. Kept so existing pages still compile. */
  cols?: number;
  numbered?: boolean;
  children: ReactNode;
}) {
  return (
    <ul
      data-numbered={numbered || undefined}
      className={`mdx-block group/dest !list-none border-t !pl-0 [counter-reset:dest] ${hairline}`}
    >
      {children}
    </ul>
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
    <li className={`!mt-0 border-b [counter-increment:dest] ${hairline}`}>
      <a
        href={href}
        rel={external ? "noopener" : undefined}
        className="mdx-card group flex items-center gap-3.5 py-3"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted">
          <span className="group-data-[numbered]/dest:hidden">
            {createElement(docIcon(icon), { size: 15, "aria-hidden": "true" })}
          </span>
          <span
            aria-hidden="true"
            className="hidden font-mono text-sm before:content-[counter(dest)] group-data-[numbered]/dest:inline"
          />
        </span>
        {/* Divs, not spans: MDX wraps a card's description in a <p>. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="font-medium leading-snug text-ink transition-colors group-hover:text-accent-deep">
            {title}
          </div>
          {children && (
            <div className="text-sm leading-relaxed text-muted [&>p]:m-0">
              {children}
            </div>
          )}
        </div>
        <FiArrowRight
          className="h-4 w-4 shrink-0 text-muted/60 transition-colors group-hover:text-accent-deep"
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

// The two ways onto the board, side by side at the top of the overview. The
// link and the commands (a code block as children) are written in the page, so
// its copied Markdown still carries them.
export function InstallBoard({
  download,
  children,
}: {
  download: string;
  children: ReactNode;
}) {
  const box = `flex flex-col gap-2 rounded-lg border px-4 py-3.5 ${hairline}`;
  return (
    <div className="mdx-block grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className={box}>
        <div className="font-medium">Desktop app</div>
        <div className="text-sm leading-relaxed text-muted">
          macOS, Windows and Linux. Open your project and the board is there.
        </div>
        <a
          href={download}
          className="mdx-action mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-elev no-underline transition-colors hover:bg-accent-deep"
        >
          <FiDownload className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </a>
      </div>
      <div className={box}>
        <div className="font-medium">Terminal</div>
        <div className="text-sm leading-relaxed text-muted">
          Install the command, then add a board to your project.
        </div>
        <div className="doc-install mt-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// A callout on a documentation page: a thin left line and body-colour text.
export function Callout({
  title,
  children,
}: {
  type?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title ?? "Note"}
      className="mdx-block border-l-2 border-accent/60 pl-4"
    >
      {title && <div className="font-semibold">{title}</div>}
      <div className="mdx-body mt-1 first:mt-0">{children}</div>
    </aside>
  );
}
