"use client";

// What an agent is CALLED — one answer, for every screen (#756).
//
// It used to be three. The Agents pane and the Workflows pane each worked the name out from
// the roster they had just read; the runs list and the office scene knew only the agent's
// id, so they named the roles and spelled every other agent's id out in English — which is
// how `ui-designer` wore a nameplate reading "UI designer" beside a pane calling it
// 界面设计师.
//
// `useAgentName()` is the only way to name one now. Three answers, in order:
//
//   1. a role — one of the closed set the command ships, named by this app's own copy;
//   2. an agent that is a file — named by its own `AGENT.md` under `akb.i18n`, already
//      picked for this language by the board;
//   3. anything else — its own id, spelled out. Right in English, and never a blank.
//
// A screen that has already read the roster passes the title it holds; one that has only a
// name gets it from `AgentTitles`, filled in the root layout from the board. A caller with
// no provider — a hosted board — lands on step 3, which is where it already was.

import { createContext, useCallback, useContext } from "react";
import { useCopy } from "@/i18n/use-copy";

/** Every agent that is a file, by name, in the language this app draws in. Empty until a
 *  provider fills it. */
const AgentTitles = createContext<Record<string, string>>({});

export function AgentTitlesProvider({
  titles,
  children,
}: {
  titles: Record<string, string>;
  children: React.ReactNode;
}) {
  return <AgentTitles.Provider value={titles}>{children}</AgentTitles.Provider>;
}

/** What to call the agent named `name`. `title` is what the caller already knows the agent
 *  says its name is — pass it where the roster is in hand, and leave it out otherwise. */
export function useAgentName(): (name: string, title?: string) => string {
  const roles = useCopy().configuration.agents.roles;
  const titles = useContext(AgentTitles);
  return useCallback(
    (name: string, title?: string) =>
      roles[name as keyof typeof roles]?.name || title || titles[name] || spellAgent(name),
    [roles, titles],
  );
}

/** An agent's own name, as a name rather than an id: `memory-pruner` → `Memory pruner`. */
export function spellAgent(name: string): string {
  return name
    .split("-")
    .map((word, index) => (index === 0 ? capitalise(word) : plain(word)))
    .join(" ");
}

const plain = (word: string) => (word.toLowerCase() === "ui" ? "UI" : word);
const capitalise = (word: string) => {
  const shown = plain(word);
  return shown ? shown[0].toUpperCase() + shown.slice(1) : shown;
};
