import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HkHero } from "@/components/vs-hermes-kanban/HkHero";
import { HkSummary } from "@/components/vs-hermes-kanban/HkSummary";
import { HkHarness } from "@/components/vs-hermes-kanban/HkHarness";
import { HkComparison } from "@/components/vs-hermes-kanban/HkComparison";
import { HkMemory } from "@/components/vs-hermes-kanban/HkMemory";
import { HkAutonomy } from "@/components/vs-hermes-kanban/HkAutonomy";
import { HkGui } from "@/components/vs-hermes-kanban/HkGui";
import { HkWins } from "@/components/vs-hermes-kanban/HkWins";
import { HkDecision } from "@/components/vs-hermes-kanban/HkDecision";
import { pageMetadata } from "@/lib/metadata";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

const PATH = "/vs-hermes-kanban";
const TITLE =
  "AI4Kanban vs. Hermes Agent Kanban — a lean file-based board vs. a durable runtime";
const SHORT_TITLE = "AI4Kanban vs. Hermes Agent Kanban";
const DESCRIPTION =
  "How ai4kanban's file-based board compares to Nous Research's Hermes Agent Kanban: two overlapping agent kanban boards — plain diffable files that run on any agent (even Hermes) vs. a durable, shared SQLite queue many named agents claim tasks from.";
const SOCIAL =
  "Two overlapping agent kanban boards. ai4kanban is a lean, file-based board that runs on any agent (even Hermes); Hermes bundles the same board with a durable, shared queue many named agents work.";

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: TITLE,
  socialTitle: SHORT_TITLE,
  description: DESCRIPTION,
  social: SOCIAL,
  type: "article",
});

const RIVAL_ID = `${pageUrl(PATH)}#hermes-agent-kanban`;

const schema = jsonLd(
  webPage(PATH, TITLE, DESCRIPTION),
  article({
    path: PATH,
    headline: SHORT_TITLE,
    description: DESCRIPTION,
    datePublished: "2026-07-19",
    dateModified: "2026-07-26",
    about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
  }),
  softwareApplication({
    id: APP_ID,
    name: "AI4Kanban",
    url: pageUrl(""),
    free: true,
  }),
  softwareApplication({ id: RIVAL_ID, name: "Hermes Agent Kanban" }),
);

export default function VsHermesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-8">
        <HkHero />
        <HkSummary />
        <HkHarness />
        <HkComparison />
        <HkMemory />
        <HkAutonomy />
        <HkGui />
        <HkWins />
        <HkDecision />
      </main>
      <Footer />
    </>
  );
}
