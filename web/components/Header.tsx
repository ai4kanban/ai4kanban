import { FiChevronDown } from "react-icons/fi";
import { GITHUB_URL } from "./content";
import type { SiteCopy } from "@/i18n/types";
import { localeHref, type Locale } from "@/lib/i18n";

// The comparison pages this dropdown lists. Their titles are product names, so
// the only translated parts are the "Compare" label and the closing note.
const COMPARISONS = [
  { href: "/vs-github-issues", title: "vs GitHub Issues" },
  { href: "/vs-hermes-kanban", title: "vs Hermes Agent Kanban" },
  { href: "/vs-vibe-kanban", title: "vs Vibe Kanban" },
  { href: "/vs-linear", title: "vs Linear" },
];

function CompareMenu({ c, locale }: { c: SiteCopy; locale: Locale }) {
  return (
    <details className="group relative [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center gap-1 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        {c.shared.nav.compare}
        <FiChevronDown
          className="h-3 w-3 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="absolute left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border-2 border-border bg-elev p-1.5 shadow-[4px_4px_0_0_#010409]">
        {COMPARISONS.map((x) => (
          <a
            key={x.href}
            href={localeHref(locale, x.href)}
            className="block rounded-md px-3 py-2 text-[0.9rem] font-medium text-ink no-underline transition-colors hover:bg-accent/10"
          >
            {x.title}
          </a>
        ))}
        <p className="px-3 py-2 text-xs text-muted/70">
          {c.shared.nav.compareMore}
        </p>
      </div>
    </details>
  );
}

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
        <CompareMenu c={c} locale={locale} />
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
