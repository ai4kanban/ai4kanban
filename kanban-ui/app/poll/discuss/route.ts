import { canDiscuss, readDiscuss } from "@/lib/discuss";
import { chatTarget } from "@/lib/discussions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = await chatTarget(new URL(request.url).searchParams.get("discussion"));
  const [read, supported] = await Promise.all([readDiscuss(target ?? null), canDiscuss()]);
  return Response.json({ ...read, supported }, { headers: { "Cache-Control": "no-store" } });
}
