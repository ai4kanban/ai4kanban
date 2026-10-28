// A local board's cards as Cloud takes them on import (#2123).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cardForCloud, reviewOf, rewriteRefs } from '../src/commands/cloud-import.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'

const numbers = new Map([[2104, 2], [2123, 4]])

describe('cloud import', () => {
  it('renumbers references to imported cards, marks the rest old, and leaves code alone', () => {
    assert.equal(rewriteRefs('See #2104 and #1998 (#2160).', numbers), 'See #2 and old#1998 (old#2160).')
    assert.equal(rewriteRefs('`#2104` and ## Scope, a#2104, &#2104;', numbers), '`#2104` and ## Scope, a#2104, &#2104;')
    assert.equal(rewriteRefs('```\n#2104\n```\n#2123', numbers), '```\n#2104\n```\n#4')
  })

  it('rewrites the frontmatter: links to imported cards, a build back to ready, an own workflow by its Cloud folder', () => {
    const card = [
      '---', 'title: Import', 'status: implementing', 'blocked_by: [2104, 1500]', 'related: [2123]', 'workflow: wf-2',
      'source:', '  - "#1998"', '---', '', 'Body #2104', '',
    ].join('\n')
    const out = cardForCloud(card, numbers, 'wf-0190ab')
    assert.match(out, /^status: ready$/m)
    assert.match(out, /^blocked_by: \[2\]$/m)
    assert.match(out, /^related: \[4\]$/m)
    assert.match(out, /^workflow: wf-0190ab$/m)
    assert.match(out, /- "old#1998"/)
    assert.ok(out.endsWith('Body #2\n'))
    assert.equal(parseFrontmatter(out).meta?.title, 'Import')
  })

  it('puts a card on review when it waits on the user, asking its first open question with options', () => {
    const meta = (front: string) => parseFrontmatter(`---\ntitle: X\n${front}\n---\n`).meta!
    assert.equal(reviewOf(meta('status: todo')), null)
    assert.equal(reviewOf(meta('status: ready')), true)
    assert.equal(reviewOf(meta('status: todo\nquestions:\n  - "[user] Open the account?"')), true)
    assert.deepEqual(reviewOf(meta([
      'status: todo', 'questions:', '  - "[user] Plain?"', '  - question: "[user] Which tier?"', '    options:', '      - Free', '      - Pro',
    ].join('\n'))), { question: 'Which tier?', options: ['Free', 'Pro'], position: 2 })
  })
})
