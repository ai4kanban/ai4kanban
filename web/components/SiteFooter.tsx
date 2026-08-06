import { FaXTwitter } from "react-icons/fa6";
import { GITHUB_URL } from "./content";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

const X_URL = "https://x.com/tao_pmf";

// The footer under the landing page and the four comparison pages. `Footer.tsx`
// is the thin one the English-only recipes still use.
export function SiteFooter({
  c,
  locale,
  path,
}: {
  c: SiteCopy;
  locale: Locale;
  /** The route being viewed — what the language switcher jumps between. */
  path: string;
}) {
  const t = c.shared.footer;

  // Recipes are English-only, so that link keeps its bare path. The comparison
  // pages do exist in every language — point at one of them rather than an index
  // that isn't a route.
  const links = [
    { href: GITHUB_URL, label: t.github, external: true },
    { href: `${GITHUB_URL}/tree/main/docs`, label: t.docs, external: true },
    { href: "/recipes", label: t.recipes, external: false },
    {
      href: localePath(locale, "/vs-github-issues"),
      label: t.comparisons,
      external: false,
    },
  ];

  return (
    // The site's one dark band, and the only full-bleed block on it: the palette
    // inverted rather than a new color — the ink as the ground, the paper as the
    // type. It runs edge to edge so the page ends on a hard line instead of
    // trailing off, which is also what stops the page neutral from being the
    // last thing a long scroll leaves you with.
    <footer className="mt-28 overflow-hidden bg-ink text-sm text-elev/70">
      <div className="mx-auto max-w-5xl px-6 pt-12">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {links.map((l, i) => (
            <span key={l.href} className="flex items-center gap-3">
              {i > 0 && (
                <span aria-hidden="true" className="text-elev/30">
                  ·
                </span>
              )}
              <a
                href={l.href}
                rel={l.external ? "noopener" : undefined}
                className="text-elev/70 transition-colors hover:text-elev"
              >
                {l.label}
              </a>
            </span>
          ))}
          <span aria-hidden="true" className="text-elev/30">
            ·
          </span>
          <span>{t.license}</span>
        </p>
        <div className="text-center">
          <LanguageSwitcher
            locale={locale}
            path={path}
            label={c.shared.language.label}
          />
          {/* Only the X mark is the link — the name is plain text. */}
          <p className="mt-4 inline-flex items-center gap-2">
            {t.credit}
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.x}
              className="text-elev/70 transition-colors hover:text-elev"
            >
              <FaXTwitter className="h-3.5 w-3.5" />
            </a>
          </p>
        </div>
        {/* The wordmark is decoration, not a heading — the brand is already in
            the header and the page title. Its size is derived from the viewport
            so the nine pixel letters run the full width of the column at any
            width, up to the 145px that fills the 64rem column. The tight leading
            puts the baseline on the box edge, so the letters sit flush on the
            page bottom with no padding under them. On the ink it is the paper at
            a low alpha: at full strength nine letters this size stop being a
            texture and start being the loudest thing on the page. The face is
            subset to exactly these letters — see the @font-face in globals.css
            before changing the word. */}
        <div
          data-mark
          aria-hidden="true"
          className="mt-8 select-none whitespace-nowrap font-pixel text-[min(calc((100vw-3rem)/6.8),145px)] leading-[0.78] text-elev/15"
        >
          AI4KANBAN
        </div>
      </div>
    </footer>
  );
}
