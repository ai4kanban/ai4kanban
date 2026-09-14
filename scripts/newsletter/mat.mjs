#!/usr/bin/env node
// Mount a capture on the landing page's wash and export it at 1104 × 736, the size a
// highlight picture is sent at.
//
//   node scripts/newsletter/mat.mjs --in shot.png --out runs-v1.png \
//     --crop 640,145,1360,851 --wash mintSky
//   node scripts/newsletter/mat.mjs --in execute.png --out runs-v1.png --whole
//
// The mat, its padding and the print's corner are `web/components/home/Mat.tsx` and the
// /shots page's geometry, scaled to the 552px an email is read at. Baked into the PNG
// because an email client keeps neither a canvas nor a CSS corner — and because a corner
// applied on top in CSS would clip the mat underneath it.
//
// `--whole` skips the mat: a figure that already carries one (`screenshots/landing-figures/`)
// is scaled whole and padded to 3∶2 in the site's page colour, which is the mail's own
// background.
//
// The crop is done in headless Chrome. `sips --cropOffset` measures from the image's centre
// and crops somewhere else without saying so.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const W = 552, H = 368, PAD = 19, MAT = 11, RADIUS = 6 // at 1× — captured at 2× for 1104×736
const PANEL = W - 2 * PAD - 2 * MAT

// web/components/home/washes.ts, as CSS — the same paintings the landing page mounts on.
const PIGMENT = { ember: '221,79,30', peach: '242,145,60', mint: '67,180,131', sky: '63,146,210', lilac: '138,107,217' }
const WASHES = {
  emberLilac: ['ember', 'lilac', false], mintSky: ['mint', 'sky', true],
  peachEmber: ['peach', 'ember', false], skyLilac: ['sky', 'lilac', true],
  emberMint: ['ember', 'mint', false],
}

function ground(name) {
  const wash = WASHES[name]
  if (!wash) throw new Error(`未知的衬底 / No such wash: ${name} (${Object.keys(WASHES).join(', ')})`)
  const [top, bottom, flip] = wash
  const a = flip ? '2%' : '98%', z = flip ? '98%' : '2%'
  return `radial-gradient(44% 40% at ${a} -4%, rgba(${PIGMENT[top]},0.64), rgba(${PIGMENT[top]},0) 72%),` +
    `radial-gradient(46% 42% at ${z} 104%, rgba(${PIGMENT[bottom]},0.64), rgba(${PIGMENT[bottom]},0) 72%)`
}

function draw(body, out) {
  const page = path.join(process.env.TMPDIR ?? '/tmp', 'newsletter-mat.html')
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:#ffffff}
</style></head><body>${body}</body></html>`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
    '--font-render-hinting=none', '--force-device-scale-factor=2', `--window-size=${W},${H}`,
    `--screenshot=${out}`, '--virtual-time-budget=4000', `file://${page}`], { stdio: 'ignore' })
}

const uri = (file) => {
  const type = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png'
  return `data:${type};base64,${readFileSync(file).toString('base64')}`
}

function matted({ src, crop, wash, out }) {
  const [x, y, w] = crop
  const scale = PANEL / w
  draw(
    `<div style="position:absolute;inset:${PAD}px;border-radius:${RADIUS}px;background:${ground(wash)},#f8f5ef">` +
      `<div style="position:absolute;inset:${MAT}px;border-radius:${RADIUS}px;background:#fff;overflow:hidden;` +
      `box-shadow:0 3px 9px -3px rgba(36,35,31,.45)">` +
      `<img src="${uri(src)}" style="position:absolute;left:${-x * scale}px;top:${-y * scale}px;` +
      `transform-origin:0 0;transform:scale(${scale})"></div></div>`,
    out,
  )
}

function whole({ src, out }) {
  draw(
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">` +
      `<img src="${uri(src)}" style="max-width:100%;max-height:100%;display:block"></div>`,
    out,
  )
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--in') opts.in = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--wash') opts.wash = argv[++i]
    else if (arg === '--whole') opts.whole = true
    else if (arg === '--crop') opts.crop = argv[++i].split(',').map(Number)
    else throw new Error(`无法识别的选项 / Unknown option: ${arg}`)
  }
  if (!opts.in || !opts.out) throw new Error('需要 --in 与 --out / --in and --out are required')
  if (opts.whole) return opts
  if (opts.crop?.length !== 4 || opts.crop.some((n) => !Number.isFinite(n))) {
    throw new Error('需要 --crop x,y,w,h / --crop x,y,w,h is required')
  }
  if (!opts.wash) throw new Error('需要 --wash / --wash is required')
  return opts
}

try {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.whole) {
    whole({ src: opts.in, out: opts.out })
  } else {
    matted({ src: opts.in, crop: opts.crop, wash: opts.wash, out: opts.out })
    const [, , w, h] = opts.crop
    const ratio = (w / h).toFixed(3)
    // The crop is scaled to the panel's width: a taller one loses its bottom, a wider
    // one leaves white under it.
    if (Math.abs(w / h - PANEL / (H - PAD * 2 - MAT * 2)) > 0.02) {
      process.stderr.write(`裁剪比例是 ${ratio}，面板是 1.597 — 底部会被切掉或留白 / crop is ${ratio}, the panel is 1.597\n`)
    }
  }
  process.stdout.write(`${opts.out}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
