import { readMockup, readMockupCode } from "@/lib/mockup";

// One screen a card page left undrawn (#906), drawn on its own request as it scrolls near —
// or, with `part=code`, only the file's text. Never the two together: the text is what the
// page used to carry for every screen whether the switch was used or not.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const src = params.get("src") ?? "";
  if (params.get("part") === "code") return Response.json(await readMockupCode(src));
  return Response.json({ ...(await readMockup(src)), code: undefined });
}
