// Reading and writing a single YAML-ish scalar — the shared bottom layer under both
// the frontmatter and the questions modules.

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
