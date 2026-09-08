import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cardScreenFrom } from "@/lib/format/board/assemble";
import { bandLabel, eventLabel, type CloudEvent } from "@/lib/format/cloud/events";
import type { NotificationRow } from "@/lib/notifications";
import { CardView } from "../../../components/CardView";
import { NoticePage } from "../../../components/Frame";
import { readBoard, readEvents } from "../../../lib/cloud";
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

  // The board and the decisions it is raising are two reads on two clocks (#364): a press
  // somewhere else settles an event without the board changing at all. Together, because a
  // card page draws both and a second round trip after the first paint would leave the
  // controls appearing under the reader.
  const [read, events] = await Promise.all([
    readBoard(workspace, session.accessToken),
    readEvents(workspace, session.accessToken),
  ]);
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

  return (
    <CardView
      screen={screen}
      copy={copy}
      workspace={workspace}
      event={rowFor(events, id)}
    />
  );
}

/** This card's live decision, as the card page reads one. The same shape the app's bell hands
 *  its own pages, so the page's mark and its controls are one judgment rather than two. */
function rowFor(events: CloudEvent[], taskId: number): NotificationRow | null {
  const event = events.find((e) => e.taskId === taskId);
  if (!event) return null;
  return {
    eventId: event.id,
    boardId: event.boardId,
    workspaceId: event.workspaceId ?? "",
    taskId: event.taskId,
    taskTitle: event.taskTitle,
    label: eventLabel(event),
    state: event.state,
    // The rail this row would be drawn on is the app's; here the row is read by the card page
    // alone, and `bandLabel` is what puts a word beside the title.
    onRail: !!bandLabel(event.state),
    unread: false,
    changedAt: event.changedAt,
  };
}
