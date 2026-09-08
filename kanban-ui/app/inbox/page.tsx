import { notFound } from "next/navigation";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { SignalsPage } from "@/components/Signals";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readBoard, readSignals, signalsOpen } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board, SignalInbox } from "@/lib/types";

// The inbox, read on the server (#453, #499). A page of its own for the reason the archive
// is one: the rail highlights a row from the address you are on, and Back has to step off
// the page rather than through it.
//
// A board the inbox is not open to has no rail row, so this address is one nothing links to —
// and it answers as no page at all rather than drawing a feature that is not on.
//
// Re-read on every request: a pull writes files behind the page's back.
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const access = await signalsOpen();
  if (!access.open) notFound();

  let board: Board;
  let inbox: SignalInbox;
  try {
    board = await readBoard();
    inbox = await readSignals();
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <SignalsPage
      inbox={inbox}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      goalWritten={board.goalWritten}
      memoryModules={board.memoryModules}
      desktop={isDesktop()}
    />
  );
}
