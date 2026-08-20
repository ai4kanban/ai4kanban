import { notFound } from "next/navigation";
import { MockupPage } from "@/components/MockupPage";
import { NoBoard } from "@/components/NoBoard";
import { isDesktop } from "@/lib/desktop";
import { readMockup } from "@/lib/mockup";
import { boardSearchStart, findRepoRoot } from "@/lib/paths";

// One mockup on its own, at full size (#239) — where the words in a scaled-down screen can
// be read. The address is the tag's own `src`, so `/mockups/239/a.tsx` is what the file
// name on a card's frame links to.
//
// A page in the board rather than a new window: the desktop app hands any link that opens
// one to the system browser, which would take the user out of the app. Back returns to the
// card, as it does from anywhere else.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ src: string[] }> }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  const { src: segments } = await params;
  const src = ["mockups", ...segments].join("/");
  const view = await readMockup(src);
  // A file that isn't there is no such page — the note in its place belongs on the card
  // that pointed at it, not on a page the user asked for by name.
  if (view.error && !view.code) notFound();

  return <MockupPage view={view} />;
}
