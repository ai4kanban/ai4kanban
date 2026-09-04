// The browser half of the GitHub sign-in (#322) — the pieces its two routes share.
//
// PKCE, like the app's: the tokens come back over a POST this Worker makes, so a session
// never travels in a URL a browser history, a proxy log or a referrer could keep. The secret
// half waits in a short-lived `httpOnly` cookie rather than on a machine, because there is
// no machine here.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import { bytesToBase64Url } from "./base64url";

/** What the started sign-in leaves behind: the verifier, and the page the reader asked for. */
export const PENDING_COOKIE = "akb_signin";

/** How long a started sign-in stays good. Long enough to read a consent screen, short
 *  enough that an abandoned one is not still waiting tomorrow. */
export const PENDING_MAX_AGE_SECONDS = 10 * 60;

export const pendingCookie = (value: string) =>
  ({
    name: PENDING_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
  }) as const;

/** Where the consent screen comes back to. Read off the request rather than written down,
 *  so a preview deploy signs in against itself. */
export const callbackUrl = (request: NextRequest): string =>
  new URL("/signin/callback", request.nextUrl.origin).toString();

/** The secret half and the public half of one sign-in. */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: bytesToBase64Url(new Uint8Array(digest)) };
}

/**
 * Whether this caller may take another turn on the open routes.
 *
 * Keyed on the client Cloudflare already identified, so a stranger hammering the sign-in
 * costs one counter rather than the day's write budget — which counts writes inside a
 * mutation's transaction and bounds no read at all.
 *
 * A build with no limiter bound — `next dev`, a preview — lets the caller through: a
 * missing binding is a local run, not an attack.
 */
export async function withinRate(request: NextRequest): Promise<boolean> {
  let limiter: CloudflareEnv["SIGNIN_LIMITER"] | undefined;
  try {
    limiter = getCloudflareContext().env.SIGNIN_LIMITER;
  } catch {
    // No Worker around this render — `next dev`. There is nothing to bound and nothing to
    // spend, and refusing every sign-in would make the app impossible to run locally.
    return true;
  }
  if (!limiter) return true;
  const key = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await limiter.limit({ key });
  return success;
}
