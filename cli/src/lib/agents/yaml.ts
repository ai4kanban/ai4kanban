// The YAML subset an agent's frontmatter is written in.
//
// A card's frontmatter has its own reader (`lib/frontmatter.ts`) because its shape is fixed
// and known. An agent's is not: it carries nested maps and lists of maps, and a project may
// write one by hand. This reads that shape and nothing more — scalars, nested maps, lists of
// scalars and lists of maps, all by indentation.
//
// What it deliberately does not do: anchors, multi-line scalars, flow maps, types. An agent
// that needs one of those is an agent written against a YAML library this command does not
// ship, and the parse it gets back is what the validator reports on.

import { unquote } from '../yaml'

export type YamlValue = string | YamlValue[] | { [key: string]: YamlValue }

interface Line {
  indent: number
  text: string
}

const readLines = (text: string): Line[] =>
  text
    .split('\n')
    .map((raw) => ({ indent: raw.match(/^[ \t]*/)![0].length, text: raw.trim() }))
    .filter((line) => line.text && !line.text.startsWith('#'))

/** One `key: value` block, read into plain data. A line this reader can't make sense of is
 *  skipped rather than thrown on: the validator above reports on what is missing, which
 *  names the field, where a parse error would only name a line. */
export function parseYamlBlock(text: string): Record<string, YamlValue> {
  const [map] = readMap(readLines(text), 0, 0)
  return map
}

function readMap(lines: Line[], start: number, indent: number): [Record<string, YamlValue>, number] {
  const out: Record<string, YamlValue> = {}
  let i = start
  while (i < lines.length && lines[i]!.indent >= indent) {
    const line = lines[i]!
    if (line.indent > indent) {
      i++
      continue
    }
    // A list item where a key was expected ends this map — it belongs to whoever asked.
    if (line.text.startsWith('-')) break
    const match = line.text.match(/^([^:]+):\s*(.*)$/)
    if (!match) {
      i++
      continue
    }
    const key = match[1]!.trim()
    const inline = match[2]!.trim()
    i++
    if (inline) {
      out[key] = unquote(inline)
      continue
    }
    const [value, next] = readBlock(lines, i, indent)
    out[key] = value
    i = next
  }
  return [out, i]
}

// What sits under a key with nothing after the colon: a list, a map, or — when nothing is
// indented below it — an empty string, the same answer `key:` alone gives in YAML.
function readBlock(lines: Line[], start: number, parentIndent: number): [YamlValue, number] {
  if (start >= lines.length || lines[start]!.indent <= parentIndent) return ['', start]
  const indent = lines[start]!.indent
  if (lines[start]!.text.startsWith('-')) return readList(lines, start, indent)
  return readMap(lines, start, indent)
}

function readList(lines: Line[], start: number, indent: number): [YamlValue[], number] {
  const out: YamlValue[] = []
  let i = start
  while (i < lines.length && lines[i]!.indent === indent && lines[i]!.text.startsWith('-')) {
    const line = lines[i]!
    const rest = line.text.replace(/^-\s*/, '')
    // Where the item's own keys sit: past the `- ` that opened it.
    const keyIndent = indent + (line.text.length - rest.length)
    i++
    if (!rest) {
      const [value, next] = readBlock(lines, i, indent)
      out.push(value)
      i = next
      continue
    }
    const match = rest.match(/^([^:]+):\s*(.*)$/)
    if (!match) {
      out.push(unquote(rest))
      continue
    }
    const item: Record<string, YamlValue> = {}
    const inline = match[2]!.trim()
    if (inline) item[match[1]!.trim()] = unquote(inline)
    else {
      const [value, next] = readBlock(lines, i, keyIndent)
      item[match[1]!.trim()] = value
      i = next
    }
    const [rest_, next] = readMap(lines, i, keyIndent)
    Object.assign(item, rest_)
    i = next
    out.push(item)
  }
  return [out, i]
}

/** The frontmatter block and the body of a `---`-fenced markdown file. `meta` is null when
 *  the file opens with no frontmatter at all. */
export function splitFrontmatter(text: string): { meta: string | null; body: string } {
  const lines = text.replace(/^﻿/, '').split('\n')
  if (lines[0]?.trim() !== '---') return { meta: null, body: text }
  let i = 1
  while (i < lines.length && lines[i]!.trim() !== '---') i++
  if (i >= lines.length) return { meta: null, body: text }
  return { meta: lines.slice(1, i).join('\n'), body: lines.slice(i + 1).join('\n') }
}
