import { BoardView } from "@/components/Board";
import { NoBoard } from "@/components/NoBoard";
import { agentInfo, NO_AGENT, setupInstruction } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { Board } from "@/lib/types";

// Read the board on the server for the first paint (no loading flash); the
// client refreshes via the getBoard() action after each mutation.
export const dynamic = "force-dynamic";

export default async function Page() {
  // No board at all is its own page, checked before anything reads one. The
  // board read below is caught, but every other call here resolves a board path
  // too, so without this they'd throw outside the catch and the user would get
  // the framework's crash screen instead of a plain message.
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  let initialBoard: Board | null = null;
  let initialError: string | null = null;
  try {
    initialBoard = await readBoard();
  } catch (e) {
    initialError = e instanceof Error ? e.message : String(e);
  }
  // The agent setting and the words it is sent live in the CLI now (lib/cli.ts), so these
  // are read rather than called inline. A board with no copy of the rules to load still
  // draws: the fields fall back to what an unconfigured board would show, and the run
  // itself is what says the rules are missing.
  const [agent, instruction] = await Promise.all([
    agentInfo().catch(() => NO_AGENT),
    setupInstruction().catch(() => ""),
  ]);
  return (
    <BoardView
      initialBoard={initialBoard}
      initialError={initialError}
      agent={agent}
      projectRoot={repoRoot()}
      setupInstruction={instruction}
      desktop={isDesktop()}
    />
  );
}
