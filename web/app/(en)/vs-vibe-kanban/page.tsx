import type { Metadata } from "next";
import { PATH, VsVibePage } from "@/components/pages/VsVibePage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  type: "article",
  ...getCopy("en").vsVibe.meta,
});

export default function Page() {
  return <VsVibePage locale="en" />;
}
