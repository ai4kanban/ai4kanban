import { notFound } from "next/navigation";
import { CardPage } from "@/components/CardPage";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { findCard, readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { readMockups } from "@/lib/mockup";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board, Card } from "@/lib/types";

// Read the board on the server and hand the one card to the client page. The
// files in docs/kanban/ are the source of truth; router.refresh() re-reads them
// after each mutation.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Same as the board page: no board at all is the "no board here" page, not a
  // missing card and not a crash. Checked first, since reading a card means
  // reading a board.
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId)) notFound();

  // The board is read through the CLI (#169). No copy of its rules to read it with is not
  // a missing card — the card may be sitting right there — so it says so and names the
  // fix, rather than showing "not on the board" for a card that is.
  let board: Board;
  let card: Card | null;
  try {
    board = await readBoard();
    card = await findCard(cardId);
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }
  if (!card) notFound();

  const agent = await agentInfo().catch(() => NO_AGENT);
  // The screens this card points at, drawn here rather than fetched by the page: a mockup
  // is a file on this machine, and reading it is the same server read the card was.
  const mockups = await readMockups(card.body);
  return (
    <CardPage
      card={card}
      openIds={board.openIds}
      releases={board.releases}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryModules={board.memoryModules}
      mockups={mockups}
      desktop={isDesktop()}
    />
  );
}
