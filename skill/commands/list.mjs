// ---- list ------------------------------------------------------------------
//
// The open board at a glance, one block per card — id, title, meta, summary line,
// and the file to read for the rest. `--module <m>` narrows it to the cards tagged
// with one module, which is how a propose run sees where a module already has
// effort without grepping frontmatter by hand.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO, MODULES_MD } from '../lib/paths.mjs'
import { parseFlags, moduleNames } from '../lib/validate.mjs'
import { parseFrontmatter } from '../lib/frontmatter.mjs'
import { walkMd, idPrefix } from '../lib/cards.mjs'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// The card's opening paragraph — the body's first non-heading text, unwrapped
// (bodies hard-wrap, so one paragraph spans several file lines). The body template
// puts the one-line summary there, so this is the card's own pitch.
function summaryLine(body) {
  const lines = body.split('\n')
  let i = 0
  while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith('#'))) i++
  const para = []
  while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('#')) {
    para.push(lines[i].trim())
    i++
  }
  const text = para.join(' ')
  return text.length > 240 ? text.slice(0, 240).replace(/\s+\S*$/, '') + ' …' : text
}

function openRows() {
  const rows = []
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const isRoot = base === 'root.md'
    const id = isRoot ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id == null) continue
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    rows.push({
      id,
      file,
      isRoot,
      title: (meta && meta.title) || base.replace(/^\d+-/, '').replace(/\.md$/, ''),
      track: (meta && meta.track) || path.relative(TODO, file).split(path.sep)[0],
      status: (meta && meta.status) || 'todo',
      priority: (meta && meta.priority) || 'med',
      roi: (meta && meta.roi) || 'med',
      release: (meta && meta.release) || '',
      blocked_by: (meta && meta.blocked_by) || [],
      modules: (meta && meta.modules) || [],
      cadence: (meta && meta.cadence) || '',
      questions: (meta && meta.questions) || [],
      summary: summaryLine(body),
    })
  }
  return rows.sort((a, b) => a.id - b.id)
}

export function cmdList(args) {
  const { flags, positional } = parseFlags(args, ['module'])
  if (positional.length) die(`list takes options, not positional args (got "${positional.join(' ')}")`)

  let rows = openRows()
  let scope = 'on the board'
  const mod = flags.module
  if (mod !== undefined) {
    if (mod === true) die('--module needs a module name, e.g. `list --module skill`')
    const known = moduleNames()
    if (known === null) die(`no ${rel(MODULES_MD)} yet — the board has no module map to filter by`)
    if (!known.includes(mod)) {
      die(`unknown module "${mod}". known modules: ${known.join(', ') || '(none)'}`)
    }
    rows = rows.filter((r) => r.modules.includes(mod))
    scope = `tagged \`${mod}\``
  }

  if (!rows.length) {
    console.log(`no open cards ${scope}.`)
    return
  }

  console.log(`${plural(rows.length, 'open card')} ${scope}:`)
  for (const r of rows) {
    const meta = [r.track, r.status, `priority ${r.priority}`, `roi ${r.roi}`]
    if (r.isRoot) meta.push('group root')
    if (r.release) meta.push(`release ${r.release}`)
    if (r.cadence) meta.push(`every ${r.cadence}`)
    if (r.blocked_by.length) meta.push(`blocked by ${r.blocked_by.map((n) => `#${n}`).join(', ')}`)
    if (r.questions.length) meta.push(plural(r.questions.length, 'open question'))
    console.log('')
    console.log(`#${r.id} ${r.title}  (${rel(r.file)})`)
    console.log(`    ${meta.join(' · ')}`)
    if (r.summary) console.log(`    ${r.summary}`)
  }
}
