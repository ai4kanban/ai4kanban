// `akb.icon` (#455): a sticker of the agent's deliverable — a name from web's glyph library
// (web/src/review/lib/agent-glyphs.ts, which holds the path data), or up to 12 parts drawn by its rules.

import type { YamlValue } from './yaml.ts'

/** The glyph names web draws; keep in step with `GLYPHS` there. An unknown one draws `file`. */
export const ICON_NAMES = [
  'file', 'text', 'article', 'outline', 'script', 'prompt', 'email', 'image', 'post-image', 'social-image', 'cover',
  'carousel', 'carousel-outline', 'slides', 'wireframe', 'screen', 'video', 'storyboard', 'template', 'shots', 'api',
  'schema', 'compare', 'stack', 'workflow', 'code', 'checklist', 'card', 'plan', 'proposal', 'dismissed', 'inbox',
  'notebook', 'squeeze', 'folder', 'reply', 'feedback', 'software', 'product-video', 'social-post', 'blog', 'deck',
  'video-clone', 'workflow-kit',
] as const

/** The palette keys a part may colour with. */
export const ICON_COLORS = ['k', 'w', 'c', 'g', 'o', 'p', 's', 'm', 'l', 'r', 'y'] as const
type IconColor = (typeof ICON_COLORS)[number]

/** One path: `f` fill, `o` the ink outline, `s`/`w` a thick coloured stroke. */
export interface IconPart {
  d: string
  f?: IconColor
  o?: true
  s?: IconColor
  w?: number
}

export type AgentIcon = string | IconPart[]

const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/
const isColor = (v: string): v is IconColor => (ICON_COLORS as readonly string[]).includes(v)

/** The icon, or why it can't be one. Absent reads as undefined. */
export function readIcon(raw: YamlValue | undefined): AgentIcon | undefined | { problem: string } {
  if (raw === undefined || raw === '') return undefined
  if (typeof raw === 'string') return (ICON_NAMES as readonly string[]).includes(raw.trim()) ? raw.trim() : { problem: `"${raw}" is not a glyph name` }
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) return { problem: 'the value is neither a glyph name nor a list of 1 to 12 parts' }
  const parts: IconPart[] = []
  for (const [i, item] of raw.entries()) {
    const at = `part ${i + 1}`
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { problem: `${at} is not a map of \`d\`, \`f\`, \`o\`, \`s\`, \`w\`` }
    const { d, f, o, s, w, ...extra } = item as Record<string, YamlValue>
    if (Object.keys(extra).length) return { problem: `${at} has \`${Object.keys(extra).join('`, `')}\`` }
    if (typeof d !== 'string' || !PATH.test(d)) return { problem: `${at} has no \`d\` of SVG path commands and numbers` }
    const part: IconPart = { d: d.trim() }
    for (const [key, value] of [['f', f], ['s', s]] as const) {
      if (value === undefined) continue
      if (typeof value !== 'string' || !isColor(value)) return { problem: `${at} colours \`${key}\` with "${String(value)}"` }
      part[key] = value
    }
    if (o !== undefined) {
      if (o !== 'true') return { problem: `${at} has \`o: ${String(o)}\`, not \`true\`` }
      part.o = true
    }
    if (w !== undefined) {
      const width = typeof w === 'string' ? Number(w) : NaN
      if (!(width > 0 && width <= 3)) return { problem: `${at} has \`w: ${String(w)}\`, not above 0 and up to 3` }
      part.w = width
    }
    parts.push(part)
  }
  return parts
}
