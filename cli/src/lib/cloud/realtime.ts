// Keeping a private Realtime topic signed in.
//
// Supabase Realtime authorizes a private topic with the same Supabase JWT the Worker
// verifies, and it holds the one it was given for the life of the connection — so a
// refreshed session has to be handed to it as well, or the socket is quietly the only part
// of the machine still using an expired sign-in. #319's event stream connects through this.

import { accessToken } from './session'

/** The one thing this needs of a Realtime client. Typed here rather than imported, so the
 *  board's rules stay dependency-free and #319 chooses the client. */
export interface Authorizable {
  setAuth(token: string): void | Promise<void>
}

/** How often the token in the socket is compared with the one on disk. Well inside the
 *  refresh margin, so the socket is never carrying an expired token. */
const CHECK_MS = 30_000

/**
 * Hand `client` a fresh token now and whenever it changes. Returns the way to stop.
 *
 * It refreshes through the same lock every other reader uses, so a board server and a
 * terminal watching at once still spend one refresh between them.
 */
export function keepAuthorized(client: Authorizable, checkMs = CHECK_MS): () => void {
  let last: string | null = null
  let stopped = false

  const push = async () => {
    const token = await accessToken()
    if (stopped || !token.ok || token.token === last) return
    last = token.token
    await client.setAuth(token.token)
  }

  void push()
  const timer = setInterval(() => void push(), checkMs)
  // Nothing here should hold a command open.
  timer.unref?.()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
