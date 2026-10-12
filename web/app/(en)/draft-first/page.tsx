import { DraftFirstPage, draftFirstMetadata } from "@/components/draft-first/DraftFirstPage";

// /draft-first in English. The other languages are `app/(intl)/[locale]/draft-first/`.
export const metadata = draftFirstMetadata("en");

export default function Page() {
  return <DraftFirstPage locale="en" />;
}
