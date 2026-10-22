"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { OpenFailed } from "@/components/load-states";
import { useCopy } from "@/i18n/use-copy";

// The card could not be read (#906). Retry reads it again from the server, not from the
// failed answer the router is holding.
export default function CardError({ reset }: { reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  const copy = useCopy();
  const c = copy.card.opening;
  const router = useRouter();
  const [retrying, retry] = useTransition();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-nb-paper p-6">
      <div className="flex w-full max-w-[480px] flex-col gap-4">
        <span className="text-[20px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
          #{id}
        </span>
        {!retrying && (
          <OpenFailed
            text={c.failed}
            retry={c.retry}
            onRetry={() =>
              retry(() => {
                router.refresh();
                reset();
              })
            }
          />
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[14px] font-[700] text-nb-accent hover:text-nb-accent-deep"
        >
          <FiArrowLeft className="text-[16px]" aria-hidden />
          {copy.chrome.notFound.back}
        </Link>
      </div>
    </main>
  );
}
