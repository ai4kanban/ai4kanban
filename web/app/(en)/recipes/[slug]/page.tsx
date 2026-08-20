import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { RecipeLanding } from "@/components/recipes/RecipeLanding";
import { getRecipe, recipes } from "@/components/recipes/recipes-content";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { ORG_ID, jsonLd, pageUrl, webPage } from "@/lib/schema";

// Recipes are English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

// Pre-render one static page per recipe (required for `output: export`).
export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const recipeTitle = (title: string) => `${title} — a kanban recipe`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) return {};

  return pageMetadata({
    locale: "en",
    path: `/recipes/${recipe.slug}`,
    title: recipeTitle(recipe.title),
    description: recipe.tagline,
    type: "article",
  });
}

// Read the card's Markdown from public/ at build time — single source of truth
// with the file users download.
function readCard(mdFile: string): string {
  const filePath = path.join(process.cwd(), "public", mdFile);
  return fs.readFileSync(filePath, "utf8").trimEnd();
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) notFound();

  const markdown = readCard(recipe.mdFile);

  const route = `/recipes/${recipe.slug}`;
  const url = pageUrl(route);

  // Google retired HowTo rich results, so this earns no snippet — it stays
  // because it's what the page actually is, and it's how an AI reading the page
  // learns the steps of a run in order.
  const schema = jsonLd(
    {
      ...webPage(route, recipeTitle(recipe.title), recipe.tagline),
      mainEntity: { "@id": `${url}#howto` },
    },
    {
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: recipe.title,
      description: recipe.summary,
      url,
      publisher: { "@id": ORG_ID },
      mainEntityOfPage: { "@id": `${url}#webpage` },
      step: recipe.does.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title,
        text: s.body,
      })),
    },
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" />
      <RecipeLanding recipe={recipe} markdown={markdown} />
      <SiteFooter c={c} locale="en" path={route} />
    </>
  );
}
