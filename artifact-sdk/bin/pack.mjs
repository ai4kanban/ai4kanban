// The bundle `publish` sends: a ustar archive of the component's folder.

import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const MANIFEST = 'wildcrane.component.json'

/** Every file under dir but the manifest, dot files and node_modules, by its `/` path. */
/** @param {string} dir @returns {string[]} */
export function filesOf(dir) {
  /** @type {string[]} */
  const out = []
  /** @param {string} at */
  const walk = (at) => {
    for (const name of readdirSync(at).sort()) {
      if (name.startsWith('.') || name === 'node_modules') continue
      const path = join(at, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(dir, path).split(sep).join('/'))
    }
  }
  walk(dir)
  return out.filter((p) => p !== MANIFEST)
}

/** A ustar archive; a path past 100 bytes travels in a pax header. */
/** @param {[string, Uint8Array][]} files */
export function tarOf(files) {
  /** @type {Uint8Array[]} */
  const blocks = []
  const enc = new TextEncoder()
  /** @param {string} name @param {number} size @param {string} kind */
  const header = (name, size, kind) => {
    const h = new Uint8Array(512)
    /** @param {string} text @param {number} at */
    const put = (text, at) => h.set(enc.encode(text), at)
    put(name.slice(0, 100), 0)
    put('0000644\0', 100)
    put('0000000\0', 108)
    put('0000000\0', 116)
    put(size.toString(8).padStart(11, '0') + '\0', 124)
    put('00000000000\0', 136)
    put('        ', 148)
    put(kind, 156)
    put('ustar\x0000', 257)
    const sum = h.reduce((n, b) => n + b, 0)
    put(sum.toString(8).padStart(6, '0') + '\0 ', 148)
    return h
  }
  /** @param {string} name @param {Uint8Array} body */
  const entry = (name, body, kind = '0') =>
    blocks.push(header(name, body.length, kind), body, new Uint8Array((512 - (body.length % 512)) % 512))
  for (const [name, body] of files) {
    if (enc.encode(name).length > 100) {
      const record = ` path=${name}\n`
      let n = enc.encode(record).length
      n += String(n + String(n).length).length
      entry('PaxHeader', enc.encode(`${n}${record}`), 'x')
    }
    entry(name, body)
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0))
  let at = 0
  for (const b of blocks) {
    out.set(b, at)
    at += b.length
  }
  return out
}
