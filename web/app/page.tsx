import { Header } from "@/components/Header";
import { Hero } from "@/components/home/Hero";
import { Features } from "@/components/home/Features";
import { Install } from "@/components/home/Install";
import { BoardTable } from "@/components/home/BoardTable";
import { BoardUI } from "@/components/home/BoardUI";
import { Presets } from "@/components/home/Presets";
import { Advanced } from "@/components/home/Advanced";
import { Footer } from "@/components/Footer";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/metadata";
import {
  APP_ID,
  ORG_ID,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

const home = webPage("", HOME_TITLE, HOME_DESCRIPTION);

const schema = jsonLd(home, {
  ...softwareApplication({
    id: APP_ID,
    name: "AI4Kanban",
    description: HOME_DESCRIPTION,
    url: pageUrl(""),
    free: true,
  }),
  publisher: { "@id": ORG_ID },
  mainEntityOfPage: { "@id": home["@id"] },
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
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
