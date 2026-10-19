import { TemplatesHomePage } from "@/components/templates/TemplatesPage";
import { getTemplatesCopy } from "@/i18n/templates";
import { pageMetadata } from "@/lib/metadata";
import { TEMPLATES_PATH, buildCatalog } from "@/lib/templates";

// The template catalog in English, at /templates. Chinese is
// `app/(intl)/[locale]/templates/page.tsx`.
export const metadata = pageMetadata({ locale: "en", path: TEMPLATES_PATH, ...getTemplatesCopy("en").meta });

export default async function Page() {
  return <TemplatesHomePage locale="en" initial={await buildCatalog()} />;
}
