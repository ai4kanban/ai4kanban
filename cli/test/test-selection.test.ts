import assert from 'node:assert/strict'
import { it } from 'node:test'

import { selectTests } from '../scripts/test-options.mjs'

const files = ['stop.test.ts', 'landing.test.ts']

it('默认全量，指定文件时只选所需文件并传递用例筛选', () => {
  assert.deepEqual(selectTests(files, []), { tests: files, nodeArgs: [] })
  assert.deepEqual(selectTests(files, ['test/stop.test.ts', 'stop', 'landing.test', '--test-name-pattern', '终止|恢复']), {
    tests: files,
    nodeArgs: ['--test-name-pattern', '终止|恢复'],
  })
  assert.deepEqual(selectTests(files, ['landing', '--test-name-pattern=落地']), {
    tests: ['landing.test.ts'], nodeArgs: ['--test-name-pattern=落地'],
  })
})

it('拼错文件名或参数时失败，避免误跑全量', () => {
  for (const args of [['missing'], ['--typo'], ['stop', '--test-name-pattern']]) {
    assert.throws(() => selectTests(files, args))
  }
})
