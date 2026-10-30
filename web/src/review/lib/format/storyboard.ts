// Copied from legacy kanban-ui/lib/format/storyboard.ts: the marker only.
//
//   <Storyboard src=".assets/963/storyboard.json" label="3:4" />
//
// The tag stands alone in its paragraph; `label` is an optional heading that tells several on
// one card apart (#1117).

const TAG = /^<Storyboard\b([^<>]*?)\/>$/
const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`)
const SRC_ATTR = attr('src')
const LABEL_ATTR = attr('label')

/** The `src` and `label` of a block that is exactly one `<Storyboard … />` tag — `null` for
 *  anything else. */
export function storyboardAttrs(raw: string): { src: string; label?: string } | null {
  const m = TAG.exec(raw.trim())
  if (!m) return null
  const src = SRC_ATTR.exec(m[1]!)
  if (!src) return null
  const label = LABEL_ATTR.exec(m[1]!)
  const text = label ? (label[1] ?? label[2])!.trim() : ''
  return { src: (src[1] ?? src[2])!, ...(text ? { label: text } : {}) }
}
