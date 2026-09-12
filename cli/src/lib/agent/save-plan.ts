import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { planFile } from '../plans'
import { setChatPlan } from './chat'
import type { ChatTarget } from './types'

/** Publish the body before the link; restore it if the transcript cannot be saved. */
export function savePlan(target: ChatTarget, rel: string, text: string, title?: string): void {
  const file = planFile(rel)
  if (!file || !text.trim()) throw new Error('A valid plan path and nonempty body are required.')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const previous = fs.existsSync(file) ? fs.readFileSync(file) : null
  const tmp = `${file}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(tmp, text)
    fs.renameSync(tmp, file)
    const result = setChatPlan(target, rel, title)
    if ('error' in result) throw new Error(result.error)
  } catch (err) {
    if (previous) fs.writeFileSync(file, previous)
    else fs.rmSync(file, { force: true })
    throw err
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}
