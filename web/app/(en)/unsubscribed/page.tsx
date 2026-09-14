import type { Metadata } from "next";
import { UnsubscribeResult } from "@/components/newsletter/UnsubscribeResult";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    locale: "en",
    path: "/unsubscribed",
    title: "Unsubscribed — AI4Kanban",
    description: "You have been removed from the AI4Kanban newsletter.",
    translated: false,
  }),
  robots: { index: false, follow: false },
};

export default function UnsubscribedPage() {
  return (
    <UnsubscribeResult
      eyebrow="UNSUBSCRIBED"
      title="You’re off the list."
      body="You won’t receive any more AI4Kanban newsletters."
    />
  );
}
