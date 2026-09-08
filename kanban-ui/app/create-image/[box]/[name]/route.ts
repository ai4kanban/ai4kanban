import fs from "node:fs";
import { runPictureFile } from "@/lib/create-pictures";

// The bytes of one picture pasted into Add task or Build now (#517) — the create sheet's
// answer to app/chat-image/, and the same one: a URL is fetched once and then the browser's
// to cache, where an action would carry a screenshot back through the render payload.
//
// Nothing here takes a path. The address is a box and a file name, and the command is what
// turns the two into a file inside that box's own folder.

export const dynamic = "force-dynamic";

const NOT_FOUND = new Response(null, { status: 404 });

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ box: string; name: string }> },
) {
  const { box, name } = await params;
  const file = await runPictureFile(decodeURIComponent(box), decodeURIComponent(name));
  if (!file) return NOT_FOUND;

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    return NOT_FOUND;
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream",
      // The name is a fresh uuid per paste and the file never changes under it, so the
      // browser may keep it for as long as it likes.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
