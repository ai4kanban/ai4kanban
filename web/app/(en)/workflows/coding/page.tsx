import { CodingPage, codingMetadata } from "@/components/workflows/CodingPage";
import "../../../blog-prose.css";

// /workflows/coding in English. The other languages are `app/(intl)/[locale]/workflows/coding/`.
export const metadata = codingMetadata("en");

export default function Page() {
  return <CodingPage locale="en" />;
}
