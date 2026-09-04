"use client";

// The board, in a browser (#322) — the hosted half of what `BoardWindow` is in the app.
//
// `Board` is the screen. It is handed no `ScreenActions` and no `ScreenMachine`, so every
// control that would write is gone rather than dead, no runs are polled, and nothing in this
// path reaches a filesystem, git or the coding agent. What is left around it is the frame:
// the board's name and the release picker.

import type { ReactNode } from "react";
import { Board, type BoardChrome } from "@/components/Board";
import { BoardBaseProvider } from "@/components/board-links";
import type { BoardScreen } from "@/lib/format/board/screen";
import type { HostedCopy } from "../lib/copy";
import { CopyProvider, Releases, TopRow } from "./Frame";

/** Declared here rather than inside the component below: a shell built during a render is a
 *  new component type every time, and React would tear the board down and build it again. */
function Shell({ children, ...chrome }: BoardChrome & { children: ReactNode }) {
  const board = chrome.screen.board;
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopRow workspaceName={chrome.screen.standing.workspaceName}>
        <Releases
          releases={board?.releases ?? []}
          goals={board?.releaseGoals ?? {}}
          counts={board?.releaseCounts ?? {}}
          value={chrome.release}
          onChange={chrome.onReleaseChange}
        />
      </TopRow>
      {children}
    </div>
  );
}

export function BoardView({ screen, copy }: { screen: BoardScreen; copy: HostedCopy }) {
  return (
    <CopyProvider value={copy}>
      {/* A card lives under its workspace here, not at `/<id>` as it does in the app, so
          every link the screen draws to one is told where that is. */}
      <BoardBaseProvider value={`/${screen.id}`}>
        <Board screen={screen} shell={Shell} />
      </BoardBaseProvider>
    </CopyProvider>
  );
}
