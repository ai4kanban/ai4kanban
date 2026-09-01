"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { detectSystem, type Pick } from "./detect";
import type { ResolvedSystem } from "./builds";

// The download page's opening block: one spread split in two, the words on the
// wash and the button on the ember. The right half is the button — the whole
// half, not a control sitting on it — so the largest thing on the page is also
// the thing to hit.
//
// It is flat: no outline, no hard shadow. The two fills are the whole of the
// block, the way a magazine spread is two inks on one page, and the only thing
// that lifts off it is the one square you are meant to hit.
//
// It renders the neutral state first and swaps in the reader's system once
// mounted. The site is a static export, so a server-side guess would hand most
// readers another system's build; the neutral state points at the release page
// and is also what a reader with no JavaScript keeps.

export function DownloadHero({
  systems,
  version,
  title,
  lead,
  cta,
  ctaFor,
  fallback,
}: {
  systems: ResolvedSystem[];
  version: string;
  title: string;
  lead: string;
  /** The neutral label, before the system is known. One word. */
  cta: string;
  /** The label once it is known, carrying `{system}`. */
  ctaFor: string;
  fallback: string;
}) {
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    let live = true;
    detectSystem(systems).then((found) => {
      if (live) setPick(found);
    });
    return () => {
      live = false;
    };
  }, [systems]);

  const label = pick ? ctaFor.replace("{system}", pick.system.name) : cta;
  // Release facts, never copy: the build's own name and the version.
  const meta = pick ? `${pick.build.label} · v${version}` : `v${version}`;

  return (
    // Not an even split: the words get the wider half so a short title (zh's
    // "AI4Kanban 桌面版") still holds the spread, and the ember stays the
    // smaller, denser block it needs to be to read as one button.
    <div className="grid overflow-hidden rounded-xl md:grid-cols-[7fr_5fr]">
      <div className="flex flex-col bg-code px-8 py-12 sm:px-12 sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-muted">{lead}</p>
      </div>

      {/* The whole half is the button; the raised label groups its file facts
          with the download glyph rather than adding another line of copy. */}
      <a
        href={pick ? pick.build.url : fallback}
        rel="noopener"
        className="group flex flex-col bg-accent px-8 py-12 text-elev no-underline transition-colors duration-150 hover:bg-accent-deep sm:px-12 sm:py-16"
      >
        {/* The two headings begin on the same row across the split. */}
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{label}</h2>
        {/* The one lift on the page, and it is the site's own: a hard ink
            offset at the button's offset, growing by exactly the hover
            translate so the block's bottom-right edge stays pinned. */}
        <span className="mt-8 inline-flex self-start items-center gap-3 rounded-xl bg-elev px-4 py-3 text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0_0_var(--color-ink)] group-active:translate-x-0 group-active:translate-y-0 group-active:shadow-[2px_2px_0_0_var(--color-ink)]">
          <FiDownload className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-[0.9rem] font-semibold">{meta}</span>
        </span>
      </a>
    </div>
  );
}
