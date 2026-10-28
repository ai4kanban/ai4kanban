#!/usr/bin/env node
// Publish wildcrane-runner. Runs in GitHub Actions only (.github/workflows/runner-release.yml),
// because npm provenance needs the CI's identity token; push the tag `runner-v<version>` to
// start it. Refuses a version already on npm, and anything with a failing test.
//
// Publishing makes the version installable, not used: launchers start it once
// `npm run runner-release` in cloud/ names it.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { name, version } = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'))

const fail = (message) => {
  console.error(`publish: ${message}`)
  process.exit(1)
}
const run = (command, args) => spawnSync(command, args, { cwd: PKG_DIR, stdio: 'inherit', shell: process.platform === 'win32' }).status === 0

if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
  fail(`provenance needs GitHub Actions. Push the tag runner-v${version} to publish.`)
}
const tag = process.env.GITHUB_REF_NAME
if (tag !== `runner-v${version}`) fail(`the tag ${tag} does not name ${version}, the version in package.json.`)

const seen = spawnSync('npm', ['view', `${name}@${version}`, 'version'], { cwd: PKG_DIR, encoding: 'utf8' })
if (seen.stdout.trim() === version) fail(`${name}@${version} is already on npm. Raise the version.`)

if (!run('npm', ['run', 'lint']) || !run('npm', ['test'])) fail('a check failed; nothing was published.')
if (!run('npm', ['publish', '--provenance', '--access', 'public'])) fail('npm refused the publish.')
console.log(`publish: ${name}@${version} is on npm. Roll it out with \`npm run runner-release candidate ${version} <percent>\` in cloud/.`)
