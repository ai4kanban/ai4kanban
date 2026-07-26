import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RecipeLanding } from "@/components/recipes/RecipeLanding";
import { getRecipe, recipes } from "@/components/recipes/recipes-content";
import { BASE_URL, OG_IMAGE } from "@/lib/site";

// Pre-render one static page per recipe (required for `output: export`).
export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) return {};

  const url = `/recipes/${recipe.slug}`;
  return {
    title: `${recipe.title} — a kanban recipe`,
    description: recipe.tagline,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "AI4Kanban",
      title: `${recipe.title} — a kanban recipe`,
      description: recipe.tagline,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${recipe.title} — a kanban recipe`,
      description: recipe.tagline,
      images: [OG_IMAGE.url],
    },
  };
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: recipe.title,
    description: recipe.summary,
    url: `${BASE_URL}/recipes/${recipe.slug}`,
    step: recipe.does.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <RecipeLanding recipe={recipe} markdown={markdown} />
      <Footer />
    </>
  );
}
