import { FiGithub } from "react-icons/fi";
import { Button } from "./Button";
import { GITHUB_URL } from "../content";
import { CompareMenu } from "../CompareMenu";
import { HeaderLanguage } from "./HeaderLanguage";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The landing page's nav mixes its own install anchor with the site-wide
// recipes and comparison links, so it doesn't share `components/Header.tsx`
// (which points every link at the comparison pages' section set).
export function HomeHeader({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const header = c.home.header;
  const nav = c.shared.nav;

  return (
    // Sticky from `sm` up only: on a phone the nav wraps to three rows, and
    // pinning that much chrome would take a third of the viewport.
    <header className="z-30 border-b border-border/60 bg-bg/85 backdrop-blur sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row">
        <a
          href={localePath(locale, "")}
          className="text-lg font-bold text-ink no-underline"
        >
          {header.brand}
        </a>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.95rem] text-muted sm:gap-x-6">
          <a href="#install" className="transition-colors hover:text-ink">
            {header.nav.install}
          </a>
          {/* Recipes are English-only, so this link never takes a locale prefix. */}
          <a href="/recipes" className="transition-colors hover:text-ink">
            {nav.recipes}
          </a>
          <CompareMenu
            label={nav.compare}
            moreLabel={nav.compareMore}
            locale={locale}
          />
          {/* The switcher's label lives with the footer copy, which also uses it. */}
          <HeaderLanguage locale={locale} label={c.home.footer.language} />
          <Button href={GITHUB_URL} size="sm">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
            {header.github}
          </Button>
        </nav>
      </div>
    </header>
  );
}
