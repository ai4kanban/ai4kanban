import { FiGithub } from "react-icons/fi";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { GITHUB_URL } from "./content";
import { CompareMenu } from "./CompareMenu";
import { HeaderLanguage } from "./HeaderLanguage";
import { localeHref, localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The chrome on top of every page — the landing page, the comparison pages and
// the recipes.
export function Header({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;

  return (
    // Sticky from `sm` up only: on a phone the nav wraps to three rows, and
    // pinning that much chrome would take a third of the viewport.
    <header className="z-30 border-b-2 border-border bg-bg/85 backdrop-blur sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row">
        <a href={localePath(locale, "")} className="text-ink no-underline">
          <Logo size="sm" />
        </a>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.95rem] text-muted sm:gap-x-6">
          {/* The install section is on the landing page, so the link carries
              its path: from the landing page itself that is a same-document
              hash and still scrolls, and from anywhere else it goes home. */}
          <a
            href={localeHref(locale, "/#install")}
            className="transition-colors hover:text-ink"
          >
            {nav.install}
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
          <HeaderLanguage locale={locale} label={c.shared.language.label} />
          <Button href={GITHUB_URL} size="sm">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
            {nav.github}
          </Button>
        </nav>
      </div>
    </header>
  );
}
