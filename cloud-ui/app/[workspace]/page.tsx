import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { boardScreenFrom } from "@/lib/format/board/assemble";
import { BoardView } from "../../components/BoardView";
import { NoticePage } from "../../components/Frame";
import { readBoard } from "../../lib/cloud";
import { getHostedCopy } from "../../lib/copy";
import { languageFor } from "../../lib/reader";
import { SESSION_COOKIE, decodeSession } from "../../lib/session";

// A live board, read for this reader on every request. Nothing here is cached: the page is
// member-only, so a copy of it would be a copy of somebody's board.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));

  // Signed out is a sign-in, not a refusal — and it comes back to the page that was asked
  // for, so a bookmark opened on a new device lands on the board rather than the top.
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/signin?next=${encodeURIComponent(`/${workspace}`)}`);

  const read = await readBoard(workspace, session.accessToken);
  // Refused and unavailable are two different sentences on purpose. The first is what a
  // signed-out visitor, an account with no claim, a deleted workspace and a made-up id all
  // get, so none of them learns anything from the difference; the second never says a board
  // does not exist, because a member's live board must never be reported as gone.
  if (!read.ok) {
    return <NoticePage copy={copy}>{read.why === "refused" ? copy.refused : copy.unavailable}</NoticePage>;
  }

  // A pure function over that one read: no filesystem, no git and no coding agent anywhere
  // in this path (`cli/src/lib/board/assemble.ts`).
  return <BoardView screen={boardScreenFrom(read.value)} copy={copy} />;
}
