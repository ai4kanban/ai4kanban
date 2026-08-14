import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FeaturedPost } from "@/components/blog/FeaturedPost";
import { PostRow } from "@/components/blog/PostRow";
import { heroTop, panelInset } from "@/components/styles";
import { getCopy } from "@/i18n";
import { getAllPosts, postPath } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd, pageUrl, webPage } from "@/lib/schema";

// The blog is English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

const PATH = "/blog";
const TITLE = "Blog — notes on running a kanban board an agent keeps";
const DESCRIPTION =
  "Writing about the board an AI coding agent plans and maintains: how it is designed, what the agents do with it, and what changes after watching it run.";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  translated: false,
});

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  // The page is a list, so the entity it is about is the list itself — the same
  // shape the recipes index takes.
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
      <main className="mx-auto max-w-4xl px-6 pb-8">
        <section className={`${heroTop} text-center`}>
          <p className="mb-5 inline-block rounded-full border-2 border-border bg-accent-deep px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-elev">
            Blog
          </p>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            Notes from the board.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            What we learn running a kanban board a coding agent plans, works and
            keeps — how the board is shaped, what the agents do with it, and what
            we change after watching a week of runs.
          </p>
        </section>

        {featured ? (
          <>
            <section className="mt-14">
              <FeaturedPost post={featured} />
            </section>

            {rest.length > 0 && (
              <section className="mt-14">
                <h2 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
                  More posts
                </h2>
                {/* A list is a composite: bare rows, separated by the rule. */}
                <div className="mt-2 divide-y-2 divide-border border-t-2 border-border">
                  {rest.map((post) => (
                    <PostRow key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="mt-14">
            <div className={`${panelInset} p-8 text-center`}>
              <p className="text-lg font-semibold text-ink">
                The first post is being written.
              </p>
              <p className="mt-2 text-sm text-muted">
                Until it lands, the recipes are where the habits of a board that
                keeps itself are written down.
              </p>
            </div>
          </section>
        )}
      </main>
      <Footer c={c} locale="en" path={PATH} />
    </>
  );
}
