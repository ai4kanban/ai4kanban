"use client";

// What a browser can DO to a board (#364).
//
// The card page acts through one passed-in `ScreenActions` (#374). The app's implementation
// spawns the coding agent and reads the machine's filesystem; this one records ONE durable
// action against the card's live Cloud event and nothing else — the same action the app,
// Slack and Lark record, so the browser is a fourth caller of a shape three surfaces share.
//
// It is deliberately not a second, smaller interface. `startAgent` is already the seam every
// press ends at: the app starts the run and records the action, and here there is no run to
// start, so recording it IS the press. What that leaves is a decision waiting for one of the
// workspace's own machines, which is what the card says until one picks it up.
//
// Every other method is unreachable and says so. The surface names the two controls it offers
// (`HOSTED_CONTROLS`), and the card page draws those and no more — so nothing on the page can
// call one of these. They throw rather than answering a plausible refusal, because a control
// that quietly does nothing is worse than one that is not there.

import type { CardControl, ScreenActions, StartAnswer } from "@/lib/screen";
import type { CloudEventAnswer } from "@/lib/types";
import { UNREACHABLE } from "./cloud";

/**
 * The two decisions a hosted card page offers, and no third.
 *
 * `implement` is approving a delivery for review; `resolve` is answering the card's
 * user-owned questions. Everything else the app's card page can do — editing a card's fields,
 * refining it, archiving it, rejecting it, taking a stopped delivery up again — stays in the
 * app.
 */
export const HOSTED_CONTROLS: CardControl[] = ["implement", "resolve"];

/** What the browser's press needs beside the card: the event it acts on, and what a refusal
 *  and an outage each say. */
export interface HostedPress {
  /** The card's live Cloud event, or null when the board is raising none for this card —
   *  then no control is offered and nothing here is ever called. */
  eventId: string | null;
  /** Where the press is sent: this app's own route handler, which holds the session cookie. */
  endpoint: string;
  /** What an outage says. A press the service could not answer must never read as one it
   *  refused. */
  unavailable: string;
  /** What a refusal with no words of its own says — a signed-out session, or a page whose
   *  card has moved on under it. */
  refused: string;
  /** Called once a press has landed, however it landed, so the page redraws to the event's
   *  own state. */
  onPressed(): void;
}

/** A method this surface does not offer. Unreachable by construction: the page draws only
 *  the controls above. */
const noSuchControl = (): never => {
  throw new Error("The hosted board offers this card's two decisions and nothing else.");
};

export function hostedActions(press: HostedPress): ScreenActions {
  const record = async (
    req: { action?: string; cloudRevision?: string; cloudAnswers?: CloudEventAnswer[] },
  ): Promise<StartAnswer> => {
    if (!press.eventId || !req.cloudRevision) return { ok: false, error: press.refused };
    let answer: Response;
    try {
      answer = await fetch(press.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: press.eventId,
          decision: req.action === "resolve" ? "answer" : "implement",
          // The revision the page DREW the card at. The machine re-reads the card before it
          // runs and refuses one that has moved (#318), so the gap between drawing this page
          // and pressing costs a refusal rather than a build nobody approved.
          revision: req.cloudRevision,
          answers: req.cloudAnswers ?? [],
        }),
      });
    } catch {
      return { ok: false, error: press.unavailable };
    }
    const said = (await answer.json().catch(() => null)) as
      | { ok?: boolean; why?: string; error?: string }
      | null;
    // Whatever happened, the card is redrawn: a press that landed has a new state to show, and
    // one that was refused because the event was answered elsewhere has one too.
    press.onPressed();
    if (said?.ok) return { ok: true };
    if (!said || said.why === "unavailable" || said.error === UNREACHABLE) {
      return { ok: false, error: press.unavailable };
    }
    // The service's own words. A refusal with none is a stale page rather than a sentence
    // anybody wrote.
    return { ok: false, error: said.error || press.refused };
  };

  return {
    // The card is on the read that drew this page, and saying so is what makes the page's own
    // re-read (`router.refresh()`) the redraw after a press.
    cardOnBoard: async () => true,
    // No runs here: a browser starts nothing, so there is nothing to poll for and the card
    // page's run log stays empty.
    listSessions: async () => [],
    getSession: async () => null,
    startAgent: record,

    readBoard: noSuchControl,
    patchCard: noSuchControl,
    dropVerify: noSuchControl,
    scheduleCard: noSuchControl,
    unscheduleCard: noSuchControl,
    createRelease: noSuchControl,
    planRelease: noSuchControl,
    dropRelease: noSuchControl,
    closeRelease: noSuchControl,
    setReleaseGoal: noSuchControl,
    stopSession: noSuchControl,
    resumeSession: noSuchControl,
    approveDelivery: noSuchControl,
    discardDelivery: noSuchControl,
    resumeDelivery: noSuchControl,
    resumeCloudRequest: noSuchControl,
    cancelCloudRequest: noSuchControl,
    readDrafts: noSuchControl,
    saveDraft: noSuchControl,
    repurpose: noSuchControl,
    setChannelStatus: noSuchControl,
    setChannels: noSuchControl,
    newTopic: noSuchControl,
    discardTopic: noSuchControl,
    commentOnDraft: noSuchControl,
    editDraftComment: noSuchControl,
    dropDraftComment: noSuchControl,
    polishDraft: noSuchControl,
  };
}
