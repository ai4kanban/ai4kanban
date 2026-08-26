import type { Subtask } from "./types";

/** One subtask as the map draws it: which column it sits in, and whether anything outside
 *  the group is still in its way. */
export interface MapNode {
  id: number;
  title: string;
  /** Column, counting from 0. Blockers come before what they block. */
  layer: number;
  /** `blocked_by` ids that name no chip in the map — the map cannot show them, so the chip
   *  says it is waiting on something. Empty when nothing outside is in the way. */
  outside: number[];
}

/** One `blocked_by` entry naming another subtask in the same group: `from` must be done
 *  before `to` can start. */
export interface MapEdge {
  from: number;
  to: number;
}

export interface SubtaskMap {
  nodes: MapNode[];
  edges: MapEdge[];
  /** How many columns the map has. */
  layers: number;
}

/** Lay a group's subtasks out in build order, or return `null` when there is nothing to
 *  draw — one subtask, or no subtask naming a blocker inside the group. A map with no line
 *  in it would only repeat the list beneath it.
 *
 *  A subtask with no in-group blocker starts in column 0; every other one lands one column
 *  past the last thing it waits on. Subtasks that block each other leave a knot no column
 *  can place — those go in one final column with their edges as they are, so the loop is
 *  visible and no chip is lost. */
export function buildSubtaskMap(subtasks: Subtask[]): SubtaskMap | null {
  const inGroup = new Set(subtasks.map((s) => s.id));
  const blockers = new Map<number, number[]>();
  const edges: MapEdge[] = [];
  const outside = new Map<number, number[]>();

  for (const s of subtasks) {
    // A card names itself only by mistake, and it can never clear — the same entry
    // `attachBlockers` drops when it works out what really blocks a card. Deduped: a
    // hand-edited card can name a blocker twice, and that is one line, not two.
    const named = [...new Set(s.blocked_by)].filter((n) => n !== s.id);
    const inside = named.filter((n) => inGroup.has(n));
    blockers.set(s.id, inside);
    outside.set(
      s.id,
      named.filter((n) => !inGroup.has(n)),
    );
    for (const b of inside) edges.push({ from: b, to: s.id });
  }
  if (edges.length === 0) return null;

  // Longest-path layering, one column at a time: a subtask is placed once everything it
  // waits on has a column, and sits one past the furthest of them.
  const layer = new Map<number, number>();
  let column = 0;
  let placedThisRound = subtasks.filter((s) => (blockers.get(s.id) ?? []).length === 0);
  while (placedThisRound.length > 0) {
    for (const s of placedThisRound) layer.set(s.id, column);
    column += 1;
    placedThisRound = subtasks.filter(
      (s) => !layer.has(s.id) && (blockers.get(s.id) ?? []).every((b) => layer.has(b)),
    );
  }
  // Whatever is left is in a cycle. One last column holds all of it.
  const knot = subtasks.filter((s) => !layer.has(s.id));
  for (const s of knot) layer.set(s.id, column);
  const layers = knot.length > 0 ? column + 1 : column;

  const nodes = subtasks
    .map<MapNode>((s) => ({
      id: s.id,
      title: s.title,
      layer: layer.get(s.id) ?? 0,
      outside: outside.get(s.id) ?? [],
    }))
    // Inside a column, by id — the order the subtasks list beneath already uses, so the eye
    // moves between the picture and the list without re-sorting.
    .sort((a, b) => a.layer - b.layer || a.id - b.id);

  return { nodes, edges, layers };
}
