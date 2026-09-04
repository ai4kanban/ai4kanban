// Finish a sign-in: the consent screen's answer, turned into the browser's session cookie,
// and then the page the reader asked for in the first place.

import { NextResponse, type NextRequest } from "next/server";
import { fromBase64Url } from "../../../lib/base64url";
import { endpoints } from "../../../lib/cloud";
import { safeNext } from "../../../lib/reader";
import { SIGN_IN_FAILED, encodeSession, sessionCookie, sessionFrom } from "../../../lib/session";
import { PENDING_COOKIE, withinRate } from "../../../lib/signin";

export const dynamic = "force-dynamic";

/** Back to the top with nothing kept, told the sign-in did not finish. A sign-in that did not
 *  complete is not an error page: the reader lands where they started and the way in is on it.
 *
 *  Not the page they asked for, and not a bare `/`: both are signed out, and both answer that
 *  by starting the very sign-in that just failed — a reader who declined the consent screen
 *  would meet it again, and a sign-in Auth cannot finish would loop until the browser gave up.
 *  `pending.next` is dropped with it; the reader presses Sign in here and starts over. */
function giveUp(request: NextRequest) {
  const out = NextResponse.redirect(new URL(`/?${SIGN_IN_FAILED}`, request.nextUrl.origin), {
    status: 302,
  });
  out.cookies.delete(PENDING_COOKIE);
  return out;
}

export async function GET(request: NextRequest) {
  if (!(await withinRate(request))) {
    return new NextResponse("Too many sign-in attempts. Try again shortly.", { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  // The consent screen was declined, or GitHub refused. Nothing to report on a page that
  // shows no board either way.
  if (params.get("error") || params.get("error_description")) return giveUp(request);

  const code = params.get("code");
  const pending = readPending(request.cookies.get(PENDING_COOKIE)?.value);
  if (!code || !pending) return giveUp(request);

  const { supabaseUrl, anonKey } = endpoints();
  let answer: Response;
  try {
    answer = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: pending.verifier }),
    });
  } catch {
    return giveUp(request);
  }
  if (!answer.ok) return giveUp(request);

  const session = sessionFrom(await answer.json().catch(() => null));
  if (!session) return giveUp(request);

  const out = NextResponse.redirect(new URL(pending.next, request.nextUrl.origin), { status: 302 });
  out.cookies.set(sessionCookie(encodeSession(session)));
  // One answer, one use: the verifier is spent the moment it is read.
  out.cookies.delete(PENDING_COOKIE);
  return out;
}

function readPending(value: string | undefined): { verifier: string; next: string } | null {
  if (!value) return null;
  try {
    const held = JSON.parse(fromBase64Url(value)) as {
      verifier?: string;
      next?: string;
    };
    return held.verifier ? { verifier: held.verifier, next: safeNext(held.next) } : null;
  } catch {
    return null;
  }
}
