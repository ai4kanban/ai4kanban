import { IconChip } from "@/components/ui/IconChip";
import { BuildLink } from "./BuildLink";
import { DownloadHero } from "./DownloadHero";
import { SYSTEM_ICON } from "./icons";
import type { ResolvedSystem } from "./builds";

// The whole of the download offer as one block: the words on the wash, the
// button on the ember, every file on the ink beneath them. A magazine spread —
// three inks meeting on hard edges, no gap between them, nothing outlined.
//
// It is one block because it is one decision. Split into a hero and a card grid
// the page asked the reader twice: once with a button, again with three panels
// that repeated the button's own file. Continuous, the button is the offer and
// the ink strip is the fine print under it, which is the order a reader wants.
//
// Flat throughout: the only lift is the CTA inside the ember half, so the one
// square you are meant to hit is the one thing that leaves the page.

export function DownloadBlock({
  systems,
  version,
  title,
  lead,
  cta,
  ctaFor,
  buildsTitle,
  fallback,
}: {
  systems: ResolvedSystem[];
  version: string;
  title: string;
  lead: string;
  cta: string;
  ctaFor: string;
  /** The label over the file columns. */
  buildsTitle: string;
  fallback: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl">
      <DownloadHero
        systems={systems}
        version={version}
        title={title}
        lead={lead}
        cta={cta}
        ctaFor={ctaFor}
        fallback={fallback}
      />

      {/* Every file the release holds — what a reader on the wrong machine or
          with no JavaScript uses. Ink, so the columns read as the back of the
          block rather than as three more things to consider. */}
      <div className="bg-ink px-8 py-10 sm:px-12 sm:py-12">
        <h2 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-elev/40">
          {buildsTitle}
        </h2>

        {/* Hairlines, not gaps: the columns are one table on the ink, and the
            footer's rule is the site's precedent for a line drawn on it. */}
        <div className="mt-7 grid divide-y divide-elev/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {systems.map((system) => (
            <div
              key={system.os}
              className="py-6 first:pt-0 last:pb-0 sm:px-8 sm:py-0 sm:first:pl-0 sm:last:pr-0"
            >
              <div className="flex items-center gap-3">
                <IconChip icon={SYSTEM_ICON[system.os]} tone="paper" size="md" />
                <h3 className="text-lg font-bold text-elev">{system.name}</h3>
              </div>
              {/* Paper words, ember glyph: on the ink a link read as prose has
                  to clear 4.5:1 and the ember does not, so the ember stays the
                  mark beside it (design.md §Color). */}
              <ul className="mt-5 space-y-3">
                {system.builds.map((build) => (
                  <li key={build.url}>
                    <BuildLink build={build} os={system.os} version={version} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
