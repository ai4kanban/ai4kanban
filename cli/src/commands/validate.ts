import { say } from '../lib/io'
import { die } from '../lib/paths'
import { formatContractErrors, snapshotSpecs, validateSpec } from '../lib/spec-contract'
import type { MoveResult } from '../lib/types'

export function cmdValidate(id?: number): MoveResult {
  const cards = [...snapshotSpecs()].filter(([, card]) => id === undefined || card.id === id)
  if (id !== undefined && !cards.length) die(`no task with id ${id}`, { kind: 'card-not-found', id })
  const errors = cards.flatMap(([file, card]) => validateSpec(file, card.text))
  if (errors.length) die(formatContractErrors(errors), { kind: 'spec-contract', errors })
  say(`Spec format valid (${cards.length} card${cards.length === 1 ? '' : 's'}).`)
  return { valid: true, checked: cards.length, errors: [] }
}
