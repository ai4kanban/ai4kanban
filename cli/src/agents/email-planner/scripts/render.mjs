#!/usr/bin/env node
// Render one React Email file to the HTML and plain-text versions the product sends.
//
//   node render.mjs <board-state>/assets/<card id>/<email>.tsx
//
// Writes <email>.html and <email>.txt beside it. Runtime: Node 18 or later and npm. Save it
// from the built-in agent with `akb raw agent-file email-planner scripts/render.mjs > render.mjs`.
// The first run installs React Email into `<board-state>/assets/email/`, beside the templates,
// so the TSX resolves its imports from there. Exit 1 is a failure, 2 a usage error.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// Pinned and under `dependencies`, so an install with NODE_ENV=production still has them.
const DEPENDENCIES = {
  '@react-email/components': '1.0.11',
  esbuild: '0.28.2',
  react: '19.3.0',
  'react-dom': '19.3.0',
}

const HELP = `
渲染一封邮件 / Render one email

用法 / Usage
  node render.mjs <board-state>/assets/<card id>/<email>.tsx
  写出同目录的 <email>.html 与 <email>.txt / writes <email>.html and <email>.txt beside it
`.trim()

function die(message, code = 1) {
  console.error(message)
  process.exit(code)
}

const retry = (file) => `修复后重试 / Fix it, then run again: node render.mjs ${file}`

function installed(dir) {
  return Object.entries(DEPENDENCIES).every(([name, version]) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8')).version === version
    } catch {
      return false
    }
  })
}

function prepare(dir, file) {
  const manifest = path.join(dir, 'package.json')
  const wanted = { name: 'email-render', private: true, type: 'module', dependencies: DEPENDENCIES }
  let current = null
  try {
    current = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  } catch {}
  if (JSON.stringify(current?.dependencies) !== JSON.stringify(DEPENDENCIES)) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(manifest, `${JSON.stringify({ ...current, ...wanted }, null, 2)}\n`)
  }
  if (installed(dir)) return
  console.error(`安装 React Email / Installing React Email in ${dir} …`)
  const npm = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: dir,
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (npm.error || npm.status !== 0 || !installed(dir)) {
    const why = npm.error?.message || npm.stderr?.trim().split('\n').slice(0, 4).join('\n') || 'npm install did not finish'
    die(`无法安装渲染依赖，请检查网络 / Could not install the render dependencies; check the network.\n${why}\n${retry(file)}`)
  }
}

// The email plus the two calls that render it, bundled into one module whose bare imports all
// resolve from `dir`.
async function load(dir, file) {
  const modules = path.join(dir, 'node_modules')
  const { build } = createRequire(path.join(dir, 'package.json'))('esbuild')
  const entry = JSON.stringify(file)
  const out = await build({
    stdin: {
      contents: `export * from ${entry}\nexport { default } from ${entry}\nexport { createElement } from 'react'\nexport { render } from '@react-email/components'\n`,
      resolveDir: path.dirname(file),
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    packages: 'external',
    write: false,
    logLevel: 'silent',
  }).catch((err) => die(`无法编译 / Cannot build ${file}:\n${err.message}\n${retry(file)}`))
  // Written under node_modules for that resolution.
  const buildDir = path.join(modules, '.email-build')
  fs.mkdirSync(buildDir, { recursive: true })
  const code = out.outputFiles[0].text
  const bundle = path.join(buildDir, `${createHash('sha256').update(code).digest('hex').slice(0, 16)}.mjs`)
  fs.writeFileSync(bundle, code)
  try {
    return await import(pathToFileURL(bundle).href)
  } catch (err) {
    die(`无法加载 / Cannot load ${file}:\n${err.message}\n${retry(file)}`)
  } finally {
    fs.rmSync(bundle, { force: true })
  }
}

async function main([file]) {
  if (!file || file === '-h' || file === '--help') die(HELP, file ? 0 : 2)
  const source = path.resolve(file)
  if (!fs.existsSync(source)) die(`找不到文件 / No such file: ${file}`, 2)
  const dir = path.join(path.dirname(path.dirname(source)), 'email')
  prepare(dir, file)
  const mod = await load(dir, source)
  const Email = mod.default
  if (typeof Email !== 'function') die(`${file} 需默认导出邮件组件 / must default-export the email component.`)
  const subject = mod.subject ?? Email.subject
  if (typeof subject !== 'string' || !subject.trim()) die(`${file} 需导出主题 / must export its subject: \`export const subject = '…'\`.`)
  const email = mod.createElement(Email)
  const [html, text] = await Promise.all([mod.render(email), mod.render(email, { plainText: true })]).catch((err) =>
    die(`无法渲染 / Cannot render ${file}:\n${err.message}\n${retry(file)}`),
  )
  const base = path.join(path.dirname(source), path.basename(source, path.extname(source)))
  fs.writeFileSync(`${base}.html`, html)
  fs.writeFileSync(`${base}.txt`, `${text.trim()}\n`)
  console.log(`${base}.html\n${base}.txt\nSubject: ${subject.trim()}`)
}

await main(process.argv.slice(2))
