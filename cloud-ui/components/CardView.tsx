"use client";

// One card, in a browser (#322) — the hosted half of what `CardWindow` is in the app.
//
// The card reads whole: the human half, the folded agent half, its subtasks and its open
// questions, exactly as the board itself shows it. With no actions handed in, every control
// that would answer, build, sharpen or archive it is gone.

import type { ReactNode } from "react";
import { BoardBaseProvider } from "@/components/board-links";
import { CardPage, type CardChrome } from "@/components/CardPage";
import type { CardScreen } from "@/lib/format/board/screen";
import type { HostedCopy } from "../lib/copy";
import { CopyProvider, TopRow } from "./Frame";

function Shell({ children, ...chrome }: CardChrome & { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopRow workspaceName={chrome.screen.standing.workspaceName} back={`/${chrome.screen.id}`} />
      {children}
    </div>
  );
}

export function CardView({ screen, copy }: { screen: CardScreen; copy: HostedCopy }) {
  return (
    <CopyProvider value={copy}>
      {/* The card's own links — its group root, its blockers, its subtasks and the `#12`s
          in its body — lead to cards under this same workspace. */}
      <BoardBaseProvider value={`/${screen.id}`}>
        <CardPage screen={screen} shell={Shell} />
      </BoardBaseProvider>
    </CopyProvider>
  );
}
