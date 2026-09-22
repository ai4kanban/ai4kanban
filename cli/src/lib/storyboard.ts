// ---- a card's storyboard marker (#963) -----------------------------------------------------------
//
//   <Storyboard src=".assets/963/storyboard.json" />
//
// The tag stands alone in its paragraph and points at a JSON file in the card's asset folder.
// The file's contract is its owner agent's: scriptwriter and deck-planner each ship
// `scripts/validate-storyboard.mjs` (#992). The board only finds the marker and its path.

const TAG = /^<Storyboard\b([^<>]*?)\/>$/
const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/
const SEGMENT = /^(?!\.)[^/\\]+$/

/** The `src` of a block that is exactly one `<Storyboard … />` tag — `null` for anything else. */
export function storyboardTag(raw: string): string | null {
  const m = TAG.exec(raw.trim())
  if (!m) return null
  const src = SRC_ATTR.exec(m[1]!)
  return src ? (src[1] ?? src[2])! : null
}

/** Every tag standing alone in its paragraph, outside fenced blocks, with its 1-based line. */
export function storyboardMarkers(body: string): { src: string; line: number }[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const found: { src: string; line: number }[] = []
  let fence: string | null = null
  lines.forEach((line, i) => {
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (delimiter && delimiter[1]![0] === fence[0] && delimiter[1]!.length >= fence.length) fence = null
      return
    }
    if (delimiter) { fence = delimiter[1]!; return }
    const src = storyboardTag(line)
    if (src !== null && !lines[i - 1]?.trim() && !lines[i + 1]?.trim()) found.push({ src, line: i + 1 })
  })
  return found
}

/** The file name a same-card `.assets/<card>/<name>` path points at, or why it may not.
 *  `nested` lets the name sit in a subfolder, `previews/cover.png`. */
export function assetName(src: string, cardId: number, exts: readonly string[], nested = false): { name: string } | { expected: string; actual: string } {
  const expected = `.assets/${cardId}/<file>.${exts.length === 1 ? exts[0] : `{${exts.join(',')}}`} in this card's asset folder`
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return { expected, actual: `an external address ${JSON.stringify(src)}` }
  const parts = src.split('/')
  if (parts[0] !== '.assets' || parts.length < 3 || (!nested && parts.length !== 3)) return { expected, actual: JSON.stringify(src) }
  if (parts[1] !== String(cardId)) return { expected, actual: `another card's folder ${JSON.stringify(parts[1])}` }
  if (!parts.slice(2).every((part) => SEGMENT.test(part))) return { expected, actual: JSON.stringify(src) }
  const name = parts.slice(2).join('/')
  const ext = name.split('.').pop()!.toLowerCase()
  if (!name.includes('.') || !exts.includes(ext)) return { expected, actual: `file type ${JSON.stringify(name.includes('.') ? ext : '')}` }
  return { name }
}
