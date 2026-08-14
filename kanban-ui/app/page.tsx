import { BoardView } from "@/components/Board";
import { NoBoard } from "@/components/NoBoard";
import { agentInfo, NO_AGENT, setupInstruction } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import { skillState, UNKNOWN_SKILL } from "@/lib/skill";
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
  //
  // The skill is read here too — only whether it is there (#174). Every place that hands a
  // line to a coding agent has to say so when nothing would answer that line, and it is a
  // file check, cheap enough for the first paint. What `akb` on the PATH is stays out of
  // this: that one spawns a process, and only the Configuration dialog asks for it.
  const [agent, instruction, skill] = await Promise.all([
    agentInfo().catch(() => NO_AGENT),
    setupInstruction().catch(() => ""),
    skillState().catch(() => UNKNOWN_SKILL),
  ]);
  return (
    <BoardView
      initialBoard={initialBoard}
      initialError={initialError}
      agent={agent}
      projectRoot={repoRoot()}
      setupInstruction={instruction}
      skillInstalled={skill.installed}
      desktop={isDesktop()}
    />
  );
}
