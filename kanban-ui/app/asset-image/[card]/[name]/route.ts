import fs from "node:fs";
import { assetFile, IMAGE_EXTS } from "@/lib/mockup";

// The bytes of one image a card's `<Asset>` tag shows (#803). The address is a card id and a
// file name, never a path, and the file is looked up in that card's asset folder only.

export const dynamic = "force-dynamic";

const NOT_FOUND = new Response(null, { status: 404 });

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ card: string; name: string }> },
) {
  const { card, name } = await params;
  const folder = decodeURIComponent(card);
  const file = decodeURIComponent(name);
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXTS.includes(ext)) return NOT_FOUND;

  let bytes: Buffer;
  try {
    const found = await assetFile(folder, file);
    if (!found) return NOT_FOUND;
    bytes = fs.readFileSync(found);
  } catch {
    return NOT_FOUND;
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[ext]!,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      // An SVG opened on its own must not run as a page of the board.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
