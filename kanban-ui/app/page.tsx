import { BoardView } from "@/components/Board";
import { agentInfo } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { readAutoRefine, readAutoRefineParallelism } from "@/lib/config";
import { repoRoot } from "@/lib/paths";
import type { Board } from "@/lib/types";

// Read the board on the server for the first paint (no loading flash); the
// client refreshes via the getBoard() action after each mutation.
export const dynamic = "force-dynamic";

export default function Page() {
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
    />
  );
}
