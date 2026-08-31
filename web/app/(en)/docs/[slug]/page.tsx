import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/docs/DocArticle";
import { docPath, getAllDocs, getDoc } from "@/lib/docs";
import { pageMetadata } from "@/lib/metadata";
import { jsonLd, webPage } from "@/lib/schema";

// One static page per documentation page, which is what `output: export` needs.
// `index` is not in this list — it is the `/docs` landing page, and asking for
// `/docs/index` 404s.
export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};

  return pageMetadata({
    locale: "en",
    path: docPath(doc),
    // `title_tag` exists for the page whose headline is right on the page and
    // wrong in a result — a result has no page around it to explain it.
    title: doc.titleTag ?? doc.title,
    description: doc.description,
    socialTitle: doc.title,
    type: "article",
    translated: false,
  });
}

export default async function DocPage({ params }: Params) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const route = docPath(doc);
  const schema = jsonLd(
    webPage(route, doc.titleTag ?? doc.title, doc.description),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <DocArticle doc={doc} />
    </>
  );
}
