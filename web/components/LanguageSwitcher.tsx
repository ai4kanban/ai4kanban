import { FiGlobe } from "react-icons/fi";
import {
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  TRANSLATED_PATHS,
  localePath,
  type Locale,
} from "@/lib/i18n";

// A visitor picks their language by hand — nothing here redirects by browser
// language. Each link goes to the same page in another language, labelled in
// that language's own name, so a reader recognises it without knowing English.
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
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted"
    >
      <FiGlobe className="h-3.5 w-3.5" aria-hidden="true" />
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-muted/40">
              ·
            </span>
          )}
          {l === locale ? (
            <span aria-current="true" className="font-semibold text-ink">
              {LOCALE_NAMES[l]}
            </span>
          ) : (
            <a
              href={localePath(l, path)}
              hrefLang={LOCALE_TAGS[l]}
              lang={LOCALE_TAGS[l]}
              className="text-muted hover:text-ink"
            >
              {LOCALE_NAMES[l]}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}
