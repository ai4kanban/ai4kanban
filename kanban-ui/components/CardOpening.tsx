"use client";

// A card page before its card has been read (#906): the window it will be drawn in, the id
// and whatever title the reader already saw, and — only once the read is slow enough to
// notice — a few skeleton lines where the content goes. A read that failed says so there,
// with a retry, and leaves the rest of the window alone.

import { useEffect, useState } from "react";
import { FiRotateCw } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { cardOpen } from "@/lib/card-open";
import { Button } from "./button";
import { Header } from "./Header";
import { Window } from "./Window";

/** How long a read may take before its skeleton shows, so a quick card never flashes one. */
const SKELETON_MS = 300;

function Skeleton() {
  const c = useCopy().card.opening;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    cardOpen.setSkeleton(false);
    const t = setTimeout(() => {
      setShown(true);
      cardOpen.setSkeleton(true);
    }, SKELETON_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-busy="true" aria-label={c.reading} className="flex flex-col gap-3 pt-1">
      {shown &&
        ["92%", "100%", "64%"].map((w) => (
          <span key={w} aria-hidden className="a4k-skel block h-3 rounded-full" style={{ width: w }} />
        ))}
    </div>
  );
}

export function CardOpening({ id, failed = false, onRetry }: { id: number; failed?: boolean; onRetry?: () => void }) {
  const c = useCopy().card.opening;
  const frame = cardOpen.frame();
  const title = cardOpen.title(id);
  const page = (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[840px] flex-col gap-8 px-6 py-6 max-md:gap-6 max-md:px-4 max-md:py-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <span className="shrink-0 text-[20px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
            #{id}
          </span>
          {title && (
            <h1 className="min-w-0 break-words text-[20px] font-[800] leading-tight tracking-[-0.02em]">{title}</h1>
          )}
        </div>
        {failed ? (
          <div
            role="alert"
            className="nb-section flex items-center gap-3 bg-nb-peach-soft py-2.5 pl-3.5 pr-2.5 text-[13px] text-nb-peach-ink"
          >
            <span className="min-w-0 flex-1">{c.failed}</span>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <FiRotateCw className="text-[15px]" aria-hidden />
              {c.retry}
            </Button>
          </div>
        ) : (
          <Skeleton />
        )}
      </main>
    </div>
  );
  // Opened straight from an address, with no window drawn yet to borrow.
  if (!frame) return <div className="h-[100dvh] bg-nb-paper">{page}</div>;
  return (
    <Window
      projectRoot={frame.projectRoot}
      openIds={frame.openIds}
      currentId={id}
      currentTitle={title}
      memoryOwners={frame.memoryOwners}
      goalWritten={frame.goalWritten}
      header={
        <Header
          agent={frame.agent}
          projectRoot={frame.projectRoot}
          goalWritten={frame.goalWritten}
          desktop={frame.desktop}
        />
      }
    >
      {page}
    </Window>
  );
}
