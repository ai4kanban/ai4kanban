import { FaXTwitter } from "react-icons/fa6";
import { GITHUB_URL } from "../content";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { pixel } from "@/fonts/pixel";
import { localePath, type Locale } from "@/lib/i18n";
import type { HomeCopy } from "@/i18n/types";

const X_URL = "https://x.com/tao_pmf";

export function HomeFooter({
  c,
  locale,
}: {
  c: HomeCopy["footer"];
  locale: Locale;
}) {
  // Recipes are English-only, so that link keeps its bare path. The comparison
  // pages do exist in every language — point at one of them rather than an index
  // that isn't a route.
  const links = [
    { href: GITHUB_URL, label: c.github, external: true },
    { href: `${GITHUB_URL}/tree/main/docs`, label: c.docs, external: true },
    { href: "/recipes", label: c.recipes, external: false },
    {
      href: localePath(locale, "/vs-github-issues"),
      label: c.comparisons,
      external: false,
    },
  ];

  return (
    <footer className="mx-auto mt-28 max-w-5xl overflow-hidden border-t border-border px-6 pt-8 text-sm text-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {links.map((l, i) => (
          <span key={l.href} className="flex items-center gap-3">
            {i > 0 && (
              <span aria-hidden="true" className="text-muted/40">
                ·
              </span>
            )}
            <a
              href={l.href}
              rel={l.external ? "noopener" : undefined}
              className="text-muted hover:text-ink"
            >
              {l.label}
            </a>
          </span>
        ))}
        <span aria-hidden="true" className="text-muted/40">
          ·
        </span>
        <span>{c.license}</span>
      </p>
      <div className="text-center">
        <LanguageSwitcher locale={locale} path="" label={c.language} />
        {/* Only the X mark is the link — the name is plain text. */}
        <p className="mt-4 inline-flex items-center gap-2 text-muted">
          {c.credit}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c.x}
            className="text-muted transition-colors hover:text-ink"
          >
            <FaXTwitter className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
      {/* The wordmark is decoration, not a heading — the brand is already in the
          header and the page title. Its size is derived from the viewport so the
          nine pixel letters run the full width of the column at any width, up to
          the 145px that fills the 64rem column. The tight leading puts the
          baseline on the box edge, so the letters sit flush on the page bottom
          with no padding under them. */}
      <div
        data-mark
        aria-hidden="true"
        className={`${pixel.className} mt-6 select-none whitespace-nowrap text-[min(calc((100vw-3rem)/6.8),145px)] leading-[0.78] text-ink`}
      >
        AI4KANBAN
      </div>
    </footer>
  );
}
