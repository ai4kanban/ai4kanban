import { readChatOf } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** `card` is a card id or a discussion; absent, the board's own conversation. */
export async function GET(request: Request) {
  const card = new URL(request.url).searchParams.get("card");
  const target = card === null ? null : /^\d+$/.test(card) ? Number(card) : card;
  return Response.json(await readChatOf(target), { headers: { "Cache-Control": "no-store" } });
}
