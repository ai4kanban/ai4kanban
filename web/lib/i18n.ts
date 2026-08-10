// The site's languages and the URL shape that carries them.
//
// `output: export` rules out Next's built-in locale routing (that needs a
// server), so each language is a plain path prefix instead: /zh, /es, /ja, /fr.
// English keeps the bare paths it always had — no existing URL changes.

/** The four translated languages. English is the source and lives at the root. */
export const TRANSLATED_LOCALES = ["zh", "es", "ja", "fr"] as const;

export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];
export type Locale = "en" | TranslatedLocale;

export const LOCALES: readonly Locale[] = ["en", ...TRANSLATED_LOCALES];

/** Each language written in its own name — what the switcher shows. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  ja: "日本語",
  fr: "Français",
};

/**
 * BCP 47 tags for `<html lang>` and `hreflang`. Chinese is tagged by script
 * (`zh-Hans`) because the copy is Simplified — a bare `zh` would also claim the
 * Traditional readers we don't serve.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  zh: "zh-Hans",
  es: "es",
  ja: "ja",
  fr: "fr",
};

/**
 * The routes that exist in every language: the landing page (`""`) and the
 * comparison pages. Recipes stay English-only. This list is what the hreflang
 * set, `sitemap.ts`, and the language switcher all read, so a new translated
 * route has to be added here to be seen.
 */
export const TRANSLATED_PATHS = [
  "",
  "/download",
  "/vs-github-issues",
  "/vs-hermes-kanban",
  "/vs-vibe-kanban",
  "/vs-linear",
  "/vs-multica",
  "/vs-task-master",
] as const;

export type TranslatedPath = (typeof TRANSLATED_PATHS)[number];

export function isTranslatedLocale(value: string): value is TranslatedLocale {
  return (TRANSLATED_LOCALES as readonly string[]).includes(value);
}

/**
 * Route for `path` in `locale`. English is unprefixed, so `("en", "")` is `/`
 * and `("zh", "/vs-vibe-kanban")` is `/zh/vs-vibe-kanban`.
 */
export function localePath(locale: Locale, path: string): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${prefix}${path}` || "/";
}

/**
 * Rewrite an in-site link for the current language. Hash-only and external
 * links pass through untouched; `/#install` becomes `/zh/#install`.
 */
export function localeHref(locale: Locale, href: string): string {
  if (locale === "en") return href;
  if (!href.startsWith("/")) return href;
  const hash = href.indexOf("#");
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? "" : href.slice(hash);
  const base = path === "/" ? "" : path;
  // Only the translated routes listed above exist per language; anything else
  // (recipes, the Markdown mirrors) stays on its English URL.
  if (!(TRANSLATED_PATHS as readonly string[]).includes(base)) return href;
  return `${localePath(locale, base)}${fragment}`;
}

/**
 * The `alternates.languages` map for a route: every language's copy of the page
 * plus `x-default` → the English URL, so search engines have a defined fallback
 * for a reader whose language we don't publish.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[LOCALE_TAGS[locale]] = localePath(locale, path);
  }
  languages["x-default"] = localePath("en", path);
  return languages;
}
