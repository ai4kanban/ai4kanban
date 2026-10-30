// A card's comments rail, read the same on the review page and the card page: comments,
// send-backs and content updates of every phase, oldest first, with what this reader has not
// seen yet. On a card with more than one approval each entry names its phase.

import { useEffect, useMemo, useState } from "react";
import type { Author, Comment, Decision } from "../api";
import { COPY } from "../i18n";
import type { Entry } from "./chat";
import { DISCUSSION } from "./questions";

export const nameOf = (a: Author) => (a.kind === "reviewer" ? (a.handle ? `@${a.handle}` : a.email) : a.kind === "user" ? `@${a.handle}` : a.name);

/** When this reader last looked at the comments under `key`. */
const seenKey = (key: string) => `wildcrane.review.seen.${key}`;
const readSeen = (key: string) => localStorage.getItem(seenKey(key)) ?? "";

/** One "content updated" per round: the last revision before the next decision, and only
 *  after a decision — uploads before the first review are not updates to anyone. */
function updates<R extends { revision: number }>(revisions: R[], decisions: { review_revision: number | null }[]): R[] {
  const decided = decisions.map((d) => d.review_revision).filter((n): n is number => n !== null).sort((a, b) => a - b);
  const rounds = new Map<number, R>();
  for (const r of revisions) {
    const round = decided.filter((n) => n < r.revision).length;
    if (round > 0) rounds.set(round, r);
  }
  return [...rounds.values()];
}

export function useThread({
  key,
  comments,
  decisions,
  revisions,
  rounds,
  owner,
  me,
  open,
}: {
  key: string;
  comments: Comment[];
  decisions: Decision[];
  revisions: { revision: number; phase: number; created_at: string }[];
  /** How many approvals the card makes; a card with one names no phase. */
  rounds?: number;
  /** Who started the task, the author of every update. */
  owner: string;
  me: { email: string | null; handle: string | null } | null;
  open: boolean;
}) {
  const c = COPY;
  const mine = (a: Author) => !!me && ((a.kind === "reviewer" && a.email === me.email) || (a.kind === "user" && a.handle === me.handle));
  const [seen, setSeen] = useState(() => readSeen(key));
  const [freshFrom, setFreshFrom] = useState(seen);
  useEffect(() => {
    const was = readSeen(key);
    setSeen(was);
    setFreshFrom(was);
  }, [key]);
  const phaseOf = (n: number) => ((rounds ?? 0) > 1 ? c.phase(n) : undefined);
  const thread = useMemo(() => {
    const all: (Entry & { mine: boolean })[] = [
      ...comments.map((x) => ({ key: x.id, who: nameOf(x.author), at: x.created_at, when: c.when(x.created_at), text: x.body, phase: phaseOf(x.phase), mine: mine(x.author) })),
      ...decisions
        .filter((d) => d.decision === "request_changes")
        .map((d) => ({ key: d.id, who: nameOf(d.decided_by), at: d.created_at, when: c.when(d.created_at), text: d.comment.split(DISCUSSION)[0]!, mark: "rejected" as const, phase: phaseOf(d.phase), mine: mine(d.decided_by) })),
      ...updates(revisions, decisions).map((r) => ({ key: `rev${r.revision}`, who: `@${owner}`, at: r.created_at, when: c.when(r.created_at), mark: "updated" as const, phase: phaseOf(r.phase), mine: me?.handle === owner })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return all.map((e) => ({ ...e, fresh: !!freshFrom && !e.mine && e.at > freshFrom }));
  }, [comments, decisions, revisions, rounds, owner, me, freshFrom]);
  const latest = thread.at(-1)?.at ?? "";
  const unread = thread.some((e) => !e.mine && e.at > seen) && !!(seen || thread.some((e) => !e.mine));

  // Opening the rail reads everything in it; the rule stays where the unread began.
  useEffect(() => {
    if (!open || !latest || latest <= seen) return;
    localStorage.setItem(seenKey(key), latest);
    setSeen(latest);
  }, [open, latest, seen, key]);
  return { thread, unread, opening: () => setFreshFrom(seen) };
}
