// deck-planner's `scripts/pack-pptx.mjs` (#1743): a storyboard's rendered pages become a
// .pptx holding one full-slide image per slide. Run the way a session runs it — saved out of
// the built command and run with Node.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { after, describe, it } from 'node:test'

import { BUNDLED_AGENT_FILES } from '../src/lib/agents/bundled'

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-pack-pptx-'))
after(() => fs.rmSync(scratch, { recursive: true, force: true }))

const script = path.join(scratch, 'pack-pptx.mjs')
fs.writeFileSync(script, BUNDLED_AGENT_FILES['deck-planner/scripts/pack-pptx.mjs']!)

const png = (tag: number) => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag])

/** Every entry of a zip archive, by name. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const out = new Map<string, Buffer>()
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const skip = buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const local = buf.readUInt32LE(at + 42)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + size)
    out.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data))
    at += 46 + nameLen + skip
  }
  return out
}

/** Write a card folder with `files` and the storyboard, pack it, and read the result back. */
function pack(storyboard: unknown, files: Record<string, Buffer>) {
  const dir = path.join(scratch, 'assets', '969')
  fs.rmSync(dir, { recursive: true, force: true })
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), bytes)
  }
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(storyboard))
  const out = path.join(dir, 'deck.pptx')
  const res = spawnSync(process.execPath, [script, path.join(dir, 'storyboard.json'), out], { encoding: 'utf8' })
  return { res, zip: res.status === 0 ? unzip(fs.readFileSync(out)) : null }
}

const slide = (id: string, preview: string, notes?: string) => ({ id, title: id, copy: [], layout: 'x', assets: [], preview: { src: `.assets/969/${preview}`, alt: id }, ...(notes === undefined ? {} : { notes }) })
const text = (zip: Map<string, Buffer>, name: string) => zip.get(name)!.toString('utf8')

describe("deck-planner's pack-pptx script", () => {
  it('packs one full-slide image per slide, in page order, with the speaker notes', () => {
    const { res, zip } = pack(
      { version: 1, size: { width: 1920, height: 1080 }, slides: [slide('cover', 'pages/cover.html', 'Open with <one> & only one point.\nThen pause.'), slide('results', 'pages/results.tsx')] },
      { 'slides/cover.png': png(1), 'slides/results.png': png(2) },
    )
    assert.equal(res.status, 0, res.stderr)
    assert.deepEqual(zip!.get('ppt/media/image1.png'), png(1))
    assert.deepEqual(zip!.get('ppt/media/image2.png'), png(2))
    const presentation = text(zip!, 'ppt/presentation.xml')
    assert.match(presentation, /<p:sldSz cx="12192000" cy="6858000"\/>/)
    assert.equal(presentation.match(/<p:sldId /g)!.length, 2)
    const rels = text(zip!, 'ppt/_rels/presentation.xml.rels')
    assert.ok(rels.indexOf('slides/slide1.xml') < rels.indexOf('slides/slide2.xml'))
    for (const n of [1, 2]) {
      const xml = text(zip!, `ppt/slides/slide${n}.xml`)
      assert.equal(xml.match(/<p:pic>/g)!.length, 1)
      assert.doesNotMatch(xml, /<p:sp>|<p:txBody>/)
      assert.match(xml, /<a:off x="0" y="0"\/><a:ext cx="12192000" cy="6858000"\/>/)
    }
    assert.match(text(zip!, 'ppt/notesSlides/notesSlide1.xml'), /<a:t>Open with &lt;one&gt; &amp; only one point\.<\/a:t>.*<a:t>Then pause\.<\/a:t>/)
    assert.doesNotMatch(text(zip!, 'ppt/notesSlides/notesSlide2.xml'), /<a:t>/)
    assert.match(text(zip!, '[Content_Types].xml'), /Extension="png"/)
  })

  it('sizes the slide to the storyboard ratio, 16:9 when it sets none', () => {
    const files = { 'slides/a.png': png(1) }
    assert.match(text(pack({ version: 1, size: { width: 1080, height: 1440 }, slides: [slide('a', 'pages/a.html')] }, files).zip!, 'ppt/presentation.xml'), /cx="9144000" cy="12192000"/)
    assert.match(text(pack({ version: 1, slides: [slide('a', 'pages/a.html')] }, files).zip!, 'ppt/presentation.xml'), /cx="12192000" cy="6858000"/)
  })

  it('packs an approved image preview when no page was rendered', () => {
    const { res, zip } = pack({ version: 1, slides: [slide('old', 'previews/old.jpg')] }, { 'previews/old.jpg': Buffer.from([0xff, 0xd8, 7]) })
    assert.equal(res.status, 0, res.stderr)
    assert.deepEqual(zip!.get('ppt/media/image1.jpg'), Buffer.from([0xff, 0xd8, 7]))
    assert.match(text(zip!, '[Content_Types].xml'), /Extension="jpg" ContentType="image\/jpeg"/)
  })

  it('names every slide with no image and writes nothing', () => {
    const { res } = pack({ version: 1, slides: [slide('cover', 'pages/cover.html'), slide('done', 'pages/done.html'), slide('end', 'previews/gone.png')] }, { 'slides/done.png': png(1) })
    assert.equal(res.status, 1)
    assert.match(res.stderr, /slide 1 "cover"/)
    assert.match(res.stderr, /slide 3 "end"/)
    assert.doesNotMatch(res.stderr, /"done"/)
    assert.equal(fs.existsSync(path.join(scratch, 'assets', '969', 'deck.pptx')), false)
    assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 2)
  })
})
