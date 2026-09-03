import { BoardWindow } from "@/components/BoardWindow";
import { NoBoard } from "@/components/NoBoard";
import { agentInfo, NO_AGENT, setupInstruction } from "@/lib/agent";
import { boardScreen } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { ScreenMachine } from "@/lib/screen";
import { skillState, UNKNOWN_SKILL } from "@/lib/skill";

// Read the board on the server for the first paint (no loading flash); the
// client re-reads through the actions it was handed after each mutation.
export const dynamic = "force-dynamic";

export default async function Page() {
  // No board at all is its own page, checked before anything reads one. The board read
  // below carries its own reason, but every other call here resolves a board path too, so
  // without this they'd throw and the user would get the framework's crash screen instead
  // of a plain message.
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  // The one read the board screen makes (#374) — the columns, the releases, how the board
  // stands. Nothing machine-only is in it.
  const screen = await boardScreen();
  // …and what only this machine can answer, for the window drawn around that screen. The
  // agent setting and the words it is sent live in the CLI (lib/cli.ts), so these are read
  // rather than called inline. A board with no copy of the rules to load still draws: the
  // fields fall back to what an unconfigured board would show, and the run itself is what
  // says the rules are missing. The skill is read here too — only whether it is there
  // (#174), a file check cheap enough for the first paint.
  const [agent, instruction, skill] = await Promise.all([
    agentInfo().catch(() => NO_AGENT),
    setupInstruction().catch(() => ""),
    skillState().catch(() => UNKNOWN_SKILL),
  ]);
  const machine: ScreenMachine = {
    projectRoot: repoRoot(),
    agent,
    setupInstruction: instruction,
    skillInstalled: skill.installed,
    desktop: isDesktop(),
  };
  return <BoardWindow screen={screen} machine={machine} />;
}
