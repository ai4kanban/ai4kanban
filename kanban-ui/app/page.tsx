import { BoardView } from "@/components/Board";
import { NoBoard } from "@/components/NoBoard";
import { agentInfo, setupInstruction } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { readAutoRefine, readAutoRefineParallelism } from "@/lib/config";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board } from "@/lib/types";

// Read the board on the server for the first paint (no loading flash); the
// client refreshes via the getBoard() action after each mutation.
export const dynamic = "force-dynamic";

export default function Page() {
  // No board at all is its own page, checked before anything reads one. The
  // board read below is caught, but every other call here resolves a board path
  // too, so without this they'd throw outside the catch and the user would get
  // the framework's crash screen instead of a plain message.
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  let initialBoard: Board | null = null;
  let initialError: string | null = null;
  try {
    initialBoard = readBoard();
  } catch (e) {
    initialError = e instanceof Error ? e.message : String(e);
  }
  return (
    <BoardView
      initialBoard={initialBoard}
      initialError={initialError}
      agent={agentInfo()}
      projectRoot={repoRoot()}
      autoRefine={readAutoRefine()}
      autoRefineParallelism={readAutoRefineParallelism()}
      setupInstruction={setupInstruction()}
      desktop={isDesktop()}
    />
  );
}
