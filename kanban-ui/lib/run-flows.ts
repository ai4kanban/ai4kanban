// One job, not six runs.
//
// Most things the board does take more than one session: a refine is a question audit and a
// writing pass, a create is the cards plus a refinement of each, a revise hands its card to
// a refinement when it is done, a build is followed by its review. Each session is an
// ordinary run with its own log — right for the record, wrong for the panel, where six rows
// about one job read as six unrelated jobs. The record ties them together with `flowId`;
// this groups by it.
//
// A job that took one session is still a flow — a flow of one, drawn as the single row it
// always was.
//
// A DELIVERY is a job the same way, and it is the stronger fact (#417): its runs are handed
// back by whichever watcher happened to be closing, so the stored `flowId` on one of them
// can be another card's. Every run that belongs to a delivery is therefore grouped by the
// delivery it names — which also redraws runs recorded before that was true, without any
// record being rewritten.

import type { RunsCopy } from "@/i18n/runs/types";
import type { AgentAction, ReviewTrigger, SessionView } from "./types";

export interface RunFlow {
  /** The flow's id — the delivery's when its sessions belong to one, the stored flow id
   *  otherwise, or the session's own for a run recorded before flows. */
  id: string;
  cardId: number | null;
  /** Its sessions, oldest first — the order they ran in. */
  sessions: SessionView[];
  /** The first session: the command the user typed, which is what the whole flow is. */
  root: SessionView;
  /** The newest session, whose state IS the flow's: a job is going while its current
   *  session is, and it ended however its last one ended. */
  latest: SessionView;
  /** When the job started — its first session, not its latest. */
  startedAt: number;
}

/** Every run the panel shows, grouped into flows, newest activity first. */
export function runFlows(sessions: SessionView[]): RunFlow[] {
  const byId = new Map<string, RunFlow>();
  const flows: RunFlow[] = [];
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const id = groupOf(s);
    const found = byId.get(id);
    if (found) {
      found.sessions.push(s);
      found.latest = s;
      continue;
    }
    const flow: RunFlow = {
      id,
      cardId: s.cardId,
      sessions: [s],
      root: s,
      latest: s,
      startedAt: s.startedAt,
    };
    byId.set(id, flow);
    flows.push(flow);
  }
  return flows.sort((a, b) => b.latest.startedAt - a.latest.startedAt);
}

/** The job one session belongs to. The delivery wins where there is one: a run of a
 *  delivery is that delivery's work whatever flow the watcher that started it was in. A run
 *  naming no delivery keeps its stored flow, so everything recorded before this — a
 *  refinement among them — is drawn exactly where it always was. */
const groupOf = (s: SessionView): string => s.deliveryId ?? s.flow?.id ?? s.sessionId;

/** The words the labels below are said in — `runs` out of the copy module. */
export type RunLabels = Pick<RunsCopy, "step" | "flow" | "trigger">;

/** The flow one session belongs to. */
export function flowOf(flows: RunFlow[], sessionId: string | null): RunFlow | null {
  if (!sessionId) return null;
  return flows.find((f) => f.sessions.some((s) => s.sessionId === sessionId)) ?? null;
}

/** An action as a person reads it. A session of a job is named by its action, so a step
 *  reads the same as a standalone run of it. */
export function stepLabel(action: AgentAction, copy: RunLabels): string {
  return copy.step[action];
}

/** Why a review after the first one started (#417), in words — nothing for the first
 *  review after a build, which is the default, and nothing for a trigger this build has no
 *  word for: a start site shipped later says its own reason without touching the display. */
export const triggerLabel = (trigger: ReviewTrigger | undefined, copy: RunLabels): string =>
  (trigger && copy.trigger[trigger]) || "";

/** The flow's own name — the command a user would have typed for it, which is the session
 *  it opened with. What came after is what the job went on to do, not what it is. */
export const flowLabel = (flow: RunFlow, copy: RunLabels): string =>
  copy.flow[flow.root.action] ?? copy.step[flow.root.action];

/** What a flow with no card is called instead of `#id` (#428): the sentence the user typed
 *  to start it, which is the only account of what it was for. A build with no card has one,
 *  and so does a create — which showed a dash until now. Empty when the flow was started
 *  with no words at all (a propose, a setup), and the dash is right for those. */
export const flowSaid = (flow: RunFlow): string => (flow.root.input ?? "").trim();
