import type { Metadata } from "next";
import { UnsubscribeResult } from "@/components/newsletter/UnsubscribeResult";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    locale: "en",
    path: "/unsubscribed",
    title: "Unsubscribed — WildCrane",
    description: "You have been removed from the WildCrane newsletter.",
    translated: false,
  }),
  robots: { index: false, follow: false },
};

export default function UnsubscribedPage() {
  return (
    <UnsubscribeResult
      eyebrow="UNSUBSCRIBED"
      title="You’re off the list."
      body="You won’t receive any more WildCrane newsletters."
    />
  );
}
