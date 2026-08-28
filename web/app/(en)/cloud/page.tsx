import type { Metadata } from "next";
import {
  CloudPage,
  DESCRIPTION,
  PATH,
  SOCIAL,
  TITLE,
} from "@/components/cloud/CloudPage";
import { pageMetadata } from "@/lib/metadata";

// The Cloud page is English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  social: SOCIAL,
  translated: false,
});

export default function Page() {
  return <CloudPage />;
}
