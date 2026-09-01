"use client";

import { usePathname } from "next/navigation";
import { FiGlobe } from "react-icons/fi";
import { Dropdown } from "./Dropdown";
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  TRANSLATED_PATHS,
  localePath,
  stripLocale,
  type Locale,
} from "@/lib/i18n";

// The same menu the header's comparisons list uses. Every link stays on the page
// being read and only changes its language; from a page that exists in English
// alone (the docs, the blog, the recipes) there is nowhere to stay, so the links
// go to the landing page.
//
// One version at every width. On a phone it stays out in the header row rather
// than moving inside the menu button: the globe is what a reader who can't read
// the page looks for, and it shouldn't be two taps behind a hamburger.
//
// The name only rides along from `md` up. On a phone the row is the wordmark and
// three controls, and a word as wide as "Français" beside them left the header
// reading as a wall of text with nothing dominant in it. The glyph goes alone
// there, like the GitHub control beside it does — the menu it opens names the
// current language anyway, one tap in.
export function HeaderLanguage({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const base = stripLocale(usePathname() ?? "");
  const path = (TRANSLATED_PATHS as readonly string[]).includes(base) ? base : "";

  return (
    <Dropdown
      ariaLabel={label}
      align="right"
      width="w-40"
      label={
        <>
          {/* A step larger where it stands alone: unframed beside two bordered
              buttons, a 16px glyph read as a stray mark rather than a control. */}
          <FiGlobe className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          <span className="hidden md:inline">{LOCALE_NAMES[locale]}</span>
        </>
      }
    >
      {LOCALES.map((l) =>
        l === locale ? (
          <span
            key={l}
            aria-current="true"
            className="block rounded-lg bg-code px-3 py-2 text-[0.9rem] font-semibold text-ink"
          >
            {LOCALE_NAMES[l]}
          </span>
        ) : (
          <a
            key={l}
            href={localePath(l, path)}
            hrefLang={LOCALE_TAGS[l]}
            lang={LOCALE_TAGS[l]}
            className="block rounded-lg px-3 py-2 text-[0.9rem] font-medium text-muted no-underline transition-colors hover:bg-code hover:text-ink"
          >
            {LOCALE_NAMES[l]}
          </a>
        ),
      )}
    </Dropdown>
  );
}
