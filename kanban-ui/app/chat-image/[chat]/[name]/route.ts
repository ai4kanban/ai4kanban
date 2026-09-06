import fs from "node:fs";
import { chatImageFile } from "@/lib/chat";
import type { ChatTarget } from "@/lib/types";

// The bytes of one picture pasted into a conversation (#441).
//
// The board's one route handler, and it is one because this is the one thing a server
// action cannot do well: an action would have to carry a screenshot back through the render
// payload as text, on every poll, for every message that ever held one. A URL is fetched
// once and then the browser's to cache.
//
// Nothing here takes a path. The address is a conversation and a file name, and the command
// is what turns the two into a file inside that conversation's own folder — so the only
// pictures this serves are ones the board itself wrote.

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
  { params }: { params: Promise<{ chat: string; name: string }> },
) {
  const { chat, name } = await params;
  const target = targetOf(chat);
  if (target === undefined) return NOT_FOUND;

  const file = await chatImageFile(target, decodeURIComponent(name));
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
      // browser may keep it for as long as it likes. A cleared conversation takes the
      // address with it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

// The conversation this address names: the board's, the first run's, or one card's.
function targetOf(chat: string): ChatTarget | undefined {
  if (chat === "board") return null;
  if (chat === "setup") return "setup";
  return /^\d+$/.test(chat) ? Number(chat) : undefined;
}
