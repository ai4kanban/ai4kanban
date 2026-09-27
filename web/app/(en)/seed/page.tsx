import { PATH, SeedPage } from "@/components/seed/SeedPage";
import { getSeedCopy } from "@/i18n/seed";
import { pageMetadata } from "@/lib/metadata";

// The seed partner page in English. Chinese is `app/(intl)/[locale]/seed/page.tsx`.
export const metadata = pageMetadata({
  locale: "en",
  path: PATH,
  ...getSeedCopy("en").meta,
});

export default function Page() {
  return <SeedPage locale="en" />;
}
