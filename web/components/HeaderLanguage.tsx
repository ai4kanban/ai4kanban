import { FiGlobe } from "react-icons/fi";
import { Dropdown } from "./Dropdown";
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  localePath,
  type Locale,
} from "@/lib/i18n";

// The footer switcher lists all five languages in a row; the header has no room
// for that, so it collapses into the same menu the header's comparisons list
// uses. Every link goes to the landing page in that language, not to the page
// being read — the footer's switcher is the path-aware one.
//
// One version at every width. On a phone it stays out in the header row rather
// than moving inside the menu button: the globe is what a reader who can't read
// the page looks for, and it shouldn't be two taps behind a hamburger. It keeps
// the language's own name there too — the glyph alone only says a language menu
// is here, and which one you are in is the half a switcher is actually asked.
export function HeaderLanguage({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  return (
    <Dropdown
      ariaLabel={label}
      align="right"
      width="w-40"
      label={
        <>
          <FiGlobe className="h-4 w-4 shrink-0" aria-hidden="true" />
          {/* Under 375px the name goes and the globe carries the control alone.
              The phone header is the logo, this, and two buttons in one row,
              and the longest name — `Français` — needs 375 to fit beside them.
              375 is the narrowest screen still sold; below it this is a floor,
              not a second design. */}
          <span className="max-[374px]:hidden">{LOCALE_NAMES[locale]}</span>
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
            href={localePath(l, "")}
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
