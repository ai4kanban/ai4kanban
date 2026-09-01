import { Dropdown } from "./Dropdown";
import { localeHref, type Locale } from "@/lib/i18n";

// The comparison pages this dropdown lists. The names are products, so the only
// translated part is the "Compare" label. `MobileNav.tsx` lists the same ones
// inline, because a menu inside a menu is not a thing on a phone, and
// `SiteFooter.tsx` lists them under a heading that already says what they are —
// which is why the "vs" belongs to the caller and not to the name.
export const COMPARISONS = [
  { href: "/vs-task-master", name: "Task Master" },
  { href: "/vs-github-issues", name: "GitHub Issues" },
  { href: "/vs-hermes-kanban", name: "Hermes Agent Kanban" },
  { href: "/vs-vibe-kanban", name: "Vibe Kanban" },
  { href: "/vs-linear", name: "Linear" },
  { href: "/vs-multica", name: "Multica" },
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
          vs {x.name}
        </a>
      ))}
    </Dropdown>
  );
}
