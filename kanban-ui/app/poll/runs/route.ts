import { ensureDispatcher } from "@/lib/dispatcher";
import { listSessions } from "@/lib/registry";

// The timed polls read over plain GETs (#1719): a server action waits in the router's queue,
// and so holds up a card the user just clicked open.

export const dynamic = "force-dynamic";

export async function GET() {
  ensureDispatcher();
  return Response.json(await listSessions(), { headers: { "Cache-Control": "no-store" } });
}
