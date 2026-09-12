// Where every job stands in the office (#399).
//
// The Runs dialog draws one bot per job out of `runFlows(sessions)` — a live job at a desk,
// a recently finished one on the sofa. This module is the room's geometry and the rule for
// handing out its places, and nothing in it touches the DOM or PixiJS: the scene reads it,
// and so can a test.
//
// The one thing the allocation must never do is reshuffle. A poll arrives every second and
// a half; if the answer were recomputed from scratch each time, a job finishing at desk 3
// would slide every later bot one place left and the room would twitch. So a placement,
// once made, is kept until that job leaves, and only a job with no place is given one.

import type { SessionView } from "./types";

/** The office art's own pixels — every anchor below is in this space, and the scene maps it
 *  onto whatever the dialog's interior turns out to be. */
export const WORLD = { w: 1536, h: 1024 };

/** Eight desks to a room, and two seats on its sofa. */
export const DESKS = 8;
const SEATS = 2;

/** A bot's feet, in world pixels. */
export interface Spot {
  x: number;
  y: number;
}

const DESK_X = [345, 665, 980, 1302];
/** The room reads back row left to right, then front row — the order desks are filled in. */
const DESK_SPOTS: Spot[] = [
  ...DESK_X.map((x) => ({ x, y: 535 })),
  ...DESK_X.map((x) => ({ x, y: 770 })),
];
/** How far a paired worker stands from its desk's keyboard centre. Wide enough that the two
 *  never overlap: the robot is about 64 world pixels across. */
export const PAIR_OFFSET = 62;
export const SOFA_SPOTS: Spot[] = [
  { x: 1155, y: 925 },
  { x: 1280, y: 925 },
];
/** The clear floor bots walk along, and the doorway they come in and go out by. The aisle
 *  is the strip below the crates and the sofa — the only band of the room that is floor all
 *  the way across, so a bot crossing it passes in front of the furniture instead of through
 *  it. */
const AISLE_Y = 975;
const DOOR_X = 40;
/** The robot's drawn height in world pixels — 96 CSS px of cell at the dialog's full size,
 *  which is the scale the art was drawn for. Its feet are the anchor. */
export const BOT_HEIGHT = 115;
/** The share of the sprite's height above its ground line (`public/run-scene/README.md`). */
export const BOT_GROUND = 285 / 300;

export type Side = "solo" | "left" | "right";

/** Which desk in which room a job works at, and which half of it when the desk is shared. */
export interface Placement {
  room: number;
  desk: number;
  side: Side;
}

/** One bot in the room: a job, where it is, and what it is doing there. */
export interface SceneBot {
  /** The job's own id (`RunFlow.id`) — what the bot IS, kept across polls. */
  id: string;
  /** The session its log opens on: the one the job is currently on. */
  sessionId: string;
  cardId: number | null;
  /** The job's name, already in the reader's language. */
  label: string;
  /** The agent that ran it, as a name to show. */
  role: string;
  /** The connector's name, for its mark. */
  harness: string;
  status: SessionView["status"];
  working: boolean;
  room: number;
  spot: Spot;
}

/** Hand every live job a place, keeping the ones already placed exactly where they are.
 *
 *  Vacant desks first, in room and desk order; once every desk in every open room holds
 *  someone, the ninth job onwards pairs at the first desk with room for a partner. Only when
 *  even that is full does the office gain a room. */
export function placeWorkers(
  prev: ReadonlyMap<string, Placement>,
  live: readonly string[],
  openRooms: number,
): { places: Map<string, Placement>; rooms: number } {
  const places = new Map<string, Placement>();
  const taken = new Map<string, string[]>(); // "room:desk" -> the jobs at it
  let rooms = Math.max(1, openRooms);

  const key = (p: { room: number; desk: number }) => `${p.room}:${p.desk}`;
  const keep = (id: string, p: Placement) => {
    places.set(id, p);
    const at = taken.get(key(p));
    if (at) at.push(id);
    else taken.set(key(p), [id]);
  };

  for (const id of live) {
    const held = prev.get(id);
    if (held && held.room < rooms) keep(id, held);
  }

  for (const id of live) {
    if (places.has(id)) continue;
    const empty = scan(rooms, (p) => (taken.get(key(p))?.length ?? 0) === 0);
    if (empty) {
      keep(id, { ...empty, side: "solo" });
      continue;
    }
    const half = scan(rooms, (p) => (taken.get(key(p))?.length ?? 0) === 1);
    if (half) {
      // The sitting bot moves aside rather than the newcomer landing on top of it. A bot
      // already on one side keeps that side — only a `solo` one moves.
      const sitting = taken.get(key(half))![0];
      const settled = places.get(sitting)!;
      if (settled.side === "solo") places.set(sitting, { ...settled, side: "left" });
      keep(id, { ...half, side: places.get(sitting)!.side === "left" ? "right" : "left" });
      continue;
    }
    rooms += 1;
    keep(id, { room: rooms - 1, desk: 0, side: "solo" });
  }

  return { places, rooms };
}

function scan(rooms: number, fits: (p: { room: number; desk: number }) => boolean) {
  for (let room = 0; room < rooms; room++) {
    for (let desk = 0; desk < DESKS; desk++) {
      if (fits({ room, desk })) return { room, desk };
    }
  }
  return null;
}

/** Where a placement puts the bot's feet. */
export function deskSpot(place: Placement): Spot {
  const desk = DESK_SPOTS[place.desk];
  const shift = place.side === "left" ? -PAIR_OFFSET : place.side === "right" ? PAIR_OFFSET : 0;
  return { x: desk.x + shift, y: desk.y };
}

/** When a job finished, for ordering the sofa: its last session's end, falling back to when
 *  that session started for records kept before ends were written down. */
export function finishedAt(latest: SessionView): number {
  return latest.endedAt ?? latest.startedAt;
}

/** The two latest jobs that finished successfully — the ones still on the sofa. Ties are
 *  broken by id so the order never depends on which poll drew it. */
export function restingIds(done: readonly { id: string; at: number }[]): string[] {
  return [...done]
    .sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, SEATS)
    .map((d) => d.id);
}

/** The path a bot walks between the doorway and its place: out to the clear aisle, along
 *  it, then in. Returned door-first, so an arrival walks it forward and a departure back. */
export function walkPath(spot: Spot): Spot[] {
  return [
    { x: DOOR_X, y: AISLE_Y },
    { x: spot.x, y: AISLE_Y },
    spot,
  ];
}
