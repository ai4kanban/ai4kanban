import { notFound } from "next/navigation";
import { MemoryPage } from "@/components/MemoryPage";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readBoard, readMemory } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board, MemoryFile } from "@/lib/types";

// One of the four memory files, read on the server (#129). A page of its own rather than a
// view held in the rail: the rail highlights a row from the address you are on, so a view
// with no address could not be highlighted, and Back would step over the file you were
// reading.
//
// Re-read on every request, like a card page — router.refresh() is what catches the page up
// when a run rewrites the file.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { name } = await params;

  // The memory is read through the CLI, like the rest of the board. No copy of its rules is
  // not an empty memory — it is a board nothing can be read from — so it says so and names
  // the fix rather than drawing four rows that all read as unwritten.
  let board: Board;
  let file: MemoryFile | null;
  try {
    board = await readBoard();
    file = await readMemory(name);
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }
  // An address naming something that isn't one of the four.
  if (!file) notFound();

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <MemoryPage
      file={file}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      desktop={isDesktop()}
    />
  );
}
