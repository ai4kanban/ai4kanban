// Keeping the browser session alive (#322).
//
// A Supabase access token lasts an hour and the refresh token outlives it, so a visit
// tomorrow has to trade one for the other. A server component cannot set a cookie, and this
// is the one place that can — so the refresh happens here, once, before the page renders,
// and the fresh token is put on the REQUEST as well as the response so the render that
// follows uses it rather than the one that just expired.
//
// A refresh that fails leaves the cookie exactly as it is when the network is what failed:
// unreachable is not signed out, and a reader on a bad connection must not be signed out by
// it. Auth answering and refusing the token IS the sign-in being over, and then the cookie
// goes.

import { NextResponse, type NextRequest } from "next/server";
import { endpoints } from "./lib/cloud";
import {
  SESSION_COOKIE,
  encodeSession,
  expiringSoon,
  sessionCookie,
  sessionFrom,
  sessionOf,
} from "./lib/session";

export const config = {
  // Everything but the build's own assets. The sign-in routes are in it on purpose: one
  // arriving with a session that is about to expire should not start a second sign-in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(request: NextRequest) {
  const session = sessionOf(request);
  if (!session || !expiringSoon(session)) return NextResponse.next();

  const { supabaseUrl, anonKey } = endpoints();
  let answer: Response;
  try {
    answer = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch {
    return NextResponse.next();
  }

  if (!answer.ok) {
    // A 5xx is Auth having a bad minute, which is not the sign-in ending.
    if (answer.status >= 500) return NextResponse.next();
    // The sign-in is over. The render that follows has to see that too, or it would read the
    // board with the token Auth just refused and answer a member with the refusal a stranger
    // gets; with the cookie off the request it sees a signed-out reader and sends them to
    // sign in again.
    const out = NextResponse.next({ request: { headers: cookiesWith(request, null) } });
    out.cookies.delete(SESSION_COOKIE);
    return out;
  }

  const fresh = sessionFrom(await answer.json().catch(() => null), session);
  if (!fresh) return NextResponse.next();

  const value = encodeSession(fresh);
  const out = NextResponse.next({ request: { headers: cookiesWith(request, value) } });
  out.cookies.set(sessionCookie(value));
  return out;
}

/** This request's headers with our cookie set to `value`, or taken out when it is null. What
 *  puts the refreshed token in front of the render that follows. */
function cookiesWith(request: NextRequest, value: string | null): Headers {
  const headers = new Headers(request.headers);
  const kept = request.cookies.getAll().filter((c) => c.name !== SESSION_COOKIE);
  const line = [
    ...kept.map((c) => `${c.name}=${c.value}`),
    ...(value ? [`${SESSION_COOKIE}=${value}`] : []),
  ].join("; ");
  if (line) headers.set("cookie", line);
  else headers.delete("cookie");
  return headers;
}
