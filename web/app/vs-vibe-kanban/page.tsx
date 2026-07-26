import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VkHero } from "@/components/vs-vibe-kanban/VkHero";
import { VkSummary } from "@/components/vs-vibe-kanban/VkSummary";
import { VkComparison } from "@/components/vs-vibe-kanban/VkComparison";
import { VkPurpose } from "@/components/vs-vibe-kanban/VkPurpose";
import { VkWins } from "@/components/vs-vibe-kanban/VkWins";
import { VkDecision } from "@/components/vs-vibe-kanban/VkDecision";
import { BASE_URL, OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI4Kanban vs. Vibe Kanban — a planning board vs. an agent cockpit",
  description:
    "Vibe Kanban shut down when Bloop wound down in April 2026. How ai4kanban's file-based board compares: a lightweight planning board in your repo vs. a cockpit that runs many coding agents in parallel — and what carries over.",
  alternates: { canonical: "/vs-vibe-kanban" },
  openGraph: {
    type: "article",
    url: "/vs-vibe-kanban",
    siteName: "AI4Kanban",
    title: "AI4Kanban vs. Vibe Kanban",
    description:
      "Vibe Kanban's company shut down. A planning board in your repo vs. an agent-orchestration cockpit — the honest difference, and what carries over.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI4Kanban vs. Vibe Kanban",
    description:
      "Vibe Kanban's company shut down. A planning board in your repo vs. an agent-orchestration cockpit — the honest difference, and what carries over.",
    images: [OG_IMAGE.url],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "AI4Kanban vs. Vibe Kanban",
  description:
    "How ai4kanban's file-based board compares to Vibe Kanban: a lightweight planning board in your repo vs. a cockpit that orchestrates many coding agents in parallel, after Bloop's April 2026 shutdown.",
  url: `${BASE_URL}/vs-vibe-kanban`,
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
        <VkHero />
        <VkSummary />
        <VkComparison />
        <VkPurpose />
        <VkWins />
        <VkDecision />
      </main>
      <Footer />
    </>
  );
}
