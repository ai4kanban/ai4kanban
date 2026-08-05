import { GITHUB_URL } from "./content";
import { CompareMenu } from "./CompareMenu";
import type { SiteCopy } from "@/i18n/types";
import { localeHref, type Locale } from "@/lib/i18n";

export function Header({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;
  const links = [
    { href: "/#install", label: nav.install },
    { href: "/#board", label: nav.usage },
    { href: "/#ui", label: nav.boardUi },
    { href: "/#deeper", label: nav.features },
  ];

  return (
    <header className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-6 py-5 sm:flex-row">
      <a
        href={localeHref(locale, "/")}
        className="text-lg font-bold text-ink no-underline"
      >
        🗂️ AI4Kanban
      </a>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.95rem] text-muted">
        {links.map((l) => (
          <a
            key={l.href}
            href={localeHref(locale, l.href)}
            className="transition-colors hover:text-ink"
          >
            {l.label}
          </a>
        ))}
        {/* Recipes are English-only, so this link never takes a locale prefix. */}
        <a href="/recipes" className="transition-colors hover:text-ink">
          {nav.recipes}
        </a>
        <CompareMenu
          label={nav.compare}
          moreLabel={nav.compareMore}
          locale={locale}
        />
        <a
          href={GITHUB_URL}
          rel="noopener"
          className="transition-colors hover:text-ink"
        >
          {nav.github}
        </a>
      </nav>
    </header>
  );
}
