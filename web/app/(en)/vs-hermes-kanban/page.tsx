import type { Metadata } from "next";
import { PATH, VsHermesPage } from "@/components/pages/VsHermesPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  type: "article",
  ...getCopy("en").vsHermes.meta,
});

export default function Page() {
  return <VsHermesPage locale="en" />;
}
