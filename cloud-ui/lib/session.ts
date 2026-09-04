// The browser's own sign-in (#322).
//
// A second sign-in, not a borrowed one. The app's session lives in the user's home
// directory behind a URL scheme only the desktop app answers, so a borrowed laptop has no
// way to reach it — and the two are meant to be independent: each starts its own PKCE flow
// and gets its own Supabase session, so ending either leaves the other signed in.
//
// It is held in ONE cookie, `httpOnly` and `secure`, so nothing on the page can read the
// tokens and nothing about the sign-in ever travels in a URL. `SameSite=Lax` is what lets
// the GitHub callback arrive carrying it while a cross-site POST does not.
//
// Refreshing is `middleware.ts`'s: a server component cannot set a cookie, so the one place
// that can is what keeps a visit tomorrow signed in.

import type { NextRequest } from "next/server";
import { fromBase64Url, toBase64Url } from "./base64url";

export const SESSION_COOKIE = "akb_session";

/** What `/signout` lands on `/` carrying. The top of the site sends a signed-out reader
 *  straight into a sign-in, and a browser whose GitHub session is live finishes one without
 *  asking — so the page a sign-out lands on has to know it is that page and stop there. */
export const SIGNED_OUT = "signedout";

/** What a sign-in that did not finish lands on `/` carrying, for the same reason: the top of
 *  the site starts a sign-in, so landing a failed one back on a signed-out page would start
 *  the sign-in that has just failed, over and over. */
export const SIGN_IN_FAILED = "signinfailed";

/** How long the cookie itself lives. Supabase's refresh token outlives an access token by
 *  far, so this is what "stays signed in across visits" actually costs — a month, then the
 *  reader signs in again. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Refresh this long before the access token runs out, so a request never carries one that
 *  expires in flight. The app's own session uses the same margin. */
export const REFRESH_MARGIN_MS = 60_000;

/** What the cookie holds. Nothing here decides anything: whether this account may read a
 *  workspace is the service's answer, asked on every read. */
export interface BrowserSession {
  v: 1;
  accessToken: string;
  refreshToken: string;
  /** When the access token runs out, in milliseconds. */
  expiresAt: number;
  /** The Supabase user id, for the log — never shown and never sent. */
  subject: string;
}

export const encodeSession = (session: BrowserSession): string =>
  toBase64Url(JSON.stringify(session));

/** A cookie value back as a session, or null. Unreadable reads as signed out: a truncated
 *  cookie is not a session, and refusing to draw over one would leave no way back in. */
export function decodeSession(value: string | undefined): BrowserSession | null {
  if (!value) return null;
  try {
    const held = JSON.parse(fromBase64Url(value)) as Partial<BrowserSession>;
    if (!held.accessToken || !held.refreshToken || !held.subject) return null;
    return { v: 1, accessToken: held.accessToken, refreshToken: held.refreshToken, subject: held.subject, expiresAt: Number(held.expiresAt) || 0 };
  } catch {
    return null;
  }
}

/** How the cookie is written, wherever it is written. */
export const sessionCookie = (value: string) =>
  ({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }) as const;

export const expiringSoon = (session: BrowserSession, now = Date.now()): boolean =>
  session.expiresAt - REFRESH_MARGIN_MS <= now;

/** The session this request carries, or null. */
export const sessionOf = (request: NextRequest): BrowserSession | null =>
  decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

/** A Supabase token response, as the session we hold. Keeps the subject the previous one
 *  carried, since a refresh answers with tokens rather than with a user. */
export function sessionFrom(body: unknown, previous?: BrowserSession | null): BrowserSession | null {
  const token = body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    user?: { id?: string };
  };
  const subject = token.user?.id ?? previous?.subject;
  if (!token.access_token || !token.refresh_token || !subject) return null;
  return {
    v: 1,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at ? token.expires_at * 1000 : Date.now() + (token.expires_in ?? 3600) * 1000,
    subject,
  };
}
