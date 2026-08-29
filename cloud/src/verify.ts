/** The two pieces every connector's callback check needs, whatever it signs with. */

export const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Compared without an early exit, so the comparison itself says nothing about how close a
 *  wrong signature was. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let same = 0
  for (let i = 0; i < a.length; i += 1) same |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return same === 0
}
