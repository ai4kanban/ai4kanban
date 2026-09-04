import { notFound, redirect } from "next/navigation";
import { CardWindow } from "@/components/CardWindow";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { cardScreen, readArchivedCard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { readMockups } from "@/lib/mockup";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import type { ScreenMachine } from "@/lib/screen";
import type { CardScreen } from "@/lib/types";

// Read the card on the server and hand it to the client page. The files in docs/kanban/ are
// the source of truth; router.refresh() re-reads them after each mutation.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Same as the board page: no board at all is the "no board here" page, not a
  // missing card and not a crash. Checked first, since reading a card means
  // reading a board.
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isInteger(cardId)) notFound();

  // The one read a card page makes (#374) — the card, the ids it may link to, the releases
  // its picker offers, what an Implement would do and what the delivery changed.
  //
  // The board is read through the CLI (#169). No copy of its rules to read it with is not a
  // missing card — the card may be sitting right there — so it says so and names the fix,
  // rather than showing "not on the board" for a card that is.
  let screen: CardScreen | null;
  try {
    screen = await cardScreen(cardId);
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }
  // Off the board is not the same as gone. A delivery that landed archives its card in the
  // same breath (#380), so a bell row saying "Landed" — and every card link beside it —
  // arrives here for a card whose page is now the archive's. Send it there rather than
  // showing "no such card" for one the board finished.
  if (!screen) {
    const archived = await readArchivedCard(cardId).catch(() => null);
    if (archived) redirect(`/archive/${cardId}`);
    notFound();
  }

  // …and what only this machine can answer, for the window drawn around that screen. The
  // mockups are here for the same reason the agent is: a mockup is a file on this disk, and
  // reading it is the same server read the card was.
  const [agent, mockups] = await Promise.all([
    agentInfo().catch(() => NO_AGENT),
    readMockups(screen.card.body),
  ]);
  const machine: ScreenMachine = {
    projectRoot: repoRoot(),
    agent,
    desktop: isDesktop(),
    mockups,
  };
  return <CardWindow screen={screen} machine={machine} />;
}
