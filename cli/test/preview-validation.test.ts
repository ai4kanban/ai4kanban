import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'node:test'

import { validatePreview } from '../src/lib/preview-validation'
import { ASSETS, setBoardRoot } from '../src/lib/paths'

it('checks every screen and variant once, returns all render failures, and ignores examples (#396)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-preview-'))
  try {
    setBoardRoot(root)
    const dir = path.join(ASSETS, '1')
    fs.mkdirSync(dir, { recursive: true })
    const sources = {
      syntax: 'export default () => <main>',
      missing: '\n\nimport X from "./absent"; export default () => <X />',
      unsupported: 'import fs from "node:fs"; export default () => <main>{fs.readFileSync("x")}</main>',
      exception: 'export default () => { throw new Error("render broke") }',
      component: 'export const Screen = () => <main />',
      timeout: 'export default () => { while (true) {} }',
      valid: 'export default () => <main>Ready</main>',
    }
    for (const [name, source] of Object.entries(sources)) fs.writeFileSync(path.join(dir, `${name}.tsx`), source)
    const body = '  ## By `ui-designer` agent\n\n```tsx\n## Example\n<!-- agent -->\n<Asset src=".assets/1/example.tsx" />\n```\n\n' +
      '<!--\n## By `api-designer` agent\n<!-- agent -->\n' +
      Object.keys(sources).map(name => `<Asset src=".assets/1/${name}.tsx" />`).join('\n\n') +
      '\n\n<Asset src=".assets/1/valid.tsx" variants=\'{"same":".assets/1/exception.tsx","other":".assets/1/missing.tsx"}\' />\n\n' +
      '## By `api-designer` agent\n\n<Asset src=".assets/1/api.tsx" />\n'
    const errors = await validatePreview(path.join(root, 'card.md'), body)
    assert.equal(errors.length, 6)
    for (const name of Object.keys(sources).filter(name => name !== 'valid')) assert.ok(errors.some(error => error.file.endsWith(`${name}.tsx`)), name)
    for (const [name, reason] of Object.entries({ syntax: /Unexpected|expected/i, missing: /absent/, unsupported: /node:fs/, exception: /render broke/, component: /default export/, timeout: /timed out/ })) {
      assert.match(errors.find(error => error.file.endsWith(`${name}.tsx`))!.message, reason)
    }
    assert.match(errors.find(error => error.file.endsWith('missing.tsx'))!.message, /missing.tsx:3:/)
    assert.match(errors.find(error => error.file.endsWith('exception.tsx'))!.message, /exception.tsx:1/)
    for (const name of Object.keys(sources)) fs.writeFileSync(path.join(dir, `${name}.tsx`), sources.valid)
    assert.deepEqual(await validatePreview(path.join(root, 'card.md'), body), [])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
