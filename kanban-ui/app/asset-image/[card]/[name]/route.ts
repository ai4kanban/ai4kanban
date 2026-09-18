import { serveAsset } from "@/lib/asset-bytes";
import { assetRoots } from "@/lib/mockup";

// The bytes of one image, video or audio file a card's `<Asset>` tag shows (#803, #872). The
// address is a card id and a file name, never a path, and the file is looked up in that card's
// asset folder only.

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ card: string; name: string }> },
) {
  const { card, name } = await params;
  let roots: string[];
  try {
    roots = await assetRoots();
  } catch {
    return new Response(null, { status: 404 });
  }
  return serveAsset(roots, decodeURIComponent(card), decodeURIComponent(name), request.headers.get("range"));
}
