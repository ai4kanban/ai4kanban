"use client";

// The window: the top row, the rail, and the body — the one frame both pages are
// drawn in, so the board and a card page are the same window with different
// contents rather than two screens that happen to share a header.
//
// Nothing in it is separated by a border. The top row and the rail sit straight
// on the window's cream and read as a single L; the body says where it starts by
// being paper instead of cream, with 16px of that cream down the two sides the
// chrome is on — half of it the chrome's own padding. The other two sides get
// none: the body runs into the window's own edges, so the only corner it rounds
// is the top-left one, where it turns away from the chrome.
//
// The whole thing is exactly one screen tall and never scrolls: the body is what
// scrolls, which is what keeps the rail on screen with the card it opened.
//
// See app/design/layouts for the mockup this is drawn from.

import { useCopy } from "@/i18n/use-copy";
import { CHAT_MAX, CHAT_MIN, CHAT_W, useChatRail, type BoardChange } from "@/lib/chat-rail";
import { useOpenCards } from "@/lib/open-cards";
import { RAIL_MAX, RAIL_MIN, RAIL_W, useRailWidth } from "@/lib/rail-width";
import type { MemoryModule } from "@/lib/types";
import { ChatPane, ChatProvider } from "./Chat";
import { Rail } from "./Rail";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

/** Stood in for a caller that doesn't watch sessions. One instance, so a page
 *  without it doesn't hand the rail a fresh empty set on every render. */
const EMPTY: Set<number> = new Set();

export function Window({
  /** The top row — <Header>, built by the page so it can hand it the board-only
   *  controls a card page has nothing to say about. */
  header,
  projectRoot,
  /** Every card the board holds open: the count on All cards, and what keeps the
   *  rail from offering a row that leads nowhere. */
  openIds,
  /** The card this page is showing, if it is showing one. Landing on a card is
   *  what opens it in the rail — every way in goes through the card page, so
   *  there is nothing for a board card or a `#12` link to remember to do. */
  currentId = null,
  currentTitle = "",
  currentMemory = null,
  memoryModules = [],
  running,
  onBoardChanged,
  children,
}: {
  header: React.ReactNode;
  projectRoot: string;
  openIds: number[];
  currentId?: number | null;
  currentTitle?: string;
  /** The memory file this page is showing, if it is showing one (#129) — as a memory key,
   *  which is what highlights its row in the rail's Memory panel, opens that panel on
   *  landing, and opens the module the file belongs to (#130). */
  currentMemory?: string | null;
  /** The modules the rail's Memory panel offers, from the board read every page already
   *  does (#130). Empty on a board whose map names none. */
  memoryModules?: MemoryModule[];
  /** The cards an agent is inside, for the rail's pulsing rows. Handed down
   *  rather than polled for here: both pages already watch the registry, and a
   *  fourth poll for one dot would be a poll to say nothing new. */
  running?: Set<number>;
  /** The board moved while this page was open — a chat wrote it as it answered, here or in
   *  a terminal (#243). The page re-reads itself; a card page whose card has gone goes back
   *  to the board. The chat's own poll is what notices, so nothing else has to watch. */
  onBoardChanged?(change: BoardChange): void;
  children: React.ReactNode;
}) {
  const c = useCopy().chrome;
  const { rows, close } = useOpenCards(projectRoot, openIds, currentId, currentTitle);
  const { panel, onLayoutChanged, onDoubleClick } = useRailWidth();
  // The chat rail follows what this window is showing (#242): a card's page gets that
  // card's own conversation, the board and a memory file get the board's. One chat on
  // screen, and nothing to choose.
  const chat = useChatRail({
    projectRoot,
    cardId: currentId ?? null,
    cardTitle: currentTitle,
    onBoardChanged,
  });
  // Beside the body on a wide window, over it on a narrow one — the same rail either way,
  // so what has been typed survives the window being dragged across that line.
  const beside = chat.open && !chat.overlay;
  return (
    <ChatProvider rail={chat}>
    <div className="flex h-screen flex-col overflow-hidden bg-nb-cream">
      {header}
      {/* The rail and the body are a panel group so the rail can be dragged
          wider — a title is the only thing a row has to say, and how much of one
          fits is a judgement about the cards you happen to have open, not one we
          can make for you once at 216px. `preserve-pixel-size` keeps that
          judgement: widening the window gives the new room to the body, and the
          rail stays the width you left it. */}
      <div className="min-h-0 flex-1">
        {/* One group, two draggable panels, so both handlers are called: each reads its own
            panel's width and writes it down, and ignores a layout it didn't cause. */}
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChanged={(layout, meta) => {
            onLayoutChanged(layout, meta);
            chat.onLayoutChanged(layout, meta);
          }}
        >
          <ResizablePanel
            id="rail"
            panelRef={panel}
            defaultSize={RAIL_W}
            minSize={RAIL_MIN}
            maxSize={RAIL_MAX}
            groupResizeBehavior="preserve-pixel-size"
          >
            <Rail
              rows={rows}
              activeId={currentId}
              activeMemory={currentMemory}
              memoryModules={memoryModules}
              total={openIds.length}
              running={running ?? EMPTY}
              onClose={close}
            />
          </ResizablePanel>
          <ResizableHandle aria-label={c.resize.rail} onDoubleClick={onDoubleClick} />
          {/* Without the rail (under `md`) the body still keeps the gutter, so the
              paper sits inside the window rather than against it. With it, the
              gutter is shared with the handle and the rail's own padding, and
              still comes to the same 12px of cream. */}
          <ResizablePanel
            id="body"
            className={`pl-4 md:pl-1 ${beside ? "pr-1" : ""}`}
            style={{ overflow: "hidden" }}
          >
            {/* The paper rounds the corner it turns away from the chrome on. With the chat
                up there is chrome on the right too, so it rounds that corner as well. */}
            <div
              className={`h-full overflow-hidden rounded-tl-[14px] bg-nb-paper ${beside ? "rounded-tr-[14px]" : ""}`}
            >
              {children}
            </div>
          </ResizablePanel>
          {beside && (
            <>
              <ResizableHandle aria-label={c.resize.chat} onDoubleClick={chat.onDoubleClick} />
              <ResizablePanel
                id="chat"
                panelRef={chat.panel}
                defaultSize={CHAT_W}
                minSize={CHAT_MIN}
                maxSize={CHAT_MAX}
                groupResizeBehavior="preserve-pixel-size"
              >
                <ChatPane rail={chat} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      {/* Too narrow to stand beside the board, so it covers it. It is given the paper's own
          ground and an ink edge, since here it is a thing laid over the window rather than
          a part of its frame. */}
      {chat.open && chat.overlay && (
        <div
          className="fixed bottom-0 right-0 top-[43px] z-40 w-[min(400px,100vw)] bg-nb-cream"
          style={{ borderLeft: "1.5px solid var(--color-nb-ink)" }}
        >
          <ChatPane rail={chat} />
        </div>
      )}
    </div>
    </ChatProvider>
  );
}
