// The agent pages' public API. The route imports from here, never from the
// files beside it, so the inside can be rearranged without rewiring a page.

export type { AgentPage } from "./types";
export { getAgentPage, getAgentPages } from "./loader";

import type { AgentPage } from "./types";

/** Where the section is served. Everything else derives from this. */
export const AGENTS_PATH = "/agents";

/** The route a page is published at. */
export function agentPath(page: Pick<AgentPage, "slug">): string {
  return `${AGENTS_PATH}/${page.slug}`;
}
