import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cardScreenFrom } from "@/lib/format/board/assemble";
import { CardView } from "../../../components/CardView";
import { NoticePage } from "../../../components/Frame";
import { readBoard } from "../../../lib/cloud";
import { getHostedCopy } from "../../../lib/copy";
import { languageFor } from "../../../lib/reader";
import { SESSION_COOKIE, decodeSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ workspace: string; card: string }>;
}) {
  const { workspace, card } = await params;
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));

  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/signin?next=${encodeURIComponent(`/${workspace}/${card}`)}`);

  const read = await readBoard(workspace, session.accessToken);
  if (!read.ok) {
    return <NoticePage copy={copy}>{read.why === "refused" ? copy.refused : copy.unavailable}</NoticePage>;
  }

  // A card the board does not hold is its OWN answer, not the refusal above: this reader can
  // already see the board, so saying so gives away nothing they do not have — and the board
  // is named on the page, with the way back to it.
  const id = Number(card);
  const screen = Number.isInteger(id) ? cardScreenFrom(read.value, id) : null;
  if (!screen) {
    return (
      <NoticePage copy={copy} workspaceName={read.value.workspace.name} back={`/${workspace}`}>
        {copy.noSuchCard}
      </NoticePage>
    );
  }

  return <CardView screen={screen} copy={copy} />;
}
