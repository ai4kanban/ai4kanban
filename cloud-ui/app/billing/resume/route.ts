// Resume renewal (#1682): undo a cancellation still inside its period, without Creem's portal.
// A form post, so no other site can press it.

import { NextResponse, type NextRequest } from "next/server";
import { resumeRenewal } from "../../../lib/cloud";
import { SESSION_COOKIE, decodeSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/signin?next=%2Fsettings", request.url), 303);
  const billing = await resumeRenewal(session.accessToken);
  return NextResponse.redirect(new URL(billing ? "/settings" : "/settings?resume=failed", request.url), 303);
}
