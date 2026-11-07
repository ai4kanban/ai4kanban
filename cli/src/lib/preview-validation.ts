import fs from 'node:fs'
import path from 'node:path'

import { bodySources, kindOf } from '../../../artifact-sdk/src/internal/references'
import { specHeadingRe } from './agents'
import { drawMockup } from './draw-mockup'
import { ASSETS, MOCKUPS } from './paths'
import { scanCardLines, type ContractError } from './spec-contract'

export function renderError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const { message, stack } = error as { message?: string; stack?: string }
  const location = stack?.split('\n').find(line => /^\s*at /.test(line) && /\.(?:tsx?|jsx?|mjs):\d+/.test(line))?.trim()
  const reason = message ?? String(error)
  return location && !reason.includes(location) ? `${reason} (${location})` : reason
}

/** Validate every local screen once, retaining all errors for the designer's next turn. */
export async function validateScreens(files: Iterable<string>): Promise<ContractError[]> {
  const errors: ContractError[] = []
  const entries = new Map<string, string>()
  for (const file of files) entries.set(fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file), path.resolve(file))
  for (const file of entries.values()) {
    try {
      await drawMockup(file)
    } catch (error) {
      errors.push({ file, line: 1, rule: 'preview-render', message: renderError(error) })
    }
  }
  return errors
}

export async function validatePreview(file: string, text: string): Promise<ContractError[]> {
  const { visible } = scanCardLines(text.split('\n'))
  let own = false
  const section: string[] = []
  for (const line of visible) {
    if (/^ {0,3}##\s/.test(line)) own = specHeadingRe('ui-designer').test(line.trim())
    if (/^ {0,3}<!--\s*agent\s*-->\s*$/.test(line)) own = false
    if (own) section.push(line)
  }
  const files = bodySources(section.join('\n')).filter(src => !/^[a-z][\w+.-]*:|^#|^\/\//i.test(src) && kindOf(path.extname(src).toLowerCase()) === 'html')
    .map(src => src.startsWith('.assets/') ? path.join(ASSETS, src.slice(8))
      : src.startsWith('.mockups/') ? path.join(MOCKUPS, src.slice(9))
        : path.resolve(path.dirname(file), src))
  return validateScreens(files)
}
