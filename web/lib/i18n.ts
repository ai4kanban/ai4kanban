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
 * Which languages each translated route is published in. The hreflang set,
 * `sitemap.ts`, both language switchers and `localeHref` all read this, so a
 * route is seen in a language when — and only when — it is listed here.
 *
 * Most routes are in all five: the landing page (`""`), the download page and
 * the comparisons. `/training` is the exception, and the reason this is a map
 * rather than the flat list it used to be — it is written and sold in English
 * and Chinese, and a Spanish reader must reach neither the page nor a link to
 * it. Everything unlisted (the recipes, the docs, the blog) is English-only.
 */
export const PATH_LOCALES: Record<string, readonly Locale[]> = {
  "": LOCALES,
  "/download": LOCALES,
  "/vs-github-issues": LOCALES,
  "/vs-hermes-kanban": LOCALES,
  "/vs-vibe-kanban": LOCALES,
  "/vs-linear": LOCALES,
  "/vs-multica": LOCALES,
  "/vs-task-master": LOCALES,
  "/training": ["en", "zh"],
};

/** Every route that exists in more than one language. */
export const TRANSLATED_PATHS = Object.keys(PATH_LOCALES);

/** The languages a route is published in, or none when it is English-only. */
export function localesFor(path: string): readonly Locale[] {
  return PATH_LOCALES[path] ?? [];
}

/** Whether this exact route exists in this language. What decides if a nav link
 *  is drawn at all: on a page we do not publish in Spanish, a Spanish reader is
 *  not offered the English one instead. */
export function publishedIn(path: string, locale: Locale): boolean {
  return localesFor(path).includes(locale);
}

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
 * The language-free route behind a URL: `/zh/download` and `/download` both give
 * `"/download"`, and any landing page gives `""`. The result is only a
 * `TranslatedPath` when the route exists in every language — a caller switching
 * languages has to fall back to `""` for anything else.
 */
export function stripLocale(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  const [first = "", ...rest] = trimmed.split("/").slice(1);
  if (!isTranslatedLocale(first)) return trimmed;
  return rest.length ? `/${rest.join("/")}` : "";
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
  // Only the routes listed above exist per language; anything else (recipes,
  // the Markdown mirrors) stays on its English URL. A route that exists in some
  // languages and not this one stays English too — the caller that must not
  // show it at all asks `publishedIn` first.
  if (!publishedIn(base, locale)) return href;
  return `${localePath(locale, base)}${fragment}`;
}

/**
 * The `alternates.languages` map for a route: each language the route is
 * published in, plus `x-default` → the English URL, so search engines have a
 * defined fallback for a reader whose language we don't publish.
 *
 * Only the languages that route really has. An hreflang set is a promise that
 * every URL in it resolves, and `/es/training` does not exist to resolve to.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of localesFor(path)) {
    languages[LOCALE_TAGS[locale]] = localePath(locale, path);
  }
  languages["x-default"] = localePath("en", path);
  return languages;
}
