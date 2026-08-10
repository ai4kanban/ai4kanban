import { FiGithub } from "react-icons/fi";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { GITHUB_URL } from "./content";
import { CompareMenu } from "./CompareMenu";
import { HeaderLanguage } from "./HeaderLanguage";
import { MobileNav } from "./MobileNav";
import { localeHref, localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The chrome on top of every page — the landing page, the comparison pages and
// the recipes.
export function Header({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;

  return (
    // Sticky at every width — one row of chrome is cheap to pin, and on a phone
    // the nav is behind `MobileNav` so it stays one row. `sticky` is also what
    // makes the menus land on top of the page: only a positioned block gets a
    // z-index, so without it an open dropdown went behind the hero headline no
    // matter what `z-30` asked for.
    //
    // The band is paper, one step up the ramp from the page it is laid on, and
    // opaque: the hero's azure wash starts at this rule, and a translucent
    // header took a blue cast off it as the page scrolled under.
    <header className="sticky top-0 z-30 border-b-2 border-border bg-elev">
      {/* Same `py-3` at every width, so the row a phone gets and the row a
          desktop gets are the same height — the wide nav swaps items in, it
          doesn't make the chrome taller. */}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <a href={localePath(locale, "")} className="text-ink no-underline">
          <Logo size="sm" />
        </a>

        {/* The phone header. Two things stay out in the row and the links go
            behind the menu button: the language switcher, which a reader who
            can't read the page needs to find without opening anything, and
            GitHub, which is the page's one call to action and so is the same
            block here as it is wide — just with the label dropped, since the
            mark is the name.

            The swap is at `md`, not `sm`, because `sm` is where the wide nav
            first fits and nothing more — at 640px the five items and the button
            fill the row edge to edge, and one longer word (fr: "Installation",
            "Comparatifs") breaks it. */}
        <div className="flex items-center gap-2.5 text-[0.95rem] text-muted md:hidden">
          <HeaderLanguage locale={locale} label={c.shared.language.label} />
          {/* The footer's plain "GitHub", not the nav's — the nav string carries
              a ↗ that a screen reader reads out as an arrow. */}
          <Button
            href={GITHUB_URL}
            size="icon"
            aria-label={c.shared.footer.github}
          >
            <FiGithub className="h-4 w-4" aria-hidden="true" />
          </Button>
          <MobileNav c={c} locale={locale} />
        </div>

        <nav className="hidden items-center justify-center gap-x-5 text-[0.95rem] text-muted md:flex md:gap-x-6">
          {/* The install section is on the landing page, so the link carries
              its path: from the landing page itself that is a same-document
              hash and still scrolls, and from anywhere else it goes home. */}
          <a
            href={localeHref(locale, "/#install")}
            className="transition-colors hover:text-ink"
          >
            {nav.install}
          </a>
          {/* The board app. It gets a nav slot of its own because it is the
              one thing on the site a reader leaves with. */}
          <a
            href={localeHref(locale, "/download")}
            className="transition-colors hover:text-ink"
          >
            {nav.download}
          </a>
          {/* Recipes are English-only, so this link never takes a locale prefix. */}
          <a href="/recipes" className="transition-colors hover:text-ink">
            {nav.recipes}
          </a>
          <CompareMenu label={nav.compare} locale={locale} />
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
