import type { Metadata } from "next";
import { Suspense, type ComponentProps } from "react";
import { FiRss } from "react-icons/fi";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { FeaturedPost } from "@/components/blog/FeaturedPost";
import { PostTile } from "@/components/blog/PostTile";
import { TopicFilter, TopicView } from "@/components/blog/TopicFilter";
import { column, panelInset } from "@/components/styles";
import { getCopy } from "@/i18n";
import { BLOG_CATEGORIES, getAllPosts, postPath } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd, pageUrl, webPage } from "@/lib/schema";

// The blog is English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

const PATH = "/blog";
const TITLE = "AI4Kanban Blog";
const DESCRIPTION = "Articles from the AI4Kanban team.";
const INTRO =
  "Notes on planning and shipping software with coding agents, from the team behind AI4Kanban.";
const RSS = "/blog/rss.xml";

const base = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  translated: false,
});

export const metadata: Metadata = {
  ...base,
  alternates: {
    ...base.alternates,
    types: { "application/rss+xml": [{ url: RSS, title: TITLE }] },
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const [featured] = posts;
  // Only topics with a post to show; in `BLOG_CATEGORIES` order.
  const topics = BLOG_CATEGORIES.filter((t) =>
    posts.some((p) => p.categories.includes(t.slug)),
  ).map(({ slug, label }) => ({ slug, label }));

  // The page is a list, so the entity it is about is the list itself.
  const list = itemList(
    PATH,
    posts.map((p) => ({
      url: pageUrl(postPath(p)),
      name: p.title,
      description: p.excerpt,
    })),
  );

  const schema = jsonLd(
    {
      ...webPage(PATH, TITLE, DESCRIPTION, { type: "CollectionPage" }),
      mainEntity: { "@id": list["@id"] },
    },
    list,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" />
      <main className={`${column} pb-16`}>
        <section className="mt-8 lg:mt-12">
          <div className="flex items-baseline justify-between gap-4 sm:items-end sm:gap-6">
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              Blog
            </h1>
            <a
              href={RSS}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-ink sm:mb-1.5"
            >
              <FiRss className="h-4 w-4" aria-hidden="true" />
              RSS
            </a>
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted sm:mt-3 sm:text-lg">
            {INTRO}
          </p>
        </section>

        {featured ? (
          <Filter
            topics={topics}
            featured={<FeaturedPost post={featured} />}
            items={posts.map((p) => ({
              slug: p.slug,
              categories: p.categories,
              tile: <PostTile post={p} />,
            }))}
          />
        ) : (
          <section className="mt-14">
            <div className={`${panelInset} p-8 text-center`}>
              <p className="text-lg font-semibold text-ink">
                The first post is being written.
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter c={c} locale="en" path={PATH} />
    </>
  );
}

// `useSearchParams` needs a Suspense boundary in a static export; the fallback
// is the All view, which is also what the prerendered HTML shows.
function Filter(props: ComponentProps<typeof TopicFilter>) {
  return (
    <Suspense fallback={<TopicView {...props} topic={null} />}>
      <TopicFilter {...props} />
    </Suspense>
  );
}
