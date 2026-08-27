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

import type { AgentAction, SessionView } from "./types";

export interface RunFlow {
  /** The flow's id — or the session's own, for a run recorded before flows. */
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
    const id = s.flow?.id ?? s.sessionId;
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

/** The flow one session belongs to. */
export function flowOf(flows: RunFlow[], sessionId: string | null): RunFlow | null {
  if (!sessionId) return null;
  return flows.find((f) => f.sessions.some((s) => s.sessionId === sessionId)) ?? null;
}

// The actions the board keeps under a different name from the command a person types. Only
// the ones that differ are here; everything else reads the same either way.
const COMMAND_NAME: Partial<Record<AgentAction, string>> = {
  edit: "Revise",
  "raise-questions": "Refine",
  writing: "Refine",
};

/** An action as a person reads it: "raise-questions" → "Raise questions". A session of a
 *  job is named by its action, so a step reads the same as a standalone run of it. */
export function stepLabel(action: AgentAction): string {
  const words = action.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The flow's own name — the command a user would have typed for it, which is the session
 *  it opened with. What came after is what the job went on to do, not what it is. */
export const flowLabel = (flow: RunFlow): string =>
  COMMAND_NAME[flow.root.action] ?? stepLabel(flow.root.action);
