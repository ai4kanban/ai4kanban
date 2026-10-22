import { deliveryDiff, deliveryPlan } from "@/lib/board";

// What a card page asks git for, once it is drawn: the Implement plan (`card`) and a
// delivery's Diff (`delivery`). A GET, so it never waits behind the page's other actions.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const card = Number(params.get("card"));
  const delivery = params.get("delivery");
  const [plan, diff] = await Promise.all([
    Number.isInteger(card) && params.has("card") ? deliveryPlan(card) : null,
    delivery ? deliveryDiff(delivery) : null,
  ]);
  return Response.json({ plan, diff }, { headers: { "Cache-Control": "no-store" } });
}
