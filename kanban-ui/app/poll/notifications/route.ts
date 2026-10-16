import { readCenter } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const center = await readCenter({
    todo: Number(q.get("todo")),
    landed: Number(q.get("landed")),
    cards: (q.get("cards") ?? "").split(",").filter(Boolean).map(Number),
  });
  return Response.json(center, { headers: { "Cache-Control": "no-store" } });
}
