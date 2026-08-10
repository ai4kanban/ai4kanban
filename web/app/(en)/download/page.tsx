import { DownloadPage, PATH } from "@/components/pages/DownloadPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

// The download page in English, at /download. The four translations are built
// by `app/(intl)/[locale]/download/page.tsx`.
export const metadata = pageMetadata({
  locale: "en",
  path: PATH,
  ...getCopy("en").download.meta,
});

export default function Page() {
  return <DownloadPage locale="en" />;
}
