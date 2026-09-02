import { notFound } from "next/navigation";
import { ArchivedCardPage } from "@/components/Archive";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readArchivedCard, readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { ArchivedCardFile, Board } from "@/lib/types";

// One archived card, read on the server (#380). Read-only: the card is off the board, and
// anything that acted on it would be a second lifecycle the board does not have.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId)) notFound();

  let board: Board;
  let card: ArchivedCardFile | null;
  try {
    board = await readBoard();
    card = await readArchivedCard(cardId);
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }
  // An id the archive holds no card for — including one that is still open, which has a
  // page of its own.
  if (!card) notFound();

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <ArchivedCardPage
      card={card}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryModules={board.memoryModules}
      desktop={isDesktop()}
    />
  );
}
