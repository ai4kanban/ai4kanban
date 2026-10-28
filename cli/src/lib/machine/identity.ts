// What a person calls this machine.

import os from 'node:os'

/** The hostname, without the mDNS suffix macOS adds. */
export function machineName(): string {
  const raw = os.hostname().trim()
  return raw.replace(/\.local$/i, '') || 'this machine'
}
