import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VkHero } from "@/components/vs-vibe-kanban/VkHero";
import { VkSummary } from "@/components/vs-vibe-kanban/VkSummary";
import { VkComparison } from "@/components/vs-vibe-kanban/VkComparison";
import { VkPurpose } from "@/components/vs-vibe-kanban/VkPurpose";
import { VkWins } from "@/components/vs-vibe-kanban/VkWins";
import { VkDecision } from "@/components/vs-vibe-kanban/VkDecision";
import { pageMetadata } from "@/lib/metadata";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

const PATH = "/vs-vibe-kanban";
const TITLE = "AI4Kanban vs. Vibe Kanban — a planning board vs. an agent cockpit";
const SHORT_TITLE = "AI4Kanban vs. Vibe Kanban";
const DESCRIPTION =
  "Vibe Kanban shut down when Bloop wound down in April 2026. How ai4kanban's file-based board compares: a lightweight planning board in your repo vs. a cockpit that runs many coding agents in parallel — and what carries over.";
const SOCIAL =
  "Vibe Kanban's company shut down. A planning board in your repo vs. an agent-orchestration cockpit — the honest difference, and what carries over.";

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: TITLE,
  socialTitle: SHORT_TITLE,
  description: DESCRIPTION,
  social: SOCIAL,
  type: "article",
});

const RIVAL_ID = `${pageUrl(PATH)}#vibe-kanban`;

const schema = jsonLd(
  webPage(PATH, TITLE, DESCRIPTION),
  article({
    path: PATH,
    headline: SHORT_TITLE,
    description: DESCRIPTION,
    datePublished: "2026-07-25",
    dateModified: "2026-07-26",
    about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
  }),
  softwareApplication({
    id: APP_ID,
    name: "AI4Kanban",
    url: pageUrl(""),
    free: true,
  }),
  softwareApplication({ id: RIVAL_ID, name: "Vibe Kanban" }),
);

export default function VsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
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
