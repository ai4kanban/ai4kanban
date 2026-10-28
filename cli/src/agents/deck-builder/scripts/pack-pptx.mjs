#!/usr/bin/env node
// Pack a slide storyboard's rendered pages into a .pptx: one full-slide image per slide.
//
//   node scripts/pack-pptx.mjs <card asset folder>/storyboard.json <out>.pptx
//
// Runtime: Node 18 or later, nothing else. Save it from a built-in agent with
// `akb raw agent-file deck-builder scripts/pack-pptx.mjs > pack-pptx.mjs`.
// Each slide's image is `slides/<slide id>.png` beside the storyboard, else its preview when
// that is itself an image. The slide is sized to the storyboard's `size` ratio (1920×1080 when
// unset) and its `notes` become the speaker notes. Exits 1 naming every slide with no image;
// exit 2 is a usage error.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
const LONG_SIDE = 12192000
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const xml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`
const rels = (list) => xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`)

function fail(code, lines) {
  process.stderr.write(lines.map((l) => `${l}\n`).join(''))
  process.exit(code)
}

/** The image for one slide, as `{ file, ext }`, or null when it has none. */
function imageFor(dir, slide) {
  const rendered = path.join(dir, 'slides', `${slide.id}.png`)
  if (fs.existsSync(rendered)) return { file: rendered, ext: 'png' }
  const parts = String(slide.preview?.src ?? '').split('/')
  const ext = parts[parts.length - 1].split('.').pop().toLowerCase()
  if (parts[0] !== '.assets' || parts.length < 3 || !(ext in IMAGE_TYPES) || parts.slice(2).some((p) => p.startsWith('.'))) return null
  const file = path.join(dir, ...parts.slice(2))
  return fs.existsSync(file) ? { file, ext } : null
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A zip archive of `[name, content]` entries; images are stored, XML deflated. */
function zip(entries) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, content] of entries) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
    const deflate = !Buffer.isBuffer(content)
    const packed = deflate ? zlib.deflateRawSync(data) : data
    const fname = Buffer.from(name, 'utf8')
    const head = (sig, size) => {
      const b = Buffer.alloc(size)
      b.writeUInt32LE(sig, 0)
      return b
    }
    const local = head(0x04034b50, 30)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(deflate ? 8 : 0, 8)
    local.writeUInt16LE(0x21, 12) // 1980-01-01, so the same input packs to the same bytes
    local.writeUInt32LE(crc32(data), 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(fname.length, 26)
    const dirEntry = head(0x02014b50, 46)
    dirEntry.writeUInt16LE(20, 4)
    local.copy(dirEntry, 6, 4, 30)
    dirEntry.writeUInt32LE(offset, 42)
    locals.push(local, fname, packed)
    central.push(dirEntry, fname)
    offset += local.length + fname.length + packed.length
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dirSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...central, end])
}

