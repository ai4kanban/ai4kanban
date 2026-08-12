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

import { useOpenCards } from "@/lib/open-cards";
import { RAIL_MAX, RAIL_MIN, RAIL_W, useRailWidth } from "@/lib/rail-width";
import { Rail } from "./Rail";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

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
  children,
}: {
  header: React.ReactNode;
  projectRoot: string;
  openIds: number[];
  currentId?: number | null;
  currentTitle?: string;
  children: React.ReactNode;
}) {
  const { rows, close } = useOpenCards(projectRoot, openIds, currentId, currentTitle);
  const { panel, onLayoutChanged, onDoubleClick } = useRailWidth();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-nb-cream">
      {header}
      {/* The rail and the body are a panel group so the rail can be dragged
          wider — a title is the only thing a row has to say, and how much of one
          fits is a judgement about the cards you happen to have open, not one we
          can make for you once at 216px. `preserve-pixel-size` keeps that
          judgement: widening the window gives the new room to the body, and the
          rail stays the width you left it. */}
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal" onLayoutChanged={onLayoutChanged}>
          <ResizablePanel
            id="rail"
            panelRef={panel}
            defaultSize={RAIL_W}
            minSize={RAIL_MIN}
            maxSize={RAIL_MAX}
            groupResizeBehavior="preserve-pixel-size"
          >
            <Rail rows={rows} activeId={currentId} total={openIds.length} onClose={close} />
          </ResizablePanel>
          <ResizableHandle aria-label="Resize the rail" onDoubleClick={onDoubleClick} />
          {/* Without the rail (under `md`) the body still keeps the gutter, so the
              paper sits inside the window rather than against it. With it, the
              gutter is shared with the handle and the rail's own padding, and
              still comes to the same 12px of cream. */}
          <ResizablePanel id="body" className="pl-4 md:pl-1" style={{ overflow: "hidden" }}>
            <div className="h-full overflow-hidden rounded-tl-[14px] bg-nb-paper">{children}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
