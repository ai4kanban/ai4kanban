// End the BROWSER's sign-in, and nothing else.
//
// The cookie goes, and this session's own refresh token is revoked at Supabase with
// `scope=local` — this one session and no other. The machine's sign-in is a different
// session entirely, held in the user's home directory, so an app that was working goes on
// working. A global sign-out here would end it, which is exactly what a reader on a borrowed
// laptop must not be able to do by pressing Sign out.
//
// POST rather than GET: a link somebody else puts on a page must not be able to sign a
// reader out, and `SameSite=Lax` does not carry the cookie on a cross-site POST.

import { NextResponse, type NextRequest } from "next/server";
import { endpoints } from "../../lib/cloud";
import { SESSION_COOKIE, SIGNED_OUT, sessionOf } from "../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = sessionOf(request);
  if (session) {
    const { supabaseUrl, anonKey } = endpoints();
    // Best-effort: the cookie is what actually signs this browser out, and a revoke that
    // could not be sent must not leave the reader still signed in on screen.
    await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: anonKey, authorization: `Bearer ${session.accessToken}` },
    }).catch(() => undefined);
  }
  // The top of the site, told a sign-out is what brought the reader here. Without that it
  // would send them into a sign-in the browser's live GitHub session finishes on its own,
  // and Sign out would hand back the session it just ended.
  const out = NextResponse.redirect(new URL(`/?${SIGNED_OUT}`, request.nextUrl.origin), {
    status: 303,
  });
  out.cookies.delete(SESSION_COOKIE);
  return out;
}
