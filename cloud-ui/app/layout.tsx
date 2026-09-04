import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { LanguageProvider } from "@/components/language";
import { LANGUAGE_TAGS } from "@/lib/format/machine/types";
import { languageFor } from "../lib/reader";
import "./globals.css";

// A phone is what most of these pages are opened on — a member away from the machine the
// app is installed on — and #357's layout only ever matches when the page is laid out at
// the device's own width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Nothing about a board is in the head. Every page here is member-only, so a crawler and a
// link preview get exactly what a signed-out visitor gets — the product's name and no board
// name, no card title, and no answer to whether that workspace exists.
export const metadata: Metadata = {
  title: "AI4Kanban",
  description: "AI4Kanban",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A hosted page has no machine setting to read, so the reader's own preferred languages
  // are what decide (lib/reader.ts). Read here rather than per page, so every screen has it
  // in its first paint and none draws English and corrects itself.
  const language = languageFor((await headers()).get("accept-language"));
  return (
    <html lang={LANGUAGE_TAGS[language]}>
      <body className="font-sans antialiased">
        {/* No save is handed in: a hosted page holds no machine setting to write, so the
            language follows the browser on every visit. */}
        <LanguageProvider initial={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
