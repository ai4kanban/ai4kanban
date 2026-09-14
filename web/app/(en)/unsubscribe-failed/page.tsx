import type { Metadata } from "next";
import { UnsubscribeResult } from "@/components/newsletter/UnsubscribeResult";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    locale: "en",
    path: "/unsubscribe-failed",
    title: "Unsubscribe — AI4Kanban",
    description: "This unsubscribe link could not be read.",
    translated: false,
  }),
  robots: { index: false, follow: false },
};

export default function UnsubscribeFailedPage() {
  return (
    <UnsubscribeResult
      eyebrow="UNSUBSCRIBE"
      title="This link isn’t working."
      body="Your subscription hasn’t changed. Open the full unsubscribe link from the email, or contact us for help."
      support
    />
  );
}
