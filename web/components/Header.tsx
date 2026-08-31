"use client";

import { useEffect, useState } from "react";
import { FiGithub } from "react-icons/fi";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { GITHUB_URL } from "./content";
import { CompareMenu } from "./CompareMenu";
import { HeaderLanguage } from "./HeaderLanguage";
import { MobileNav } from "./MobileNav";
import { localeHref, localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// Whether the page has moved at all. The header only draws itself once it has —
// see the comment on the band below. A few pixels rather than 0, so a browser
// restoring a scroll position of 1px doesn't open the page with a rule on it.
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrolled;
}

// The chrome on top of every page — the landing page, the comparison pages and
// the recipes.
export function Header({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;
  const scrolled = useScrolled();

  return (
    // Sticky at every width — one row of chrome is cheap to pin, and on a phone
    // the nav is behind `MobileNav` so it stays one row. `sticky` is also what
    // makes the menus land on top of the page: only a positioned block gets a
    // z-index, so without it an open dropdown went behind the hero headline no
    // matter what `z-30` asked for.
    //
    // The fill is always paper and never animates: it is the same white as the
    // page ground, so at the top of the page the row still reads as the first
    // line of the hero, and the moment anything slides under it there is no
    // frame of half-transparent header for that content to show through.
    //
    // Only the rule fades in. The rule is what a header is *for* — it says the
    // row is floating over content that has gone under it — so it arrives only
    // once something has. It is transparent rather than absent at the top: a
    // border changes a box's height, and the row must not jump 2px the moment
    // you scroll.
    <header
      className={`sticky top-0 z-30 border-b-2 bg-elev transition-colors duration-200 ${
        scrolled ? "border-border" : "border-transparent"
      }`}
    >
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

            The swap is at `lg`, not `sm` or `md`. `sm` is where the wide nav
            first fits and nothing more — at 640px five items and the button fill
            the row edge to edge, and one longer word (fr: "Installation",
            "Comparatifs") breaks it. `md` held six; Docs is the seventh, which
            is the width `md` no longer has at any gap. */}
        <div className="flex items-center gap-2.5 text-[0.95rem] text-muted lg:hidden">
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

        {/* The gap is tighter between `lg` and `xl` than above it. At 1024 the
            row is seven items and a button, and French is the longest set of
            words in it — "Télécharger", "Comparatifs", "Français". Sixteen
            pixels there buys forty back and reads the same at that width; the
            full gap returns at `xl`, where there is room for it. */}
        <nav className="hidden items-center justify-center text-[0.95rem] text-muted lg:flex lg:gap-x-4 xl:gap-x-6">
          {/* The one way in. The landing page also hands out the setup prompt,
              under `#install`, but the header names a single way to get the
              product — two of them in one row is a choice a reader has to make
              before they know what either one is. The prompt is a section on a
              page you are already reading; this is the page you leave with. */}
          <a
            href={localeHref(locale, "/download")}
            className="transition-colors hover:text-ink"
          >
            {nav.download}
          </a>
          {/* The docs, the recipes and the blog are English-only, so none of
              these links ever takes a locale prefix. */}
          <a href="/docs" className="transition-colors hover:text-ink">
            {nav.docs}
          </a>
          <a href="/recipes" className="transition-colors hover:text-ink">
            {nav.recipes}
          </a>
          <a href="/blog" className="transition-colors hover:text-ink">
            {nav.blog}
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
