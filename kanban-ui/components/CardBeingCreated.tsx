"use client";

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { CardCreation } from "@/lib/types";
import { useBoardHref } from "./board-links";

// The whole screen, in place of a card page, for a card its creator has not finished writing
// (#564). A direct URL is refused here rather than drawing the plan as it stands: a plan read
// half-written is read as finished, which is the one mistake this card exists to stop.
//
// It takes the screen the way "not on the board" does — no header, no rail, no controls. Every
// one of those acts on a card, and this is not yet one. What is left is the reason and the way
// back, since the board is where the recovery lives.
export function CardBeingCreated({ id, creation }: { id: number; creation: CardCreation }) {
  const c = useCopy().card.creating;
  const board = useBoardHref();
  const going = creation.state === "creating";
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="nb-panel flex max-w-[420px] flex-col items-center gap-3 px-8 py-7 text-center">
        <p className="text-[15px] font-[700]">{going ? c.title(id) : c.unfinishedTitle(id)}</p>
        <p className="text-[13px] text-nb-ink-soft">{going ? c.blurb : c.unfinishedBlurb}</p>
        <Link
          href={board}
          className="inline-flex items-center gap-2 text-[14px] font-[700] text-nb-accent hover:text-nb-accent-deep"
        >
          <FiArrowLeft className="text-[16px]" aria-hidden />
          {c.back}
        </Link>
      </div>
    </main>
  );
}
