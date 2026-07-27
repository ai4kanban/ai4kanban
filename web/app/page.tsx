import { Header } from "@/components/Header";
import { Hero } from "@/components/home/Hero";
import { Features } from "@/components/home/Features";
import { Install } from "@/components/home/Install";
import { BoardTable } from "@/components/home/BoardTable";
import { BoardUI } from "@/components/home/BoardUI";
import { Presets } from "@/components/home/Presets";
import { Advanced } from "@/components/home/Advanced";
import { Footer } from "@/components/Footer";
import { BASE_URL } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AI4Kanban",
  description:
    "AI project management that runs as a Claude Code skill. Give it a vague idea — the agent breaks it down and clarifies it in a loop until it's clear enough to build. The board is plain Markdown in your repo — versioned in git, no database, no MCP.",
  url: BASE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="mx-auto max-w-4xl px-6">
        <Hero />
        <Features />
        <Install />
        <BoardTable />
        <BoardUI />
        <Presets />
        <Advanced />
      </main>
      <Footer />
    </>
  );
}
