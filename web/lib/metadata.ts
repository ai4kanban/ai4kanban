// Page metadata, written once per page.
//
// Every page used to repeat its title and description up to five times — the
// `<title>`, the meta description, the OpenGraph pair, the Twitter pair, and
// again in the page's JSON-LD. `pageMetadata` builds the tag side from one set
// of strings; the page hands those same strings to `lib/schema.ts` so the
// structured data can't drift from what the tags say.
//
// It also wires the language alternates: every page links to its siblings in
// the other four languages plus an `x-default` pointing at the English URL.
import type { Metadata } from "next";
import { OG_IMAGE } from "./site";
import {
  LOCALES,
  LOCALE_TAGS,
  languageAlternates,
  localePath,
  type Locale,
} from "./i18n";
import type { PageMeta } from "@/i18n/types";

// OpenGraph wants underscored territory tags, not the BCP 47 hyphen form.
const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  zh: "zh_CN",
  es: "es_ES",
  ja: "ja_JP",
  fr: "fr_FR",
};

export function pageMetadata({
  locale,
  path,
  title,
  description,
  socialTitle,
  social,
  type = "website",
}: PageMeta & {
  locale: Locale;
  /** Route path, e.g. "/vs-github-issues". Empty string for the home page. */
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = localePath(locale, path);
  const ogTitle = socialTitle ?? title;
  const ogDescription = social ?? description;

  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type,
      url,
      siteName: "AI4Kanban",
      title: ogTitle,
      description: ogDescription,
      images: [OG_IMAGE],
      locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map(
        (l) => OG_LOCALES[l],
      ),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [OG_IMAGE.url],
    },
  };
}

/** The `<html lang>` value for a locale. */
export function htmlLang(locale: Locale): string {
  return LOCALE_TAGS[locale];
}

// The icon set, spread into both root layouts so every page in every language
// declares the same one. It replaced `app/icon.png` and its siblings: the file
// convention only takes one image per role, and a tab, a pinned tab, a Windows
// shortcut and an iOS home screen each want a different file — so the set is
// declared here instead, and `app/` holds no icons at all.
//
// All of it is the mark from `components/ui/Logo.tsx`, exported from
// `public/logo-mark.svg`. Every path is site-root, which is also what
// `site.webmanifest` assumes internally.
//
//   favicon.svg          the tab wherever SVG is taken — it scales, so it is
//                        the one file that is right at every size
//   favicon-96x96.png    the tab everywhere else
//   favicon.ico          the fallback: old browsers, and the Windows shortcut,
//                        which reads the .ico and nothing else
//   apple-touch-icon     180×180, the iOS home screen
export const siteIcons: Pick<Metadata, "icons" | "manifest" | "appleWebApp"> = {
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
  // Names the icon on an iOS home screen. Without it iOS uses the page title,
  // which is the full SEO sentence and gets truncated to nonsense.
  appleWebApp: { title: "AI4Kanban" },
};
