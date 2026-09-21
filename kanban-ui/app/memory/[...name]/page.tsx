import { notFound } from "next/navigation";
import { MemoryPage } from "@/components/MemoryPage";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readBoard, readMemory } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board, MemoryFile } from "@/lib/types";

// One memory file, read on the server (#129, #130). A page of its own rather than a view
// held in the rail: the rail highlights a row from the address you are on, so a view with no
// address could not be highlighted, and Back would step over the file you were reading.
//
// The address is the panel's own path — `/memory/readme` for the board's own record,
// `/memory/planner/decisions` for one an agent keeps. Who holds what is the board's business,
// not this route's: an address naming a file its owner does not hold reads back as no such
// page.
//
// Re-read on every request, like a card page — router.refresh() is what catches the page up
// when a run rewrites the file.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ name: string[] }> }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { name: segments } = await params;
  // `/memory/<agent>/<name...>`: a file split out of an entry file carries its folder (#959).
  const agentName = segments.length > 1 ? segments[0]! : "";
  const name = segments.slice(segments.length > 1 ? 1 : 0).join("/");

  // The memory is read through the CLI, like the rest of the board. No copy of its rules is
  // not an empty memory — it is a board nothing can be read from — so it says so and names
  // the fix rather than drawing four rows that all read as unwritten.
  let board: Board;
  let file: MemoryFile | null;
  try {
    board = await readBoard();
    file = await readMemory(name, agentName);
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }
  // An address naming a file its owner does not hold, or an agent that keeps no memory.
  if (!file) notFound();

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <MemoryPage
      file={file}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryOwners={board.memoryOwners}
      desktop={isDesktop()}
    />
  );
}
