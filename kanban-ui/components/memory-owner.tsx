"use client";

// What a memory group is called (#805). An owner is the board itself or one agent, and an
// agent's name is the one Configuration already shows: a role's from this copy, a
// specialist's from its own `akb.i18n`. Named here so the rail and the phone screen say the
// same thing about the same group.

import type { AgentRoleName } from "@/i18n/configuration/types";
import { useCopy } from "@/i18n/use-copy";
import type { MemoryOwner } from "@/lib/types";

export function useMemoryOwnerName(owner: Pick<MemoryOwner, "agent" | "title">): string {
  const c = useCopy();
  if (!owner.agent) return c.rail.memory.board;
  const role = c.configuration.agents.roles[owner.agent as AgentRoleName];
  // A specialist says its own name; a role this copy has never heard of — one shipped after
  // the copy was written — is spelled out rather than drawn blank.
  return role?.name || owner.title || owner.agent;
}
