// Storyboard 与 Workflow 标签独占段落，label 为可选标题。

const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`)
const SRC_ATTR = attr('src')
const LABEL_ATTR = attr('label')

/** The `src` and `label` of a block that is exactly one `<name … />` tag — `null` for anything else. */
const blockTag = (name: string) => {
  const tag = new RegExp(`^<${name}\\b([^<>]*?)\\/>$`)
  return (raw: string): { src: string; label?: string } | null => {
    const m = tag.exec(raw.trim())
    if (!m) return null
    const src = SRC_ATTR.exec(m[1]!)
    if (!src) return null
    const label = LABEL_ATTR.exec(m[1]!)
    const text = label ? (label[1] ?? label[2])!.trim() : ''
    return { src: (src[1] ?? src[2])!, ...(text ? { label: text } : {}) }
  }
}

export const storyboardAttrs = blockTag('Storyboard')
export const workflowAttrs = blockTag('Workflow')
