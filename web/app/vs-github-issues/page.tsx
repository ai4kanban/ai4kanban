import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VsHero } from "@/components/vs-github-issues/VsHero";
import { VsSummary } from "@/components/vs-github-issues/VsSummary";
import { VsComparison } from "@/components/vs-github-issues/VsComparison";
import { VsWins } from "@/components/vs-github-issues/VsWins";
import { VsErgonomics } from "@/components/vs-github-issues/VsErgonomics";
import { VsDecision } from "@/components/vs-github-issues/VsDecision";
import { BASE_URL, OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI4Kanban vs. GitHub Issues — a different tool for a different job",
  description:
    "How ai4kanban's file-based board compares to GitHub Issues: local Markdown vs. a remote API, token cost, agent ergonomics, teams, and when to use each.",
  alternates: { canonical: "/vs-github-issues" },
  openGraph: {
    type: "article",
    url: "/vs-github-issues",
    siteName: "AI4Kanban",
    title: "AI4Kanban vs. GitHub Issues",
    description:
      "Not a replacement — a different tool for a different bottleneck. A head-to-head on speed, tokens, agents, and teams.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI4Kanban vs. GitHub Issues",
    description:
      "Not a replacement — a different tool for a different bottleneck. A head-to-head on speed, tokens, agents, and teams.",
    images: [OG_IMAGE.url],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AI4Kanban vs. GitHub Issues",
  description:
    "How ai4kanban's file-based board compares to GitHub Issues across storage, token cost, agent ergonomics, teams, and transparency.",
  url: `${BASE_URL}/vs-github-issues`,
};

export default function VsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-8">
        <VsHero />
        <VsSummary />
        <VsComparison />
        <VsWins />
        <VsErgonomics />
        <VsDecision />
      </main>
      <Footer />
    </>
  );
}
