#!/usr/bin/env node
// Every window in every state, side by side, for a look without the app:
//   node scripts/preview.mjs [zh|en]   → prints the gallery page to open or screenshot

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wildcrane-preview-'))
const lang = process.argv[2] ?? 'zh'

await esbuild.build({ entryPoints: [path.join(DIR, 'scripts', 'preview.ts')], outfile: path.join(out, 'preview.js'), bundle: true, format: 'esm' })
fs.copyFileSync(path.join(DIR, 'ui', 'style.css'), path.join(out, 'style.css'))
fs.writeFileSync(path.join(out, 'window.html'), fs.readFileSync(path.join(DIR, 'ui', 'index.html'), 'utf8').replace('app.js', 'preview.js'))

const SIZES = { setup: [520, 460], panel: [380, 560], bubble: [300, 132] }
const scenes = [
  ['sign-in', 'setup'], ['waiting', 'setup'], ['failed', 'setup'], ['notify', 'setup'], ['denied', 'setup'], ['bubble', 'bubble'],
  ['panel', 'panel'], ['running', 'panel'], ['project', 'panel'], ['single', 'panel'], ['empty', 'panel'], ['offline', 'panel'],
  ['elsewhere', 'panel'], ['paused', 'panel'], ['settings', 'panel'], ['plan', 'panel'], ['plan-pro', 'panel'], ['rejected', 'panel'],
]
const frames = scenes.map(([scene, kind]) => {
  const [w, h] = SIZES[kind]
  return `<figure><figcaption>${scene}</figcaption><iframe src="window.html?scene=${scene}&lang=${lang}" width="${w}" height="${h}"></iframe></figure>`
})
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><style>
body{margin:16px;background:linear-gradient(160deg,#cfd8e3,#e9e4dc);display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;font:12px system-ui}
figure{margin:0}iframe{border:0;display:block;background:transparent}figcaption{margin-bottom:4px}</style>${frames.join('')}`)
console.log(path.join(out, 'index.html'))
