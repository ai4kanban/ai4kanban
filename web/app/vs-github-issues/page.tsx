import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VsHero } from "@/components/vs-github-issues/VsHero";
import { VsSummary } from "@/components/vs-github-issues/VsSummary";
import { VsComparison } from "@/components/vs-github-issues/VsComparison";
import { VsWins } from "@/components/vs-github-issues/VsWins";
import { VsErgonomics } from "@/components/vs-github-issues/VsErgonomics";
import { VsDecision } from "@/components/vs-github-issues/VsDecision";
import { pageMetadata } from "@/lib/metadata";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

const PATH = "/vs-github-issues";
const TITLE = "AI4Kanban vs. GitHub Issues — a different tool for a different job";
const SHORT_TITLE = "AI4Kanban vs. GitHub Issues";
const DESCRIPTION =
  "How ai4kanban's file-based board compares to GitHub Issues: local Markdown vs. a remote API, token cost, agent ergonomics, teams, and when to use each.";
const SOCIAL =
  "Not a replacement — a different tool for a different bottleneck. A head-to-head on speed, tokens, agents, and teams.";

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: TITLE,
  socialTitle: SHORT_TITLE,
  description: DESCRIPTION,
  social: SOCIAL,
  type: "article",
});

const RIVAL_ID = `${pageUrl(PATH)}#github-issues`;

// `datePublished` is when the page shipped; bump `dateModified` when the
// argument changes, not for copy tweaks.
const schema = jsonLd(
  webPage(PATH, TITLE, DESCRIPTION),
  article({
    path: PATH,
    headline: SHORT_TITLE,
    description: DESCRIPTION,
    datePublished: "2026-07-15",
    dateModified: "2026-07-26",
    about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
  }),
  softwareApplication({
    id: APP_ID,
    name: "AI4Kanban",
    url: pageUrl(""),
    free: true,
  }),
  softwareApplication({
    id: RIVAL_ID,
    name: "GitHub Issues",
    operatingSystem: "Web",
  }),
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
