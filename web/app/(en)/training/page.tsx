import { PATH, TrainingPage } from "@/components/training/TrainingPage";
import { getTrainingCopy } from "@/i18n/training";
import { pageMetadata } from "@/lib/metadata";

// Hands-on project guidance in English, at /training. The Chinese page is built
// by `app/(intl)/[locale]/training/page.tsx`, and there is no third: the page is
// published in two languages (`PATH_LOCALES` in lib/i18n.ts).
export const metadata = pageMetadata({
  locale: "en",
  path: PATH,
  ...getTrainingCopy("en").meta,
});

export default function Page() {
  return <TrainingPage locale="en" />;
}
