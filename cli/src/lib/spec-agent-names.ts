// What a spec agent is called, and what it used to be called.
//
// Its own file, with no imports, because two sides need it and neither can import the
// other: `lib/agents/` is the catalog, and `lib/agent/runtime.ts` reads one agent's saved
// runtime out of the board's file before any of that catalog is loaded.

const LEGACY_SPEC_AGENT_NAMES: Record<string, string> = {
  'recommend-tech-stack': 'technology-selection',
}

/** The name a spec agent goes by now, for a name it may have gone by before. */
export const canonicalSpecAgent = (name: string): string => {
  const asked = name.trim()
  return LEGACY_SPEC_AGENT_NAMES[asked] ?? asked
}

/** The current name first, followed by names accepted for backward compatibility. */
export const specAgentNames = (name: string): string[] => {
  const canonical = canonicalSpecAgent(name)
  return [
    canonical,
    ...Object.entries(LEGACY_SPEC_AGENT_NAMES)
      .filter(([, current]) => current === canonical)
      .map(([legacy]) => legacy),
  ]
}
