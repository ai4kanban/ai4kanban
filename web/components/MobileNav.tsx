"use client";

import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import { Dropdown } from "./Dropdown";
import {
  LOCALE_NAMES,
  LOCALE_TAGS,
  localeHref,
  localePath,
  localesFor,
  publishedIn,
  stripLocale,
  type Locale,
} from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// The header's links on a phone, behind one button. Below `lg` this replaces
// the nav; GitHub and Download stay out in the row — see `Header.tsx`.
//
// The languages are listed flat under a heading rather than in their own menu:
// a menu inside a menu is a tap you can miss on a touch screen.
export function MobileNav({ c, locale }: { c: SiteCopy; locale: Locale }) {
  const nav = c.shared.nav;
  // Stay on the page being read; a page in English alone links the landing page.
  const base = stripLocale(usePathname() ?? "");
  const path = publishedIn(base, locale) ? base : "";
  const locales = localesFor(path);

  return (
    <Dropdown
      ariaLabel={nav.menu}
      align="right"
      width="w-60"
      chevron={false}
      summaryClass="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink transition-colors hover:bg-code"
      label={<FiMenu className="h-5 w-5" aria-hidden="true" />}
    >
      <a href="/docs" className={item}>
        {nav.docs}
      </a>
      {publishedIn("/pricing", locale) && (
        <a href={localeHref(locale, "/pricing")} className={item}>
          {nav.pricing}
        </a>
      )}
      <a href="/blog" className={item}>
        {nav.blog}
      </a>
      {publishedIn("/training", locale) && (
        <a href={localeHref(locale, "/training")} className={item}>
          {nav.training}
        </a>
      )}

      {locales.length > 1 && (
        <>
          <p className={heading}>{c.shared.language.label}</p>
          {locales.map((l) =>
            l === locale ? (
              <span
                key={l}
                aria-current="true"
                className={`${item} bg-code font-semibold`}
              >
                {LOCALE_NAMES[l]}
              </span>
            ) : (
              <a
                key={l}
                href={localePath(l, path)}
                hrefLang={LOCALE_TAGS[l]}
                lang={LOCALE_TAGS[l]}
                className={item}
              >
                {LOCALE_NAMES[l]}
              </a>
            ),
          )}
        </>
      )}
    </Dropdown>
  );
}

// A tap target a thumb can hit without aiming.
const item =
  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium " +
  "text-ink no-underline transition-colors hover:bg-code";

const heading =
  "mt-1 border-t-2 border-border px-3 pb-1 pt-3 font-mono text-[0.7rem] " +
  "font-semibold uppercase tracking-[0.18em] text-muted";
