import { COMPARISONS } from "./CompareMenu";
import { GITHUB_URL } from "./content";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BUILDER_PATH, FOOTER_SOCIALS } from "./social";
import { column } from "./styles";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The footer under every page on the site.
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

  // Grouped by what a visitor came for: get it, learn it, look behind it, read
  // the fine print, weigh it against what they use now. The comparisons are
  // named one per line rather than folded behind a single link — six product
  // names is what fills the row, and each is a page worth landing on. GitHub is
  // not a column: it is the mark on the base line, and one link is enough.
  //
  // The docs, the recipes, the blog, the Cloud page, the builder page and the
  // two legal pages are English-only, so those links keep their bare paths. The
  // download and comparison pages exist in every language — point at this one.
  const groups = [
    {
      title: t.groups.product,
      links: [
        { href: localePath(locale, "/download"), label: c.shared.nav.download },
        { href: "/cloud", label: t.cloud },
      ],
    },
    {
      title: t.groups.learn,
      links: [
        { href: "/docs", label: t.docs },
        { href: "/recipes", label: t.recipes },
        { href: "/blog", label: t.blog },
      ],
    },
    {
      title: t.groups.project,
      links: [
        { href: BUILDER_PATH, label: t.builder },
        { href: `${GITHUB_URL}/releases`, label: t.changelog, external: true },
      ],
    },
    {
      title: t.groups.legal,
      links: [
        { href: "/privacy", label: t.privacy },
        { href: "/terms", label: t.terms },
      ],
    },
    // Last, and six deep — a grid row is as tall as its tallest column, so the
    // one long list sits where it can't open a hole under the short ones.
    {
      // The header's word for the same list, so one label is translated once.
      title: c.shared.nav.compare,
      links: COMPARISONS.map((x) => ({
        href: localePath(locale, x.href),
        label: x.name,
      })),
    },
  ];

  // The icons carry no text, so each one needs its name read out loud.
  const socialAria: Record<string, string> = { GitHub: t.github, X: t.x };

  return (
    // The site's one dark band, and the only full-bleed block on it: the palette
    // inverted rather than a new color — the ink as the ground, the paper as the
    // type. It runs edge to edge so the page ends on a hard line instead of
    // trailing off, which is also what stops the page neutral from being the
    // last thing a long scroll leaves you with.
    <footer className="mt-28 overflow-hidden bg-ink text-sm text-elev/70">
      <div className={`${column} pt-14`}>
        <nav className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-elev/40">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      rel={l.external ? "noopener" : undefined}
                      className="transition-colors hover:text-elev"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* The base line: who made it, where to find them, what language you're
            reading. The hairline is the only rule on the ink — it separates the
            columns from the line that closes them without adding a second
            colour. */}
        <div className="mt-12 flex flex-col items-start gap-5 border-t border-elev/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <a href={BUILDER_PATH} className="transition-colors hover:text-elev">
            {t.credit}
          </a>
          <div className="flex items-center gap-4">
            <ul className="flex items-center gap-4">
              {FOOTER_SOCIALS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={socialAria[label] ?? label}
                    className="block transition-colors hover:text-elev"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <LanguageSwitcher
              locale={locale}
              path={path}
              label={c.shared.language.label}
            />
          </div>
        </div>

        {/* The wordmark is decoration, not a heading — the brand is already in
            the header and the page title. Its size is derived from the viewport
            so the nine pixel letters run the full width of the column at any
            width, up to the 162px that fills the 72rem column. The tight leading
            puts the baseline on the box edge, so the letters sit flush on the
            page bottom with no padding under them. On the ink it is the paper at
            a low alpha: at full strength nine letters this size stop being a
            texture and start being the loudest thing on the page. The face is
            subset to exactly these letters — see the @font-face in globals.css
            before changing the word. */}
        <div
          data-mark
          aria-hidden="true"
          className="mt-2 select-none whitespace-nowrap font-pixel text-[min(calc((100vw-3rem)/6.8),162px)] leading-[0.78] text-elev/15"
        >
          AI4KANBAN
        </div>
      </div>
    </footer>
  );
}
