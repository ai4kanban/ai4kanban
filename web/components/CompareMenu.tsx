import { Dropdown } from "./Dropdown";
import { localeHref, type Locale } from "@/lib/i18n";

// The comparison pages this dropdown lists. Their titles are product names, so
// the only translated part is the "Compare" label. `MobileNav.tsx` lists the same
// ones inline, because a menu inside a menu is not a thing on a phone.
export const COMPARISONS = [
  { href: "/vs-task-master", title: "vs Task Master" },
  { href: "/vs-github-issues", title: "vs GitHub Issues" },
  { href: "/vs-hermes-kanban", title: "vs Hermes Agent Kanban" },
  { href: "/vs-vibe-kanban", title: "vs Vibe Kanban" },
  { href: "/vs-linear", title: "vs Linear" },
  { href: "/vs-multica", title: "vs Multica" },
];

/** Shared by the site header and the landing page's own header. */
export function CompareMenu({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  return (
    <Dropdown label={label} width="w-64">
      {COMPARISONS.map((x) => (
        <a
          key={x.href}
          href={localeHref(locale, x.href)}
          className="block rounded-lg px-3 py-2 text-[0.9rem] font-medium text-ink no-underline transition-colors hover:bg-code"
        >
          {x.title}
        </a>
      ))}
    </Dropdown>
  );
}
