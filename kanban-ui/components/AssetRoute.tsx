import { notFound } from "next/navigation";
import { MockupPage } from "@/components/MockupPage";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { findCard, readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { readMockup } from "@/lib/mockup";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board, Card } from "@/lib/types";

// One asset on its own, at full size (#239, #803) — where the words in a scaled-down screen
// can be read. The address is the tag's own `src` without its leading dot, so the file
// `.assets/803/a.png` is the page `/assets/803/a.png` (see `mockupHref`).
//
// A page in the board rather than a new window: the desktop app hands any link that opens
// one to the system browser, which would take the user out of the app.
//
// It is drawn in the same window the card is, header and rail and all. On its own it was a
// dead end — the only way out was a text link in the top 43px, which in the app is under
// the drag strip and cannot be clicked at all.
//
// Every asset lives under `<folder>/<card id>/`, so the first segment names the card this
// belongs to: that card is what the rail highlights and what Back goes to.

/** The page for one asset, under `/assets/...` or `/mockups/...` — `folder` is the dotted
 *  folder the address stands for. */
export async function AssetRoute({ folder, segments }: { folder: ".assets" | ".mockups"; segments: string[] }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const src = [folder, ...segments].join("/");

  let board: Board;
  try {
    board = await readBoard();
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }

  // Drawn without the frame's scroll containment: here the panel around it is what scrolls,
  // and a frame that keeps the wheel to itself is a picture you cannot reach the edges of.
  const view = await readMockup(src, false);
  // A file that isn't there is no such page — the note in its place belongs on the card
  // that pointed at it, not on a page the user asked for by name.
  if (view.error && !view.code) notFound();

  // The card the folder names. A mockup filed somewhere else, or one whose card has since
  // left the board, still opens — it just has no card to go back to.
  const id = Number(segments[0]);
  const card: Card | null = Number.isInteger(id) ? await findCard(id).catch(() => null) : null;

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <MockupPage
      view={view}
      card={card && { id: card.id, title: card.title }}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryOwners={board.memoryOwners}
      desktop={isDesktop()}
    />
  );
}
