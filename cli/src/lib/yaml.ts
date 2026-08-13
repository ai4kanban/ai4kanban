// Reading and writing a single YAML-ish scalar — the shared bottom layer under both
// the frontmatter and the questions modules.
//
// The local UI does not carry a second copy: this file is copied there, to
// `kanban-ui/lib/format/`, by `scripts/sync-format.mjs`. A card the script quotes
// one way and the UI quotes another is a card that changes on every save, so
// there is one implementation and it is this one.

export function yamlScalar(s: unknown): string {
  const text = String(s)
  if (text === '') return '""'
  // Quote anything that could confuse a YAML reader; otherwise keep it plain.
  if (
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(text) ||
    /:\s/.test(text) ||
    /[\n"]/.test(text) ||
    /^\s|\s$/.test(text)
  ) {
    return JSON.stringify(text)
  }
  return text
}

export function unquote(v: unknown): string {
  const text = String(v).trim()
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text) as string
    } catch {
      return text.slice(1, -1)
    }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1)
  return text
}
