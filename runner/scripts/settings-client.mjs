// Bundles the local settings page (src/settings-app.tsx) for the browser, Tailwind included, and
// hands it to the Runner build as the text of `virtual:settings-client`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'
import { compile } from 'tailwindcss'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const req = (id) => fileURLToPath(import.meta.resolve(id))
const UI = path.join(PKG_DIR, 'src', 'ui')
// Every file whose class names reach the page.
const SOURCES = () => [
  path.join(PKG_DIR, 'src', 'settings-app.tsx'),
  path.join(PKG_DIR, 'src', 'settings-marks.ts'),
  ...fs.readdirSync(UI).filter((f) => !f.endsWith('.css')).map((f) => path.join(UI, f)),
]

async function tailwind(file) {
  const compiler = await compile(fs.readFileSync(file, 'utf8'), {
    base: path.dirname(file),
    loadStylesheet: async (id, from) => {
      const at = id === 'tailwindcss' ? req('tailwindcss/index.css') : path.resolve(from, id)
      return { path: at, base: path.dirname(at), content: fs.readFileSync(at, 'utf8') }
    },
  })
  const candidates = new Set(SOURCES().flatMap((f) => fs.readFileSync(f, 'utf8').split(/[\s"'`]+/)))
  return compiler.build([...candidates].filter(Boolean))
}

let built
export function buildSettingsClient() {
  return (built ??= (async () => {
    const result = await esbuild.build({
      entryPoints: [path.join(PKG_DIR, 'src', 'settings-app.tsx')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      jsx: 'automatic',
      legalComments: 'none',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'settings-client',
        setup(build) {
          build.onLoad({ filter: /\.css$/ }, async (args) => ({ contents: await tailwind(args.path), loader: 'text' }))
        },
      }],
    })
    return result.outputFiles[0].text
  })())
}

export const settingsClientPlugin = {
  name: 'virtual-settings-client',
  setup(build) {
    build.onResolve({ filter: /^virtual:settings-client$/ }, () => ({ path: 'settings-client', namespace: 'settings-client' }))
    build.onLoad({ filter: /.*/, namespace: 'settings-client' }, async () => ({ contents: await buildSettingsClient(), loader: 'text' }))
  },
}
