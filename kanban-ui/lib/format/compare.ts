// Copied from cli/src/lib/compare.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// ---- a card's `<Compare>` marker (#1740) ------------------------------------------------------------
//
//   <Compare a=".assets/1734/source.mp4" b=".assets/1734/clone.mp4" label="Source vs clone" shots=".assets/1734/shots.json" />
//
// Two images or two videos from the card's asset folder, drawn together. `a-label` and `b-label`
// name each side; `shots` (videos only) is a JSON list that cuts the shared play bar per shot.

export type CompareTag = { a: string; b: string; label: string; aLabel: string; bLabel: string; shots: string }
export type Shot = { id: string; start: number; end: number; name: string }

export const COMPARE_IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']
export const COMPARE_VIDEOS = ['mp4', 'webm', 'mov']

const TAG = /^<Compare\b([^<>]*?)\/>$/
const ATTR = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** The attributes of a block that is exactly one `<Compare … />` tag — `null` for anything else. */
export function compareAttrs(raw: string): Record<string, string> | null {
  const m = TAG.exec(raw.trim())
  if (!m) return null
  const attrs: Record<string, string> = {}
  for (const a of m[1]!.matchAll(ATTR)) attrs[a[1]!] = (a[2] ?? a[3])!
  return attrs
}

/** The tag a block holds, when it is one `<Compare>` naming both sides. */
export function compareTag(raw: string): CompareTag | null {
  const attrs = compareAttrs(raw)
  if (!attrs?.a || !attrs.b) return null
  return { a: attrs.a, b: attrs.b, label: attrs.label ?? '', aLabel: attrs['a-label'] ?? '', bLabel: attrs['b-label'] ?? '', shots: attrs.shots ?? '' }
}

export function compareKind(src: string): 'image' | 'video' | null {
  const ext = src.split('.').pop()!.toLowerCase()
  return COMPARE_IMAGES.includes(ext) ? 'image' : COMPARE_VIDEOS.includes(ext) ? 'video' : null
}

/** What is wrong with a shots list, or null: `[{ "id": "S1", "start": 0, "end": 2.25, "name": "…" }, …]`,
 *  ids unique, each shot starting where the one before it ends. */
export function shotsProblem(data: unknown): string | null {
  const shape = 'Write a JSON list of { "id": "S1", "start": 0, "end": 2.25, "name": "..." }, in order, each shot starting where the one before ends.'
  if (!Array.isArray(data) || data.length === 0) return `shots is not a non-empty JSON list. ${shape}`
  const ids = new Set<string>()
  let at = 0
  for (const [i, s] of data.entries()) {
    const ok = s && typeof s === 'object' && typeof s.id === 'string' && s.id && typeof s.name === 'string' && s.name && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start
    if (!ok) return `Shot ${i + 1} is malformed. ${shape}`
    if (ids.has(s.id)) return `Shot id ${s.id} is repeated. Give every shot its own id.`
    ids.add(s.id)
    if (Math.abs(s.start - at) > 0.01) return `Shot ${s.id} starts at ${s.start}s, but the one before ends at ${at}s. ${shape}`
    at = s.end
  }
  return null
}

/** The shots a file's text holds, or null when it is not a valid list. */
export function parseShots(text: string): Shot[] | null {
  try {
    const data: unknown = JSON.parse(text)
    return shotsProblem(data) ? null : (data as Shot[])
  } catch {
    return null
  }
}
