import type { Metadata } from "next";
import { Layouts } from "./mockups";

// /design/layouts — how the window carries open cards: a rail down the left,
// drawn at size so it can be judged by looking rather than by describing.
//
// Why anything at all: in a browser the way back from a card is the swipe or
// the back button, and the desktop app has neither at hand — a trackpad swipe
// does nothing in an Electron window, and there is no visible chrome saying
// "you went somewhere". So opening a card has to leave a mark on screen that is
// also the way back. That mark is a row in the rail.
//
// The rules the mockup obeys:
//
//   - All cards is the first row and is never closeable. It is the board.
//   - Opening a card appends a row. Opening one already open just moves to it.
//   - Each card row closes. Closing the last one lands you back on All cards.
//   - With nothing open the rail is a single row.
//
// The rail costs width, so the rest of the chrome is drawn at IDE weight to pay
// some of it back: a 44px top row, 28px controls, one frame per cluster of
// controls rather than one per control, and vertical rules where a gap used to
// do the separating.
//
// The board ships this layout: components/Window.tsx is the frame, components/
// Rail.tsx the rail, components/chrome.tsx the row's shared frame and cluster,
// and lib/open-cards.ts what the rail remembers. This page stays as the drawing
// the shipped one is measured against — it is where the layout can be changed
// and looked at without touching a live board.
//
// It is still a mockup: nothing here is wired to a board, the cards are grey
// blocks, and the chrome is redrawn locally rather than imported so that
// changing it can't reach the real header. The colours and the frames are the
// board's own tokens (app/globals.css).

export const metadata: Metadata = {
  title: "Window layouts · AI4Kanban",
};

export default function LayoutsPage() {
  return <Layouts />;
}
