#!/usr/bin/env node
// Render one React Email file to HTML, the HTML version the product sends.
//
//   node scripts/email/email.mjs render <path>/<email>.tsx
//
// The TSX lives in the board's asset folder, outside any package: its imports resolve from
// this folder's node_modules. Setup: scripts/email/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MODULES = path.join(HERE, 'node_modules')
const BUILD_DIR = path.join(MODULES, '.email-build')

const HELP = `
渲染一封邮件 / Render one email

用法 / Usage
  node scripts/email/email.mjs render <name>.tsx   写出同目录的 <name>.html / write <name>.html beside it
`.trim()

function die(message, code = 1) {
  console.error(message)
  process.exit(code)
}

async function load(file) {
  if (!fs.existsSync(path.join(MODULES, 'esbuild'))) die('Run `npm install` in scripts/email first.')
  const { build } = await import('esbuild')
  const out = await build({
    entryPoints: [file],
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    packages: 'external',
    write: false,
    logLevel: 'silent',
  }).catch((err) => die(`Cannot build ${file}:\n${err.message}`))
  // Written under node_modules so the bundle's bare imports resolve to this folder's packages.
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  const code = out.outputFiles[0].text
  const bundle = path.join(BUILD_DIR, `${createHash('sha256').update(code).digest('hex').slice(0, 16)}.mjs`)
  fs.writeFileSync(bundle, code)
  try {
    return await import(pathToFileURL(bundle).href)
  } finally {
    fs.rmSync(bundle, { force: true })
  }
}

export async function renderEmail(file) {
  const mod = await load(path.resolve(file))
  const Email = mod.default
  if (typeof Email !== 'function') die(`${file} must default-export the email component.`)
  const subject = mod.subject ?? Email.subject
  if (typeof subject !== 'string' || !subject.trim()) die(`${file} must export its subject: \`export const subject = '…'\`.`)
  const { createElement } = await import('react')
  const { render } = await import('@react-email/components')
  const html = await render(createElement(Email)).catch((err) => die(`Cannot render ${file}:\n${err.message}`))
  return { subject: subject.trim(), html }
}

async function main(argv) {
  const [action, file] = argv
  if (!action || action === '-h' || action === '--help') return console.log(HELP)
  if (action !== 'render' || !file) die(HELP)
  if (!fs.existsSync(file)) die(`No such file: ${file}`)
  const email = await renderEmail(file)
  const source = path.resolve(file)
  const target = path.join(path.dirname(source), `${path.basename(source, path.extname(source))}.html`)
  fs.writeFileSync(target, email.html)
  console.log(`${target}\nSubject: ${email.subject}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
