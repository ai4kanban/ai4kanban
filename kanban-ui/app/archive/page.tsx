import { ArchivePage } from "@/components/Archive";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readArchive, readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { ArchiveList, Board } from "@/lib/types";

// The finished cards, read on the server (#380). A page of its own for the reason a memory
// page is one: the rail highlights a row from the address you are on, and Back has to step
// off the archive rather than through it.
//
// Re-read on every request, like a card page — router.refresh() is what catches it up when
// a run archives a card.
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  // The archive is read through the CLI, like the rest of the board. Rules too old to
  // answer are not an empty archive — they are a board nothing can be read from — so the
  // page says so and names the fix rather than reading as a board that finished no work.
  let board: Board;
  let archive: ArchiveList;
  try {
    board = await readBoard();
    archive = await readArchive();
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <ArchivePage
      archive={archive}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryModules={board.memoryModules}
      desktop={isDesktop()}
    />
  );
}
