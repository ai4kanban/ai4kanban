// Manage billing and Update payment (#1037): Creem's customer portal, where cancelling,
// resuming and changing the card all happen. A form post, so no other site can press it.

import { NextResponse, type NextRequest } from "next/server";
import { openPortal } from "../../../lib/cloud";
import { SESSION_COOKIE, decodeSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/signin?next=%2Fsettings", request.url), 303);
  const url = await openPortal(session.accessToken);
  return NextResponse.redirect(url ?? new URL("/settings?portal=failed", request.url), 303);
}
