// ---- the shape a `<Mockup>` tag has to be in --------------------------------
//
// A card body draws a mockup only where the tag stands alone in its own paragraph:
//
//   <Mockup src=".mockups/306/a.tsx" label="A" />
//
//   Folded rows: fourteen one-line rows …
//
// The board's reader refuses a block that holds anything besides tags, so a tag with its
// tradeoff line pushed up against it is swallowed into the paragraph and printed as text.
// A spec agent gets that wrong often enough that the shape is repaired here rather than
// asked for — `spec-write` runs this over every section it takes.

// A self-closing tag with no `<` or `>` inside it, the same one the reader matches.
const TAG = /<Mockup\b[^<>]*?\/>/
const FENCE = /^\s*(```|~~~)/

/** The leading run of tags on a line, and whatever prose follows them — `null` when the
 *  line does not start with a tag, so a tag quoted mid-sentence stays where it was. */
function splitTagLine(line: string): { tags: string[]; rest: string } | null {
  let rest = line.trim()
  const tags: string[] = []
  for (;;) {
    const m = rest.match(TAG)
    if (!m || m.index !== 0) break
    tags.push(m[0])
    rest = rest.slice(m[0].length).trim()
  }
  return tags.length ? { tags, rest } : null
}

/** Put every mockup tag in its own paragraph: one per line, a blank line on each side, and
 *  any prose that shared the line moved below it. Fenced blocks are left alone, where a tag
 *  is deliberately text. Returns the body unchanged when nothing needed moving. */
export function fixMockupBlocks(body: string): string {
  if (!TAG.test(body)) return body
  const out: string[] = []
  let fence: string | null = null
  let justFixed = false

  const blank = (): void => {
    if (out.length && out[out.length - 1]!.trim() !== '') out.push('')
  }

  for (const line of body.split('\n')) {
    const opener = line.match(FENCE)
    if (fence) {
      out.push(line)
      if (opener && line.trim().startsWith(fence)) fence = null
      justFixed = false
      continue
    }
    if (opener) {
      out.push(line)
      fence = opener[1]!
      justFixed = false
      continue
    }

    const split = splitTagLine(line)
    if (!split) {
      // A blank line right after a block we just spaced out would double up.
      if (!(justFixed && line.trim() === '')) out.push(line)
      justFixed = false
      continue
    }
    for (const tag of split.tags) {
      blank()
      out.push(tag)
      out.push('')
    }
    if (split.rest) out.push(split.rest)
    justFixed = true
  }
  return out.join('\n')
}
