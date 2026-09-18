// Serving one asset file's bytes (#803, #872). Kept free of the app's own imports so a
// plain `node --test` can load it.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

export const ASSET_TYPES: Record<string, string> = { ...IMAGE_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES };

/** `[start, end]` inclusive for one `bytes=` range, `"unsatisfiable"` for one past the end,
 *  and `null` for no range, a malformed one or several — all served whole. */
export function parseRange(header: string | null, size: number): [number, number] | "unsatisfiable" | null {
  const m = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return [Math.max(0, size - suffix), size - 1];
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size) return "unsatisfiable";
  if (end < start) return null;
  return [start, end];
}

/** One path segment that cannot climb or hide. */
export const SEGMENT = /^(?!\.)[^/\\]+$/;

/** `folder/name` in the first root that has it. `null` when it is in none of them, or the
 *  names try to climb. */
export function findIn(roots: string[], folder: string, name: string): string | null {
  if (!SEGMENT.test(folder) || !SEGMENT.test(name)) return null;
  for (const root of roots) {
    const file = path.join(root, folder, name);
    if (!file.startsWith(root + path.sep)) return null;
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      // Not in this folder — try the next.
    }
  }
  return null;
}

const stream = (file: string, start: number, end: number) =>
  Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;

/** The file, streamed: whole, or the one range asked for. */
export function fileResponse(file: string, type: string, range: string | null): Response {
  const size = fs.statSync(file).size;
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    // An SVG opened on its own must not run as a page of the board.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
  const want = parseRange(range, size);
  if (want === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (!want) {
    return new Response(size ? stream(file, 0, size - 1) : null, {
      headers: { ...headers, "Content-Length": String(size) },
    });
  }
  const [start, end] = want;
  return new Response(stream(file, start, end), {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}

const NOT_FOUND = () => new Response(null, { status: 404 });

/** The response for `/asset-image/<folder>/<name>`, looked up in the card asset roots only. */
export function serveAsset(roots: string[], folder: string, name: string, range: string | null): Response {
  const type = ASSET_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return NOT_FOUND();
  try {
    const file = findIn(roots, folder, name);
    return file ? fileResponse(file, type, range) : NOT_FOUND();
  } catch {
    return NOT_FOUND();
  }
}
