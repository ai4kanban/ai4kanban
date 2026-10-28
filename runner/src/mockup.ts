// A `.tsx` mockup drawn into one self-contained page (#2003), so a review shows the screen
// rather than its source. Ported from legacy kanban-ui/lib/mockup.ts: the entry and the files
// beside it are transpiled, run once in a bare `vm` context, rendered to markup, and styled
// with Tailwind compiled from the folder's own stylesheets.

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import React from 'react'
import * as JSX from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { transform } from 'sucrase'
import { compile } from 'tailwindcss'
import TAILWIND from 'tailwindcss/index.css' with { type: 'text' }

const DRAW_MS = 5000
const MAX_FILES = 60
const CODE_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs']
const REQUIRES = /require\(\s*["']([^"']+)["']\s*\)/g

const NOTHING = () => {}

const NEXT_LINK = {
  __esModule: true,
  default: function Link({ href, children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) {
    const { prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, ...attrs } = rest
    void [prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior]
    return React.createElement('a', { href: typeof href === 'string' ? href : '#', ...attrs }, children)
  },
}

const NEXT_IMAGE = {
  __esModule: true,
  default: function Image({ src, alt, ...rest }: Record<string, unknown>) {
    const { fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, sizes, ...attrs } = rest
    void [fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, sizes]
    const url = typeof src === 'string' ? src : ((src as { src?: string } | null)?.src ?? '')
    return React.createElement('img', { src: url, alt: typeof alt === 'string' ? alt : '', ...attrs })
  },
}

const NEXT_NAVIGATION = {
  __esModule: true,
  useRouter: () => ({ push: NOTHING, replace: NOTHING, back: NOTHING, forward: NOTHING, refresh: NOTHING, prefetch: NOTHING }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
  redirect: NOTHING,
  notFound: NOTHING,
}

/** What ui-designer's rules say a mockup may import, each loaded only when asked for. */
const PACKAGES: Record<string, () => Promise<unknown>> = {
  'react-icons/fi': () => import('react-icons/fi'),
  'react-icons/fa': () => import('react-icons/fa'),
  'react-icons/si': () => import('react-icons/si'),
  clsx: () => import('clsx'),
  'tailwind-merge': () => import('tailwind-merge'),
  'class-variance-authority': () => import('class-variance-authority'),
}

async function loadPackage(id: string): Promise<unknown> {
  if (id === 'react') return React
  if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return JSX
  if (id === 'next/link') return NEXT_LINK
  if (id === 'next/image') return NEXT_IMAGE
  if (id === 'next/navigation') return NEXT_NAVIGATION
  const load = PACKAGES[id]
  if (!load) throw new Error(`a mockup cannot import ${id}`)
  return { __esModule: true, ...((await load()) as Record<string, unknown>) }
}

interface Graph {
  code: Map<string, string>
  links: Map<string, Map<string, string>>
  sheets: { path: string; content: string }[]
  packages: Map<string, unknown>
}

function resolveFile(id: string, from: string, folder: string): string {
  const at = path.resolve(path.dirname(from), id)
  if (at !== folder && !at.startsWith(folder + path.sep)) throw new Error(`${id} is outside the mockup's folder`)
  const tries = path.extname(at) ? [at] : [...CODE_EXTS.map((e) => at + e), ...CODE_EXTS.map((e) => path.join(at, `index${e}`))]
  const file = tries.find((f) => fs.statSync(f, { throwIfNoEntry: false })?.isFile())
  if (!file) throw new Error(`no such file: ${id}`)
  return file
}

async function readGraph(entry: string): Promise<Graph> {
  const folder = path.dirname(entry)
  const graph: Graph = { code: new Map(), links: new Map(), sheets: [], packages: new Map() }
  const walk = async (file: string): Promise<void> => {
    if (graph.code.has(file)) return
    if (graph.code.size >= MAX_FILES) throw new Error(`a mockup imports more than ${MAX_FILES} files`)
    const js = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic', production: true, filePath: file }).code
    graph.code.set(file, js)
    const link = new Map<string, string>()
    graph.links.set(file, link)
    for (const [, id] of js.matchAll(REQUIRES)) {
      if (!id!.startsWith('.')) {
        if (!graph.packages.has(id!)) graph.packages.set(id!, await loadPackage(id!))
        continue
      }
      const target = resolveFile(id!, file, folder)
      link.set(id!, target)
      if (!target.endsWith('.css')) await walk(target)
      else if (!graph.sheets.some((s) => s.path === target)) graph.sheets.push({ path: target, content: fs.readFileSync(target, 'utf8') })
    }
  }
  await walk(entry)
  return graph
}

function run(script: string, context: vm.Context, name: string, deadline: number): unknown {
  const left = deadline - Date.now()
  if (left <= 0) throw new Error(`took longer than ${DRAW_MS / 1000}s to draw`)
  return vm.runInContext(script, context, { timeout: left, filename: name })
}

async function tailwindFor(markup: string, sheets: Graph['sheets']): Promise<string> {
  const source = sheets.length ? sheets.map((s) => s.content).join('\n') : '@import "tailwindcss";'
  const compiler = await compile(source, {
    base: sheets.length ? path.dirname(sheets[0]!.path) : '/',
    loadStylesheet: async (id: string, from: string) => {
      if (id === 'tailwindcss' || id.startsWith('tailwindcss/')) return { path: 'tailwindcss/index.css', base: '/', content: TAILWIND }
      if (!id.startsWith('.')) throw new Error(`a mockup cannot import ${id}`)
      const at = path.resolve(from, id)
      return { path: at, base: path.dirname(at), content: fs.readFileSync(at, 'utf8') }
    },
  })
  const classes = [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/))
  return compiler.build(classes.filter(Boolean))
}

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; " +
  "media-src data:; font-src data:; worker-src 'none'; base-uri 'none'; form-action 'none'"

const head = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><meta charset="utf-8">` +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><style>html{overflow-x:hidden;overscroll-behavior:contain}</style>'

/** An `.html` mockup keeps its own markup; a stylesheet it links from its folder is inlined,
 *  since the review's frame loads nothing by path. */
function dressPage(file: string): string {
  const folder = path.dirname(file)
  const html = fs.readFileSync(file, 'utf8').replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag) || !href || /^[a-z][\w+.-]*:|^\/\//i.test(href)) return tag
    const at = path.resolve(folder, href)
    if (!at.startsWith(folder + path.sep) || !fs.existsSync(at)) return tag
    return `<style>${fs.readFileSync(at, 'utf8').replace(/<\/style/gi, '<\\/style')}</style>`
  })
  const at = /^\uFEFF?\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\b[^>]*>)?/i.exec(html)![0].length
  return /<!doctype\b|<html[\s>]|<head[\s>]/i.test(html) ? html.slice(0, at) + head + html.slice(at) : `<!doctype html><html><head>${head}</head><body>${html}</body></html>`
}

/** The page a `.tsx` or `.html` mockup draws. Throws, with why, when it cannot be drawn. */
export async function drawMockup(entry: string): Promise<string> {
  if (entry.toLowerCase().endsWith('.html')) return dressPage(entry)
  const graph = await readGraph(entry)
  const sandbox: Record<string, unknown> = { React, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }
  const context = vm.createContext(sandbox)
  const deadline = Date.now() + DRAW_MS
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const order: string[] = []
  sandbox.__bind = (n: number) => {
    const file = order[n]!
    const mod = modules.get(file)!
    return {
      module: mod,
      exports: mod.exports,
      require: (id: string) => {
        const target = graph.links.get(file)?.get(id)
        if (target) return target.endsWith('.css') ? {} : load(target)
        if (graph.packages.has(id)) return graph.packages.get(id)
        throw new Error(`a mockup cannot import ${id}`)
      },
    }
  }
  const load = (file: string): Record<string, unknown> => {
    const done = modules.get(file)
    if (done) return done.exports
    const mod = { exports: {} as Record<string, unknown> }
    modules.set(file, mod)
    const n = order.push(file) - 1
    run(`var __b = __bind(${n});\n(function (module, exports, require) {\n${graph.code.get(file)!}\n})(__b.module, __b.exports, __b.require)`, context, file, deadline)
    return mod.exports
  }
  const Component = load(entry).default
  if (typeof Component !== 'function') throw new Error('the mockup has no default export to draw')
  sandbox.__draw = () => renderToStaticMarkup(React.createElement(Component as React.FunctionComponent))
  const markup = run('__draw()', context, entry, deadline) as string
  const css = (await tailwindFor(markup, graph.sheets)).replace(/<\/style/gi, '<\\/style')
  return `<!doctype html><html><head>${head}<style>${css}</style></head><body>${markup}</body></html>`
}
