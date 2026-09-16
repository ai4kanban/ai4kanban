import { ContactPage, PATH } from "@/components/contact/ContactPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

// The contact page in English, at /contact. The four translations are built by
// `app/(intl)/[locale]/contact/page.tsx`.
export const metadata = pageMetadata({
  locale: "en",
  path: PATH,
  ...getCopy("en").contact.meta,
});

export default function Page() {
  return <ContactPage locale="en" />;
}
