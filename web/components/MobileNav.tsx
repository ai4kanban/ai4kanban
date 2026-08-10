import { FiMenu } from "react-icons/fi";
import { Dropdown } from "./Dropdown";
import { buttonClass } from "./ui/Button";
import { COMPARISONS } from "./CompareMenu";
import { localeHref, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The header's links on a phone, behind one button, so the chrome stays a
// single row instead of the three it wrapped to. Below `md` this replaces the
// nav; from `md` up the nav is back and this is gone. The language switcher and
// the GitHub button stay out in the row — see `Header.tsx`.
//
// The comparisons are listed flat under a heading rather than nested in
// `CompareMenu` — a menu that opens a menu is a tap you can miss on a touch
// screen, and the list is only a handful of lines.
export function MobileNav({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;

  return (
    <Dropdown
      ariaLabel={nav.menu}
      align="right"
      width="w-60"
      chevron={false}
      // The same block as the GitHub button it stands next to — two icons that
      // do the same job in the same row can't be a framed one and a bare one.
      summaryClass={`${buttonClass("secondary", "icon")} cursor-pointer`}
      label={<FiMenu className="h-4 w-4" aria-hidden="true" />}
    >
      {/* Same two links, same paths, as the wide nav — see `Header.tsx` for why
          install carries a path and recipes never carries a locale. */}
      <a href={localeHref(locale, "/#install")} className={item}>
        {nav.install}
      </a>
      <a href="/recipes" className={item}>
        {nav.recipes}
      </a>

      <p className={heading}>{nav.compare}</p>
      {COMPARISONS.map((x) => (
        <a key={x.href} href={localeHref(locale, x.href)} className={item}>
          {x.title}
        </a>
      ))}
    </Dropdown>
  );
}

// Every row is the same tap target the other menus use, at a height a thumb can
// hit without aiming.
const item =
  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium " +
  "text-ink no-underline transition-colors hover:bg-code";

const heading =
  "mt-1 border-t-2 border-border px-3 pb-1 pt-3 font-mono text-[0.7rem] " +
  "font-semibold uppercase tracking-[0.18em] text-muted";
