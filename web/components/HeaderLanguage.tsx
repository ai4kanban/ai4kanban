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
          <FiGlobe className="h-4 w-4" aria-hidden="true" />
          {LOCALE_NAMES[locale]}
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