const THEME = xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`)
const COLOR_MAP = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"'
const EMPTY_TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'

function pack(storyboardFile) {
  const dir = path.dirname(path.resolve(storyboardFile))
  let data
  try {
    data = JSON.parse(fs.readFileSync(storyboardFile, 'utf8').replace(/^﻿/, ''))
  } catch (e) {
    fail(1, [`${storyboardFile}: cannot read the storyboard — ${e.message}. Run scripts/validate-storyboard.mjs on it first.`])
  }
  const slides = Array.isArray(data?.slides) ? data.slides : []
  if (!slides.length) fail(1, [`${storyboardFile}: no slides to pack.`])
  const size = Number.isInteger(data.size?.width) && Number.isInteger(data.size?.height) && data.size.width > 0 && data.size.height > 0 ? data.size : { width: 1920, height: 1080 }
  const scale = LONG_SIDE / Math.max(size.width, size.height)
  const cx = Math.round(size.width * scale)
  const cy = Math.round(size.height * scale)

  const images = slides.map((slide) => imageFor(dir, slide))
  const missing = slides.map((s, i) => (images[i] ? null : `- slide ${i + 1} "${s.id}": no slides/${s.id}.png and no image preview`)).filter(Boolean)
  if (missing.length) fail(1, [`${storyboardFile}: ${missing.length} slide(s) have no image. Render each page, then run this script again:`, ...missing])

  const entries = []
  const exts = new Set(images.map((im) => im.ext))
  const overrides = [
    ['/ppt/presentation.xml', 'presentationml.presentation.main'],
    ['/ppt/presProps.xml', 'presentationml.presProps'],
    ['/ppt/viewProps.xml', 'presentationml.viewProps'],
    ['/ppt/tableStyles.xml', 'presentationml.tableStyles'],
    ['/ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster'],
    ['/ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout'],
    ['/ppt/notesMasters/notesMaster1.xml', 'presentationml.notesMaster'],
    ['/ppt/theme/theme1.xml', 'theme'],
    ['/ppt/theme/theme2.xml', 'theme'],
    ...slides.flatMap((_, i) => [[`/ppt/slides/slide${i + 1}.xml`, 'presentationml.slide'], [`/ppt/notesSlides/notesSlide${i + 1}.xml`, 'presentationml.notesSlide']]),
  ]
  entries.push(['[Content_Types].xml', xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...exts].map((e) => `<Default Extension="${e}" ContentType="${IMAGE_TYPES[e]}"/>`).join('')}${overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="application/vnd.openxmlformats-officedocument.${t}+xml"/>`).join('')}</Types>`)])
  entries.push(['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])])

  const slideRels = slides.map((_, i) => [`rId${i + 10}`, 'slide', `slides/slide${i + 1}.xml`])
  entries.push(['ppt/_rels/presentation.xml.rels', rels([
    ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
    ['rId2', 'notesMaster', 'notesMasters/notesMaster1.xml'],
    ['rId3', 'theme', 'theme/theme1.xml'],
    ['rId4', 'presProps', 'presProps.xml'],
    ['rId5', 'viewProps', 'viewProps.xml'],
    ['rId6', 'tableStyles', 'tableStyles.xml'],
    ...slideRels,
  ])])
  entries.push(['ppt/presentation.xml', xml(`<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${slideRels.map(([id], i) => `<p:sldId id="${256 + i}" r:id="${id}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)])
  entries.push(['ppt/presProps.xml', xml(`<p:presentationPr ${NS}/>`)])
  entries.push(['ppt/viewProps.xml', xml(`<p:viewPr ${NS}/>`)])
  entries.push(['ppt/tableStyles.xml', xml('<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>')])
  entries.push(['ppt/theme/theme1.xml', THEME], ['ppt/theme/theme2.xml', THEME])

  entries.push(['ppt/slideMasters/slideMaster1.xml', xml(`<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMap ${COLOR_MAP}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`)])
  entries.push(['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])])
  entries.push(['ppt/slideLayouts/slideLayout1.xml', xml(`<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)])
  entries.push(['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])])

  const notesBody = (idx) => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="${idx}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`
  entries.push(['ppt/notesMasters/notesMaster1.xml', xml(`<p:notesMaster ${NS}><p:cSld><p:spTree>${EMPTY_TREE}${notesBody(1)}<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap ${COLOR_MAP}/></p:notesMaster>`)])
  entries.push(['ppt/notesMasters/_rels/notesMaster1.xml.rels', rels([['rId1', 'theme', '../theme/theme2.xml']])])

  slides.forEach((slide, i) => {
    const n = i + 1
    const { file, ext } = images[i]
    entries.push([`ppt/media/image${n}.${ext}`, fs.readFileSync(file)])
    entries.push([`ppt/slides/slide${n}.xml`, xml(`<p:sld ${NS}><p:cSld><p:spTree>${EMPTY_TREE}<p:pic><p:nvPicPr><p:cNvPr id="2" name="${esc(slide.id)}" descr="${esc(slide.preview?.alt ?? slide.title ?? '')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)])
    entries.push([`ppt/slides/_rels/slide${n}.xml.rels`, rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', `../media/image${n}.${ext}`], ['rId3', 'notesSlide', `../notesSlides/notesSlide${n}.xml`]])])
    const paragraphs = String(slide.notes ?? '').split(/\r?\n/).map((line) => (line ? `<a:p><a:r><a:rPr lang="en-US"/><a:t>${esc(line)}</a:t></a:r></a:p>` : '<a:p/>')).join('')
    entries.push([`ppt/notesSlides/notesSlide${n}.xml`, xml(`<p:notes ${NS}><p:cSld><p:spTree>${EMPTY_TREE}${notesBody(1)}<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`)])
    entries.push([`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'], ['rId2', 'slide', `../slides/slide${n}.xml`]])])
  })
  return { archive: zip(entries), count: slides.length }
}

const [file, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!file || !out) fail(2, ['usage: node pack-pptx.mjs <storyboard.json> <out.pptx>'])
const { archive, count } = pack(file)
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
fs.writeFileSync(out, archive)
process.stdout.write(`${out}: ${count} slide(s), one image each\n`)
