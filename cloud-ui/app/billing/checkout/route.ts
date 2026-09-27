// The pricing page's Get Pro (#1037). Signed out goes through the sign-in and comes back here;
// otherwise Cloud answers with a Creem checkout, or with `/settings` for somebody already Pro.

import { NextResponse, type NextRequest } from "next/server";
import { startCheckout } from "../../../lib/cloud";
import { SESSION_COOKIE, decodeSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const period = request.nextUrl.searchParams.get("period") === "monthly" ? "monthly" : "yearly";
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const next = `/billing/checkout?period=${period}`;
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}`, request.url), 303);
  }
  const url = await startCheckout(session.accessToken, period);
  return NextResponse.redirect(new URL(url ? samePage(url) : "/settings?checkout=failed", request.url), 303);
}

/** Cloud names these pages by their public address; kept as a path so a local run stays local. */
function samePage(url: string): string {
  const held = new URL(url);
  return held.origin === "https://cloud.ai4kanban.dev" ? `${held.pathname}${held.search}` : url;
}
