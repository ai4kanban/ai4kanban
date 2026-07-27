import type { Metadata } from "next";
import { PATH, VsGithubPage } from "@/components/pages/VsGithubPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  type: "article",
  ...getCopy("en").vsGithub.meta,
});

export default function Page() {
  return <VsGithubPage locale="en" />;
}
