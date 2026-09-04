// Start a sign-in. One of the two routes here that answer a caller with no session.

import { NextResponse, type NextRequest } from "next/server";
import { toBase64Url } from "../../lib/base64url";
import { endpoints } from "../../lib/cloud";
import { safeNext } from "../../lib/reader";
import { callbackUrl, pendingCookie, pkce, withinRate } from "../../lib/signin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await withinRate(request))) {
    return new NextResponse("Too many sign-in attempts. Try again shortly.", { status: 429 });
  }

  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const { verifier, challenge } = await pkce();

  const { supabaseUrl } = endpoints();
  const consent = new URL(`${supabaseUrl}/auth/v1/authorize`);
  consent.searchParams.set("provider", "github");
  consent.searchParams.set("redirect_to", callbackUrl(request));
  // The same one grant the app asks for: a verified address to answer an invite request
  // with, and no repository reachable with it.
  consent.searchParams.set("scopes", "user:email");
  consent.searchParams.set("code_challenge", challenge);
  consent.searchParams.set("code_challenge_method", "s256");

  const out = NextResponse.redirect(consent, { status: 302 });
  out.cookies.set(pendingCookie(toBase64Url(JSON.stringify({ verifier, next }))));
  return out;
}
