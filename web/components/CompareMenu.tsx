import { Dropdown } from "./Dropdown";
import { localeHref, type Locale } from "@/lib/i18n";

// The comparison pages this dropdown lists. Their titles are product names, so
// the only translated parts are the "Compare" label and the closing note.
const COMPARISONS = [
  { href: "/vs-github-issues", title: "vs GitHub Issues" },
  { href: "/vs-hermes-kanban", title: "vs Hermes Agent Kanban" },
  { href: "/vs-vibe-kanban", title: "vs Vibe Kanban" },
  { href: "/vs-linear", title: "vs Linear" },
];

/** Shared by the site header and the landing page's own header. */
export function CompareMenu({
  label,
  moreLabel,
  locale,
}: {
  label: string;
  moreLabel: string;
  locale: Locale;
}) {
  return (
    <Dropdown label={label} width="w-64">
      {COMPARISONS.map((x) => (
        <a
          key={x.href}
          href={localeHref(locale, x.href)}
          className="block rounded-md px-3 py-2 text-[0.9rem] font-medium text-ink no-underline transition-colors hover:bg-accent/10"
        >
          {x.title}
        </a>
      ))}
      <p className="px-3 py-2 text-xs text-muted/70">{moreLabel}</p>
    </Dropdown>
  );
}
