// What a card page opening can draw before the server has read the card (#906): the window
// the last page was drawn in, the titles the reader has seen, and whether the skeleton was
// up long enough to be seen — the one case the card's content fades in over it.

import type { AgentInfo, MemoryOwner } from "./types";

export type CardFrame = {
  projectRoot: string;
  openIds: number[];
  memoryOwners: MemoryOwner[];
  goalWritten: boolean;
  agent: AgentInfo;
  desktop: boolean;
};

let frame: CardFrame | null = null;
const titles = new Map<number, string>();
let skeletonSeen = false;

export const cardOpen = {
  rememberFrame(next: CardFrame) {
    frame = next;
  },
  frame: () => frame,
  rememberTitle(id: number, title: string) {
    if (title) titles.set(id, title);
  },
  title: (id: number) => titles.get(id) ?? "",
  /** Set by the opening screen once its skeleton is up, cleared once the page has read it. */
  setSkeleton(seen: boolean) {
    skeletonSeen = seen;
  },
  skeletonSeen: () => skeletonSeen,
};
