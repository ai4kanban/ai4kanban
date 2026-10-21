// Start the 7-day Pro trial (#1932): the settings form posts here, and the pricing page links
// here, through the sign-in when signed out. Either way it lands on /settings, which shows the
// trial, or the purchase for an account that already had Pro.

import { NextResponse, type NextRequest } from "next/server";
import { startTrial } from "../../../lib/cloud";
import { SESSION_COOKIE, decodeSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

async function start(request: NextRequest): Promise<NextResponse> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/signin?next=%2Fbilling%2Ftrial", request.url), 303);
  const billing = await startTrial(session.accessToken);
  return NextResponse.redirect(new URL(billing ? "/settings" : "/settings?trial=failed", request.url), 303);
}

export const POST = start;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Only a page opened on purpose: an image or a frame elsewhere must not spend the trial.
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return NextResponse.redirect(new URL("/settings", request.url), 303);
  return start(request);
}
