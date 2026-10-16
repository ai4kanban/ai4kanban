import { getSession } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const run = id ? await getSession(id) : null;
  return Response.json(run, { headers: { "Cache-Control": "no-store" } });
}
