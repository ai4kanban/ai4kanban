import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa6";
import { FiDownload } from "react-icons/fi";
import { GITHUB_URL } from "./content";
import { panelBareInset } from "./styles";
import { Button } from "./ui/Button";

// The block a page ends on, set like the closing panel of a magazine feature: a
// label over a hairline, then the headline across the measure with the actions
// on the right of the same row. Bare wash — the shadow belongs to the buttons,
// which are the part you press; a lifted panel would only compete with them.
//
// The two columns are what makes it a block rather than a stack: a headline that
// stops at 24ch with buttons under it leaves the right half of the panel empty,
// and empty right halves read as an unfinished layout, not as air.
//
// Everything has a default. A caller that has nothing of its own to say writes
// `<ClosingCta />`; one that does replaces a part. Supporting copy is opt-in:
// the headline and the buttons already say it.

const DEFAULT_TITLE = "A project board that plans itself.";

export function ClosingCta({
  actions,
  children,
  className = "",
  eyebrow = "Get started",
  note = "Free · macOS, Windows, Linux",
  title = DEFAULT_TITLE,
}: {
  /** Replaces the download and repository pair. */
  actions?: ReactNode;
  /** The supporting line. Markdown from a post's body lands here. */
  children?: ReactNode;
  className?: string;
  eyebrow?: string;
  note?: string;
  title?: string;
}) {
  return (
    <aside
      aria-label={title}
      className={`${panelBareInset} px-6 py-6 sm:px-8 sm:py-7 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          {eyebrow}
        </span>
      </div>

      {/* A headline, not a heading: this panel is an action, not a section of
          the article, so it stays out of the page outline — and out of the way
          of `.blog-prose h2`, which would otherwise set it. It runs the full
          measure, which is what keeps the type this large. */}
      <p className="mt-4 text-[1.6rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.1rem]">
        {title}
      </p>
      {/* `mdx-body` is the gap between compiled Markdown paragraphs, and is
          inert outside a post's body (`app/blog-prose.css`). */}
      {children ? (
        <div className="mdx-body mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed text-muted">
          {children}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 border-t border-ink/15 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex shrink-0 flex-wrap gap-3">
          {actions ?? (
            <>
              <Button href="/download" variant="primary" size="sm" className="mdx-action">
                <FiDownload aria-hidden="true" className="size-4" />
                Download
              </Button>
              <Button href={GITHUB_URL} size="sm" className="mdx-action">
                <FaGithub aria-hidden="true" className="size-4" />
                GitHub
              </Button>
            </>
          )}
        </div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted sm:text-right">
          {note}
        </p>
      </div>
    </aside>
  );
}
