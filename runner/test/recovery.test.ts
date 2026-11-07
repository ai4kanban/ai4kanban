import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toWire } from '../src/jobs'
import { checkpointEvent, replayable, replyRetry, type Checkpoint } from '../src/recovery'

test('对话重试包含工具等待时间、服务端等待时间和三次预算', () => {
  const checkpoint: Checkpoint = { pending: [], retry: { since: 0, attempt: 1 } }
  assert.equal(replyRetry(checkpoint, 'unknown failure', 119_999, () => 2), null)
  assert.equal(replyRetry(checkpoint, 'retry-after: 121', 0), null)
  assert.equal(replyRetry(checkpoint, 'retry after 20', 0), 20_000)
  checkpoint.retry!.attempt = 3
  assert.equal(replyRetry(checkpoint, 'unknown failure', 0, () => 0), null)
})

test('完成的写入保留副作用标记，未知旧进度不能证明可重放', () => {
  const checkpoint: Checkpoint = { pending: [], effects: false }
  assert.equal(replayable(checkpoint), true)
  checkpointEvent(checkpoint, { kind: 'tool_call', data: { toolCallId: 'write', title: 'write', kind: 'edit', status: 'in_progress' } })
  checkpointEvent(checkpoint, { kind: 'tool_call_update', data: { toolCallId: 'write', status: 'completed' } })
  assert.deepEqual(checkpoint.pending, [])
  assert.equal(replayable(checkpoint), false)
  assert.equal(replayable({ pending: [] }), false)
})

test('恢复状态在活动流中独立成项，避免与错误日志拼接', () => {
  const wire = toWire([
    { kind: 'log', data: { text: 'provider failure' } },
    { kind: 'log', data: { text: '[chat-recovery] waiting' } },
    { kind: 'log', data: { text: 'next attempt' } },
  ], 0)
  assert.deepEqual(wire.map(e => e.text), ['provider failure', '[chat-recovery] waiting', 'next attempt'])
})
