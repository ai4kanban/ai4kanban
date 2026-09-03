// What a spec skill is called, and what it used to be called.
//
// Its own file, with no imports, because two sides need it and neither can import the
// other: `lib/spec-skills/` is the catalog, and `lib/agent/runtime.ts` reads one skill's
// saved runtime out of the board's file before any of that catalog is loaded.

const LEGACY_SPEC_SKILL_NAMES: Record<string, string> = {
  'recommend-tech-stack': 'technology-selection',
}

/** The name a spec skill goes by now, for a name it may have gone by before. */
export const canonicalSpecSkill = (name: string): string => {
  const asked = name.trim()
  return LEGACY_SPEC_SKILL_NAMES[asked] ?? asked
}

/** The current name first, followed by names accepted for backward compatibility. */
export const specSkillNames = (name: string): string[] => {
  const canonical = canonicalSpecSkill(name)
  return [
    canonical,
    ...Object.entries(LEGACY_SPEC_SKILL_NAMES)
      .filter(([, current]) => current === canonical)
      .map(([legacy]) => legacy),
  ]
}
