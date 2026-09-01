import { FiGlobe } from "react-icons/fi";
import { Dropdown } from "./Dropdown";
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  TRANSLATED_PATHS,
  localePath,
  type Locale,
} from "@/lib/i18n";

// The footer's language menu. Same control as the header's, with one difference:
// each link goes to the page being read, not to the landing page.
//
// A visitor picks their language by hand — nothing here redirects by browser
// language. Each language is labelled in its own name, so a reader recognises it
// without knowing English.
//
// Pages that only exist in English (the recipes) get no switcher: there'd be
// nowhere for the links to go.
export function LanguageSwitcher({
  locale,
  path,
  label,
}: {
  locale: Locale;
  /** The route being viewed, e.g. "" or "/vs-vibe-kanban". */
  path: string;
  label: string;
}) {
  if (!(TRANSLATED_PATHS as readonly string[]).includes(path)) return null;

  return (
    <Dropdown
      ariaLabel={label}
      align="right"
      // Down is off the page here, and the footer clips what runs past it.
      drop="up"
      width="w-40"
      summaryClass="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-elev"
      label={
        <>
          <FiGlobe className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{LOCALE_NAMES[locale]}</span>
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
