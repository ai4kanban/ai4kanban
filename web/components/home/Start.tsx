import { SectionTitle } from "./SectionTitle";
import { PlatformCta } from "../PlatformCta";
import { Rich } from "../Rich";
import { Chip } from "../ui/Chip";
import { localeHref, type Locale } from "@/lib/i18n";
import type { ResolvedSystem } from "../download/builds";
import type { HomeCopy } from "@/i18n/home/types";

// Getting started (#177, #234). The app is the whole section: it carries `akb`
// and puts it on the PATH itself (#226), so a terminal install would be a
// second, worse way to the same board. One thing to press, and it is the same
// button the hero carries — the file for the reader's system, not a link on to
// another page.
//
// The skill is not here — a board runs without one. The retired
// `npx ai4kanban-ui` way isn't named here or anywhere else on the site — see
// `pages/DownloadPage.tsx`.

export function Start({
  c,
  locale,
  systems,
}: {
  c: HomeCopy["start"];
  locale: Locale;
  systems: ResolvedSystem[];
}) {
  return (
    // No top margin: this section sits in a `Band`, which owns its own air.
    <section id="install" className="scroll-mt-24">
      <SectionTitle num="04" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      <div
        data-reveal
        data-delay="2"
        className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4"
      >
        <PlatformCta
          systems={systems}
          label={c.cta}
          fallback={localeHref(locale, "/download")}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {c.notes.map((note) => (
            <Chip key={note}>{note}</Chip>
          ))}
        </div>
      </div>

      {/* What a Mac user runs into on the very first open, beside the step it
          happens on rather than at the bottom of a page they have already left:
          the app is unsigned, so failing to open it is the first thing that
          happens to them. */}
      <p
        data-reveal
        data-delay="3"
        className="mt-5 max-w-3xl text-[0.9rem] leading-relaxed text-muted"
      >
        <Rich>{c.firstOpen}</Rich>
      </p>

      {/* What the app brings with it, so a reader who wants a terminal knows
          they already have one after the download. A line, not a block: the
          command is a detail of the app, not a second way in. */}
      <p
        data-reveal
        data-delay="3"
        className="mt-4 max-w-3xl text-[0.9rem] leading-relaxed text-muted"
      >
        <Rich>{c.command}</Rich>
      </p>
    </section>
  );
}
