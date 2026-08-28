// The account's picture, fetched once and kept beside the sign-in.
//
// The board draws it from the bytes it holds rather than from the provider's URL, so no
// screen in this app reaches out to a third host to paint itself — a machine off the
// network still shows the face it saw last, and opening the dialog is never a request
// GitHub can count.
//
// Best effort, always: a picture that will not come back is a set of initials, never an
// error and never a slower sign-in.

import { readSession, writeSession } from './session'

/** Twice the 40px the pane draws it at, which is a retina screen and nothing more. */
const PIXELS = 80
/** A picture larger than this is not a picture we asked for. */
const MAX_BYTES = 256 * 1024
const TIMEOUT_MS = 5_000

/**
 * The picture at `url` as a `data:` URL, taken from the session when it is already there.
 *
 * Keyed on the URL the service attested, so a changed picture is fetched again and an
 * unchanged one costs a file read.
 */
export async function heldAvatar(url: string | null): Promise<string | null> {
  if (!url) return null
  const held = readSession()
  if (!held) return null
  if (held.avatar?.url === url) return held.avatar.data

  const data = await download(url)
  if (!data) return null
  // Re-read: a refresh may have written the file while this was in flight, and its tokens
  // are worth more than our picture.
  const now = readSession()
  if (now) writeSession({ ...now, avatar: { url, data } })
  return data
}

async function download(url: string): Promise<string | null> {
  try {
    const response = await fetch(sized(url), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) return null
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!type.startsWith('image/')) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/** Ask the provider for the size we draw. GitHub reads `s`; a host that does not simply
 *  sends what it has, which the size cap above still holds. */
function sized(url: string): string {
  try {
    const asked = new URL(url)
    asked.searchParams.set('s', String(PIXELS))
    return asked.toString()
  } catch {
    return url
  }
}
