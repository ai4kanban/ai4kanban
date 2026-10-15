import { SaasPage, saasMetadata } from "@/components/solutions/SaasPage";
import "../../../blog-prose.css";

// /solutions/saas in English. The other languages are `app/(intl)/[locale]/solutions/saas/`.
export const metadata = saasMetadata("en");

export default function Page() {
  return <SaasPage locale="en" />;
}
