"use client";

import { useParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import { CardOpening } from "@/components/CardOpening";

// The card could not be read (#906). Retry reads it again from the server, not from the
// failed answer the router is holding.
export default function CardError({ reset }: { reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [retrying, retry] = useTransition();
  return (
    <CardOpening
      id={Number(id)}
      failed={!retrying}
      onRetry={() =>
        retry(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
