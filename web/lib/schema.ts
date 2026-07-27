// Shared Schema.org nodes for the site's JSON-LD.
//
// Every page ships exactly one <script type="application/ld+json"> holding an
// `@graph`, so entities cross-reference by `@id` instead of being repeated.
// `@id` values are fragment URIs anchored to a canonical URL, which keeps them
// stable and unique site-wide. `organization` and `website` are defined in full
// on every page, so no reference is ever left dangling.
import { BASE_URL, OG_IMAGE } from "./site";
import { GITHUB_URL } from "@/components/content";

export const ORG_ID = `${BASE_URL}/#organization`;
export const SITE_ID = `${BASE_URL}/#website`;
export const APP_ID = `${BASE_URL}/#software`;

// Google wants a logo of at least 112×112, uncropped, on white or transparent.
// `app/icon.png` is 144×144 and exports to /icon.png.
const organization = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "AI4Kanban",
  url: BASE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${BASE_URL}/icon.png`,
    width: 144,
    height: 144,
  },
  // Not a knowledge-panel lever — this just points at the project's one
  // official profile so the entity is unambiguous.
  sameAs: [GITHUB_URL],
};

// No `potentialAction`/SearchAction: the site has no search endpoint, and
// markup must describe what the page actually does.
const website = {
  "@type": "WebSite",
  "@id": SITE_ID,
  name: "AI4Kanban",
  url: BASE_URL,
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
};

const pageImage = {
  "@type": "ImageObject",
  url: OG_IMAGE.url,
  width: OG_IMAGE.width,
  height: OG_IMAGE.height,
};

/**
 * Absolute URL for a route. `""` is the home page, which resolves to the
 * trailing-slash form so it matches the canonical tag Next emits for "/".
 */
export function pageUrl(path: string): string {
  return path ? `${BASE_URL}${path}` : `${BASE_URL}/`;
}

/**
 * The WebPage node for a route. Pass it as the first page-specific node so the
 * main entity can point back at it via `mainEntityOfPage`.
 */
export function webPage(
  path: string,
  name: string,
  description: string,
  type: "WebPage" | "CollectionPage" = "WebPage",
) {
  const url = pageUrl(path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    primaryImageOfPage: pageImage,
  };
}

/**
 * A numbered list of links, which is what a "browse all X" index page really
 * is. `ItemList` — not a bare CollectionPage — is the type that can earn a
 * carousel result.
 */
export function itemList(
  path: string,
  items: { url: string; name: string; description?: string }[],
) {
  return {
    "@type": "ItemList",
    "@id": `${pageUrl(path)}#itemlist`,
    itemListOrder: "https://schema.org/ItemListUnordered",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: item.url,
      name: item.name,
      description: item.description,
    })),
  };
}

type ArticleInput = {
  path: string;
  /** Google truncates past 110 characters. */
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  /** Entities the article is about, e.g. the products being compared. */
  about?: object[];
};

export function article({
  path,
  headline,
  description,
  datePublished,
  dateModified,
  about,
}: ArticleInput) {
  const url = pageUrl(path);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    url,
    image: pageImage,
    datePublished,
    dateModified,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": `${url}#webpage` },
    mainEntityOfPage: { "@id": `${url}#webpage` },
    about,
  };
}

/**
 * A SoftwareApplication node. `applicationCategory` is a controlled enum, not
 * free text — `DeveloperApplication` is the right bucket for dev tooling.
 */
export function softwareApplication(input: {
  id?: string;
  name: string;
  description?: string;
  url?: string;
  operatingSystem?: string;
  /** Omit for third-party products we don't price. */
  free?: boolean;
}) {
  return {
    "@type": "SoftwareApplication",
    "@id": input.id,
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "DeveloperApplication",
    operatingSystem: input.operatingSystem ?? "macOS, Linux, Windows",
    // A free app still needs `offers` — without it the type is ineligible.
    offers: input.free
      ? { "@type": "Offer", price: "0", priceCurrency: "USD" }
      : undefined,
  };
}

/**
 * Serialize page nodes into one `@graph` payload.
 *
 * Drops empty values (Google flags empty strings on required fields as errors)
 * and escapes any literal `</script` so a text value can't close the block early.
 */
export function jsonLd(...nodes: object[]): string {
  const payload = {
    "@context": "https://schema.org",
    "@graph": [organization, website, ...nodes],
  };
  const json = JSON.stringify(payload, (_key, value) =>
    value === "" || value === null ? undefined : value,
  );
  return json.replace(/<\/script/gi, "<\\/script");
}
