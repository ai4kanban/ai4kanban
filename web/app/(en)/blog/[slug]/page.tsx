import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { PostMeta } from "@/components/blog/PostMeta";
import { getCopy } from "@/i18n";
import { AUTHOR, getPost, getRoutablePosts, postPath } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { article, jsonLd, person, webPage } from "@/lib/schema";
import { BUILDER_PATH } from "@/components/social";
import "../../../blog-prose.css";

// The blog is English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

// One static page per post, which is what `output: export` needs. Drafts are in
// this list too: their page is built so it can be sent to someone to read, and
// everything else about it is off — no index entry, no sitemap line, `noindex`.
// It is also what lets the blog have nothing published, since an export refuses
// a dynamic route that resolves to zero pages.
export function generateStaticParams() {
  return getRoutablePosts().map((post) => ({ slug: post.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    ...pageMetadata({
      locale: "en",
      path: postPath(post),
      // `title_tag` exists for the post whose headline is right on the page and
      // wrong in a result — a result has no page around it to explain it.
      title: post.titleTag ?? post.title,
      description: post.seoDescription,
      socialTitle: post.title,
      social: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      byTao: true,
      translated: false,
    }),
    // A draft is a URL you hand to one person. `follow` stays on: the links out
    // of it point at pages that are published.
    robots: post.draft ? { index: false, follow: true } : undefined,
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const route = postPath(post);

  // Nothing to say about a draft: the page is `noindex`, so an Article node
  // describing it would be markup for a reader that has been told to leave.
  const schema = post.draft
    ? null
    : jsonLd(
        webPage(route, post.titleTag ?? post.title, post.seoDescription),
        person,
        article({
          path: route,
          headline: post.title,
          description: post.seoDescription,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          author: { "@id": person["@id"] },
        }),
      );

  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schema }}
        />
      )}
      <Header c={c} locale="en" overlay />
      <ArticleLayout
        body={post.body}
        header={
          <>
            <div className="flex flex-wrap items-center gap-3">
              {/* Says out loud what the meta tags say quietly, so nobody links
                  to a draft thinking it went out. */}
              {post.draft && (
                <span className="rounded-full bg-accent-deep px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-elev">
                  Draft
                </span>
              )}
              <PostMeta post={post} />
            </div>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 text-lg text-muted">{post.dek}</p>
            {/* The byline goes to the page that says who that is. */}
            <a
              href={BUILDER_PATH}
              rel="author"
              className="mt-6 inline-block text-sm text-muted transition-colors hover:text-ink"
            >
              <span className="font-semibold text-ink">{AUTHOR.name}</span> ·{" "}
              {AUTHOR.role}
            </a>
          </>
        }
      />
      <SiteFooter c={c} locale="en" path={route} />
    </>
  );
}
