import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { getLegalDoc } from "@/lib/legal";
import { pageMetadata } from "@/lib/metadata";
import "../../blog-prose.css";

// The legal pages are English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const doc = getLegalDoc("privacy");

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: doc.path,
  title: `${doc.title} — AI4Kanban`,
  description: doc.description,
  translated: false,
});

export default function PrivacyPage() {
  return <LegalPage doc={doc} />;
}
