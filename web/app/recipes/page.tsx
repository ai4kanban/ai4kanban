import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { recipes } from "@/components/recipes/recipes-content";
import { panelStatic } from "@/components/styles";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd, pageUrl, webPage } from "@/lib/schema";

const PATH = "/recipes";
const TITLE = "Recipes — ready-made recurring tasks for your kanban board";
const DESCRIPTION =
  "Ready-made recurring tasks you add to your board in one prompt. Claude pulls the recipe by URL and runs it on the cadence you choose — starting with daily kanban maintenance.";
const SOCIAL =
  "Ready-made recurring tasks you add to your board in one prompt. Claude pulls the recipe by URL and runs it on the cadence you choose.";

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  social: SOCIAL,
});

// The page is a catalog, so the entity it's really about is the list itself.
const catalog = itemList(
  PATH,
  recipes.map((r) => ({
    url: pageUrl(`/recipes/${r.slug}`),
    name: r.title,
    description: r.tagline,
  })),
);

const schema = jsonLd(
  {
    ...webPage(PATH, TITLE, DESCRIPTION, "CollectionPage"),
    mainEntity: { "@id": catalog["@id"] },
  },
  catalog,
);

export default function RecipesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-8">
        <section className="mt-12 text-center">
          <p className="mb-5 inline-block rounded-full bg-accent/10 px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-accent">
            Recipes
          </p>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            Recurring tasks, ready to run.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            A recipe is a ready-made recurring task — a job you run on a cadence
            that never archives and gets sharper each run. Paste one prompt and
            Claude pulls it onto your board; copy it as-is or reshape it to your
            project.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {recipes.map((r) => (
              <RecipeCard key={r.slug} recipe={r} />
            ))}
          </div>

          <div className={`${panelStatic} mt-6 bg-code p-5 text-center`}>
            <p className="text-sm text-muted">
              More recipes soon — social listening, weekly board review, changelog
              digests, and more.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
