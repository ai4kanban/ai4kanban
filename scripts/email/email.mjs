#!/usr/bin/env node
// Render one React Email file to HTML, or send it to the reviewer. Both go through the same
// `renderEmail`, so the HTML the card shows is the HTML the reviewer receives.
//
//   node scripts/email/email.mjs render <path>/email.tsx
//   node scripts/email/email.mjs send <path>/email.tsx
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

const MAIL_FROM = 'AI4Kanban <newsletter@ai4kanban.dev>'
const REVIEWER = process.env.EMAIL_REVIEWER || 'support@ai4kanban.dev'

const HELP = `
渲染或发送一封邮件 / Render or send one email

用法 / Usage
  node scripts/email/email.mjs render <email.tsx>   写出同目录的 email.html / write email.html beside it
  node scripts/email/email.mjs send <email.tsx>     发预览给评审人 / send a preview to the reviewer

环境变量 / Environment
  RESEND_API_KEY   发信必填 / required to send
  EMAIL_REVIEWER   评审邮箱，默认 / reviewer, default: ${REVIEWER}
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
  const { render, toPlainText } = await import('@react-email/components')
  const html = await render(createElement(Email)).catch((err) => die(`Cannot render ${file}:\n${err.message}`))
  return { subject: subject.trim(), html, text: toPlainText(html) }
}

async function main(argv) {
  const [action, file] = argv
  if (!action || action === '-h' || action === '--help') return console.log(HELP)
  if (!['render', 'send'].includes(action) || !file) die(HELP)
  if (!fs.existsSync(file)) die(`No such file: ${file}`)
  const email = await renderEmail(file)

  if (action === 'render') {
    const target = path.join(path.dirname(path.resolve(file)), 'email.html')
    fs.writeFileSync(target, email.html)
    console.log(`${target}\nSubject: ${email.subject}`)
    return
  }

  const key = process.env.RESEND_API_KEY
  if (!key) die('Not sent: RESEND_API_KEY is not set.', 2)
  const { Resend } = await import('resend')
  const { data, error } = await new Resend(key).emails.send({
    from: MAIL_FROM,
    to: REVIEWER,
    subject: `[Preview] ${email.subject}`,
    html: email.html,
    text: email.text,
  })
  if (error) die(`Not sent: ${error.message}`, 3)
  console.log(`Sent to ${REVIEWER} (${data.id})`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
