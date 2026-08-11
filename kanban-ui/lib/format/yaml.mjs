// Copied from skill/lib/yaml.mjs by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// Reading and writing a single YAML-ish scalar — the shared bottom layer under both
// the frontmatter and the questions modules.
//
// The local UI does not carry a second copy: this file is copied there, to
// `kanban-ui/lib/format/`, by `scripts/sync-format.mjs`. A card the script quotes
// one way and the UI quotes another is a card that changes on every save, so
// there is one implementation and it is this one.

export function yamlScalar(s) {
  s = String(s)
  if (s === '') return '""'
  // Quote anything that could confuse a YAML reader; otherwise keep it plain.
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:\s/.test(s) || /[\n"]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

export function unquote(v) {
  v = String(v).trim()
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v)
    } catch {
      return v.slice(1, -1)
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
  return v
}
