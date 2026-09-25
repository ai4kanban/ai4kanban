import { COMPARISONS } from "./CompareMenu";
import { GITHUB_URL } from "./content";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BUILDER_PATH, FOOTER_SOCIALS } from "./social";
import { column } from "./styles";
import { agentPath, getAgentPages } from "@/lib/agents";
import { localePath, publishedIn, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// AI4Kanban's pages in the two directories that list it. Both badges are served
// from `public/` rather than the directory: the other product marks on the site
// are local too, and a self-hosted SVG cannot slow the page down or fail to
// draw. The VerifiedDR link is the hyphen spelling — the dot spelling written
// inside its own SVG 404s, which is also why that file is drawn through an
// `<img>` and never inlined.
const LAUNCHKIWI_URL =
  "https://launchkiwi.com/p/ai-project-manager-for-coding-agents";
const VERIFIEDDR_URL = "https://verifieddr.com/website/ai4kanban-dev";

// The footer under every page on the site.
export function SiteFooter({
  c,
  locale,
  path,
  listings = false,
}: {
  c: SiteCopy;
  locale: Locale;
  /** The route being viewed — what the language switcher jumps between. */
  path: string;
  /** Show the directory listing badges. The landing page asks for them and no
   *  other page does — a directory badge belongs where a visitor arrives. */
  listings?: boolean;
}) {
  const t = c.shared.footer;

  // Grouped by what a visitor came for: get it, learn it, look behind it, read
  // the fine print, weigh it against what they use now. The comparisons are
  // named one per line rather than folded behind a single link — six product
  // names is what fills the row, and each is a page worth landing on. GitHub is
  // not a column: it is the mark on the base line, and one link is enough.
  //
  // The docs, the recipes, the blog, the agent pages, the Cloud page, the
  // builder page and the two legal pages are English-only, so those links keep
  // their bare paths. The download and comparison pages exist in every
  // language — point at this one.
  const groups = [
    {
      title: t.groups.product,
      links: [
        { href: localePath(locale, "/download"), label: c.shared.nav.download },
        { href: "/cloud", label: t.cloud },
        // Two languages only, so in the other three the row is absent rather
        // than pointing at a page that reader cannot use.
        ...(publishedIn("/pricing", locale)
          ? [{ href: localePath(locale, "/pricing"), label: t.pricing }]
          : []),
        ...(publishedIn("/training", locale)
          ? [{ href: localePath(locale, "/training"), label: t.training }]
          : []),
        { href: localePath(locale, "/contact"), label: t.contact },
      ],
    },
    {
      title: t.groups.learn,
      links: [
        { href: "/docs", label: t.docs },
        { href: "/recipes", label: t.recipes },
        { href: "/blog", label: t.blog },
        // Agent pages name a coding agent, so the label is the page's own name
        // rather than a translated slot — the same rule the comparisons follow.
        ...getAgentPages().map((page) => ({
          href: agentPath(page),
          label: page.navLabel,
        })),
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
        <div className="mt-12 flex flex-col items-start gap-5 border-t border-elev/10 py-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <a href={BUILDER_PATH} className="transition-colors hover:text-elev">
              {t.credit}
            </a>
            {/* A third-party listing belongs beside the credit, not above the
                columns: it is the smallest claim on the page. The two marks are
                one group — a tighter gap between them than the gap to the
                credit, and they wrap together when the line runs out. Both are
                pale cards, so on the ink they rest at the same alpha as the
                footer's own type and come up on hover; full strength would make
                them the brightest blocks down here. Heights are set and
                intrinsic sizes declared, so the row never jumps once the files
                land, and a phone drops both a step so the pair still holds one
                line at 360px. */}
            {listings && (
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <a
                  href={LAUNCHKIWI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block opacity-70 transition-opacity hover:opacity-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/launchkiwi-badge.svg"
                    alt={t.launchkiwi}
                    width={198}
                    height={62}
                    loading="lazy"
                    className="block h-10 w-auto sm:h-12"
                  />
                </a>
                <a
                  href={VERIFIEDDR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block opacity-70 transition-opacity hover:opacity-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://verifieddr.com/badge/ai4kanban-dev.svg?metric=truedr"
                    alt={t.verifieddr}
                    width={238}
                    height={68}
                    loading="lazy"
                    className="block h-10 w-auto sm:h-12"
                  />
                </a>
              </div>
            )}
          </div>
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
