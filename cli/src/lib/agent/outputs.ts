// What a `files` delivery leaves behind (#874): the files its card records, and nothing
// else in the project's tracked tree.
//
// A file is recorded as a ticked todo naming its path in backticks. The todos the plan
// wrote are left out — ticking one is progress, not a record — so the board notes their
// wording when the delivery starts.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { locate } from '../cards'
import { ASSETS, REPO_ROOT } from '../paths'
import type { DeliveryRecord } from './types'
import { trackedChanges } from './worktree'

const TODO = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/

function cardBody(cardId: number): string {
  const found = locate(cardId)
  if (!found) return ''
  try {
    return fs.readFileSync(found.kind === 'group' ? path.join(found.target, 'root.md') : found.target, 'utf8')
  } catch {
    return ''
  }
}

const todos = (cardId: number): { done: boolean; text: string }[] =>
  cardBody(cardId)
    .split('\n')
    .flatMap((line) => {
      const m = TODO.exec(line)
      return m ? [{ done: m[1] !== ' ', text: m[2]!.trim() }] : []
    })

/** The todos a card has not ticked yet — what a delivery notes as it starts. */
export const plannedTodos = (cardId: number): string[] => todos(cardId).filter((t) => !t.done).map((t) => t.text)

const looksLikePath = (token: string): boolean =>
  !/\s/.test(token) && !token.includes('://') && !token.startsWith('-') && (token.includes('/') || /\.\w{1,8}$/.test(token))

const resolveOutput = (file: string): string => {
  if (file.startsWith('~/')) return path.join(os.homedir(), file.slice(2))
  if (path.isAbsolute(file)) return file
  if (file.startsWith('.assets/')) return path.join(ASSETS, file.slice('.assets/'.length))
  return path.join(REPO_ROOT, file)
}

/** The files this delivery's card records, in the order it names them. */
export function recordedOutputs(delivery: Pick<DeliveryRecord, 'cardId' | 'planned'>): string[] {
  if (delivery.cardId === null) return []
  const planned = new Set(delivery.planned ?? [])
  const out: string[] = []
  for (const todo of todos(delivery.cardId)) {
    if (!todo.done || planned.has(todo.text)) continue
    for (const m of todo.text.matchAll(/`([^`]+)`/g)) {
      const file = m[1]!.trim()
      if (looksLikePath(file) && !out.includes(file)) out.push(file)
    }
  }
  return out
}

/** Why a `files` delivery has not delivered, or nothing when it has. */
export function filesStop(delivery: DeliveryRecord): { reason: 'outside' | 'output'; why: string; paths: string[] } | undefined {
  if (delivery.base) {
    const before = delivery.touched ?? {}
    const now = trackedChanges()
    const changed = [...new Set([...Object.keys(now), ...Object.keys(before)])].filter((f) => before[f] !== now[f])
    if (changed.length) {
      return {
        reason: 'outside',
        why: `it changed tracked files outside the board: ${changed.join(', ')}. Nothing was reverted`,
        paths: changed,
      }
    }
  }
  const outputs = recordedOutputs(delivery)
  if (!outputs.length) {
    return { reason: 'output', why: 'the card records no output file', paths: [] }
  }
  const missing = outputs.filter((f) => !fs.existsSync(resolveOutput(f)))
  if (missing.length) {
    return { reason: 'output', why: `recorded output files are missing: ${missing.join(', ')}`, paths: missing }
  }
  return undefined
}
