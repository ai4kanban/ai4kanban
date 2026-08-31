// The documentation's public API. The routes import from here, never from the
// files beside it, so the inside can be rearranged without rewiring a page.

export type { DocNavGroup, DocPage } from "./types";
export { getAllDocs, getDoc, getDocsIndex, getDocsNav } from "./loader";

import { INDEX_SLUG } from "./loader";
import type { DocPage } from "./types";

/** Where the section is served. Everything else derives from this. */
export const DOCS_PATH = "/docs";

/** The route a page is published at. The landing page is the base path itself. */
export function docPath(doc: Pick<DocPage, "slug">): string {
  return doc.slug === INDEX_SLUG ? DOCS_PATH : `${DOCS_PATH}/${doc.slug}`;
}
