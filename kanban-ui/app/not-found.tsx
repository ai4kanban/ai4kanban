"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";

// Archived/rejected cards leave their old /<id> URLs dangling; instead of a
// dead 404, count down briefly and send the user back to the board.
export default function NotFound() {
  const c = useCopy().chrome.notFound;
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace("/");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="nb-panel flex flex-col items-center gap-3 px-8 py-7 text-center">
        <p className="text-[15px] font-[700]">{c.title}</p>
        <p className="text-[13px] text-nb-ink-soft">{c.leaving(secondsLeft)}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[14px] font-[700] text-nb-accent hover:text-nb-accent-deep"
        >
          <FiArrowLeft className="text-[16px]" aria-hidden />
          {c.back}
        </Link>
      </div>
    </main>
  );
}
