import { listConversations } from "@/lib/discussions";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listConversations(), { headers: { "Cache-Control": "no-store" } });
}
