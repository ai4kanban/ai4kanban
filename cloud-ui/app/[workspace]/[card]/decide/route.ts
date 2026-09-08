// The one thing a browser changes about a board (#364).
//
// A signed-in member approves a delivery for review, or answers a card's open questions. The
// press is recorded as the one durable action the card's live Cloud event carries — the same
// shape the app, Slack and Lark record — and the first surface to act settles it.
//
// It is a route handler rather than a call from the page because the session is an `httpOnly`
// cookie: a script cannot read it, so the token stays on this server and nothing on the page
// ever carries one. `SameSite=Lax` is what refuses a cross-site press, which is the same thing
// that makes `/signout` a form rather than a link.
//
// Nothing here decides anything. Whether this account may act, whether the event has already
// been answered and whether the revision still binds are all the service's answers, asked on
// every press.

import { type NextRequest, NextResponse } from "next/server";
import { UNREACHABLE, pressEvent, type EventAnswer, type Press } from "../../../../lib/cloud";
import { SESSION_COOKIE, decodeSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/** What the page sends. `revision` is the one it DREW the card at — a card rewritten under an
 *  open page costs a refusal rather than a build against a specification nobody approved. */
interface Ask {
  eventId?: unknown;
  decision?: unknown;
  revision?: unknown;
  answers?: unknown;
  opId?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  // Signed out is the refusal a stranger meets, in the service's own vocabulary: the page
  // draws it as a refusal and sends the reader back through the sign-in.
  if (!session) return answer({ ok: false, why: "refused", error: "" });

  const ask = ((await request.json().catch(() => null)) ?? {}) as Ask;
  const eventId = typeof ask.eventId === "string" ? ask.eventId.trim() : "";
  const decision = ask.decision === "answer" ? "answer" : "implement";
  const revision = typeof ask.revision === "string" ? ask.revision : "";
  // A press with nothing to press on is this page being out of date rather than a refusal
  // anybody wrote — the card has moved, and the redraw that follows says what it is now.
  if (!eventId || !revision) return answer({ ok: false, why: "refused", error: "" });

  return answer(
    await pressEvent(eventId, session.accessToken, {
      // The attempt this press is, so a retry the reader never saw fail is recognised rather
      // than refused as a second action.
      opId: typeof ask.opId === "string" && ask.opId ? ask.opId.slice(0, 200) : crypto.randomUUID(),
      decision,
      revision,
      answers: answersIn(ask.answers),
    }),
  );
}

/** One answer per question the event carries, in its own order, blanks included. The board's
 *  own rule holds here too: a ticked option or the user's own words, never both. */
function answersIn(value: unknown): EventAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((raw) => {
    const held = (raw ?? {}) as { picked?: unknown; text?: unknown };
    const picked = Array.isArray(held.picked)
      ? held.picked.map(Number).filter((n) => Number.isInteger(n) && n >= 1).slice(0, 20)
      : [];
    const text = typeof held.text === "string" ? held.text.slice(0, 4000) : "";
    return picked.length > 0 ? { picked, text: "" } : { picked: [], text };
  });
}

/** Always a 200 carrying the outcome. The page reads `ok` and, where it is false, tells a
 *  refusal from an outage — a status code would leave the browser's own error handling
 *  deciding which of the two a reader is shown. */
const answer = (press: Press): NextResponse =>
  NextResponse.json(
    press.ok
      ? { ok: true, state: press.state }
      : { ok: false, why: press.why, error: press.error || (press.why === "unavailable" ? UNREACHABLE : "") },
  );
