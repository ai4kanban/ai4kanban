import type { Metadata } from "next";
import { DocArticle } from "@/components/docs/DocArticle";
import { DOCS_PATH, docPath, getAllDocs, getDocsIndex } from "@/lib/docs";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd, pageUrl, webPage } from "@/lib/schema";

// `/docs` — the section's landing page, written as `web/docs/index.mdx` like
// every other page here, so the copy that routes a reader into the docs is
// edited in the same place as the docs themselves.

const index = getDocsIndex();
const TITLE = index.titleTag ?? index.title;

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: DOCS_PATH,
  title: TITLE,
  description: index.description,
  socialTitle: index.title,
  translated: false,
});

// The page is a way into a set of pages, so the entity it is about is that set
// — the same shape the recipes and the blog indexes take.
const list = itemList(
  DOCS_PATH,
  getAllDocs().map((doc) => ({
    url: pageUrl(docPath(doc)),
    name: doc.title,
    description: doc.description,
  })),
);

const schema = jsonLd(
  {
    ...webPage(DOCS_PATH, TITLE, index.description, { type: "CollectionPage" }),
    mainEntity: { "@id": list["@id"] },
  },
  list,
);

export default function DocsIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <DocArticle doc={index} toc={false} />
    </>
  );
}
