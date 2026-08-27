// One refinement, not six runs.
//
// A refine is a loop (the CLI's agent/refine.ts): a question audit, a resolver, an audit
// again, and one writing pass to close it. Each pass is an ordinary run with its own log —
// right for the record, wrong for the panel, where six rows about one card read as six
// unrelated jobs. The record ties them together with `flowId`; this groups by it.
//
// Everything else is a group of one: a run carrying no flow is its own row, exactly as it
// was.

import type { AgentAction, SessionView } from "./types";

export interface RunFlow {
  /** The flow's id — or the session's own, for a run that stands alone. */
  id: string;
  /** A refinement, or one ordinary run. */
  kind: "refine" | null;
  cardId: number | null;
  /** Its passes, oldest first — the order the loop ran in. */
  sessions: SessionView[];
  /** The newest pass, whose state IS the flow's: a loop is going while its current pass is,
   *  and it ended however its last pass ended. */
  latest: SessionView;
  /** When the loop started — its first pass, not its latest. */
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
      kind: s.flow?.kind ?? null,
      cardId: s.cardId,
      sessions: [s],
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

/** An action as a person reads it: "raise-questions" → "Raise questions". A pass of a loop
 *  is named by its action too, so a step reads the same as a standalone run of it. */
export function stepLabel(action: AgentAction): string {
  const words = action.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The flow's own name — the command a user would have typed for it. */
export const flowLabel = (flow: RunFlow): string =>
  flow.kind === "refine" ? "Refine" : stepLabel(flow.latest.action);
