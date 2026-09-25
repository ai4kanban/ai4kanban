import { PATH, PricingPage } from "@/components/pricing/PricingPage";
import { getPricingCopy } from "@/i18n/pricing";
import { pageMetadata } from "@/lib/metadata";

// The pricing page in English. Chinese is `app/(intl)/[locale]/pricing/page.tsx`.
export const metadata = pageMetadata({
  locale: "en",
  path: PATH,
  ...getPricingCopy("en").meta,
});

export default function Page() {
  return <PricingPage locale="en" />;
}
