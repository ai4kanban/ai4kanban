// The board draws a `<Mockup>` tag only where it stands alone in its paragraph, so
// `spec-write` repairs the spacing on the way in (#306 shipped broken without it).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fixMockupBlocks } from '../src/lib/mockups.ts'

describe('fixMockupBlocks', () => {
  it('parts a tag from the prose glued under it', () => {
    assert.equal(
      fixMockupBlocks(['<Mockup src=".mockups/306/a.tsx" label="A" />', 'Folded rows: cheap to read.'].join('\n')),
      ['<Mockup src=".mockups/306/a.tsx" label="A" />', '', 'Folded rows: cheap to read.'].join('\n'),
    )
  })

  it('parts a tag from the prose sharing its line', () => {
    assert.equal(
      fixMockupBlocks('<Mockup src=".mockups/306/a.tsx" /> Folded rows.'),
      ['<Mockup src=".mockups/306/a.tsx" />', '', 'Folded rows.'].join('\n'),
    )
  })

  it('gives two tags on one line a paragraph each', () => {
    assert.equal(
      fixMockupBlocks('text\n<Mockup src="a.tsx" /><Mockup src="b.tsx" />\ntext'),
      ['text', '', '<Mockup src="a.tsx" />', '', '<Mockup src="b.tsx" />', '', 'text'].join('\n'),
    )
  })

  it('leaves a body already in shape byte for byte', () => {
    const body = ['## Layouts', '', '<Mockup src="a.tsx" label="A" />', '', 'Folded rows.', ''].join('\n')
    assert.equal(fixMockupBlocks(body), body)
  })

  it('leaves a tag inside a fence as text', () => {
    const body = ['```', '<Mockup src="a.tsx" />', 'the shape', '```'].join('\n')
    assert.equal(fixMockupBlocks(body), body)
  })

  it('leaves a tag quoted mid-sentence alone', () => {
    const body = 'Point at it with a `<Mockup src="a.tsx" />` tag.'
    assert.equal(fixMockupBlocks(body), body)
  })
})
