// What an inbox item is called when nothing said (#499).
//
// The pull no longer demands a source id, and a dropped file or a pasted link never had one.
// A derived id is a hash of the strongest identity the item carries — its link, or its words
// — so the same thing added twice is the same id, and dismissing it keeps it away.

import { createHash } from 'node:crypto'

/** What marks an id the board made up rather than one a source gave it. */
export const DERIVED = 'derived-'

/** A stable id for something that supplied none. The same seed always gives the same id. */
export const derivedSourceId = (seed: string): string =>
  `${DERIVED}${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`

/** The site a link is on, or empty when it is not a link. What stands in for a source name
 *  when nothing named one. */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Whether what was pasted is one link and nothing else. */
export function asLink(text: string): string {
  const one = text.trim()
  if (/\s/.test(one) || !/^https?:\/\//i.test(one)) return ''
  try {
    return new URL(one).href
  } catch {
    return ''
  }
}
