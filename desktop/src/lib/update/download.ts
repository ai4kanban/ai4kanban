// Fetching one file, with the progress the notice shows and the sha512 the
// release published beside it.
//
// Written on node's own http instead of a download library: the whole of it is
// follow the redirects GitHub answers with, count the bytes, hash them on the
// way past, and stop when asked. A file that does not match its sha512 is
// thrown away and reported — that hash, over HTTPS, is the only integrity check
// there is, and it is the same trust as the browser download it replaces.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { pipeline } from "node:stream/promises";

/** GitHub answers an asset URL with a redirect to storage, which redirects
 *  again. Beyond this many, something is wrong rather than slow. */
const MAX_REDIRECTS = 5;

const TIMEOUT_MS = 30_000;

export interface DownloadProgress {
  received: number;
  total: number;
}

function open(url: string, signal?: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https;
    const req = client.get(
      url,
      { headers: { "User-Agent": "ai4kanban-desktop" }, timeout: TIMEOUT_MS, signal },
      (res) => resolve(res),
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

/** The bytes at `url`, into `file`, hashed as they land. Resolves with the
 *  sha512 the bytes actually had — the caller is what compares it, so a
 *  mismatch is one thing to say rather than a code to translate. */
export async function fetchFile(
  url: string,
  file: string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<{ sha512: string; size: number }> {
  let next: string | null = url;
  let res: http.IncomingMessage | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS && next; hop++) {
    res = await open(next, signal);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      next = new URL(location, next).toString();
      res = null;
      continue;
    }
    if (status !== 200) {
      res.resume();
      throw new Error(`the server answered ${status}`);
    }
    next = null;
  }
  if (!res) throw new Error("too many redirects");

  const total = Number(res.headers["content-length"]) || 0;
  const hash = crypto.createHash("sha512");
  let received = 0;
  res.on("data", (chunk: Buffer) => {
    received += chunk.length;
    hash.update(chunk);
    onProgress({ received, total });
  });
  await pipeline(res, fs.createWriteStream(file));
  // A connection that drops partway ends the stream cleanly, so the byte count
  // is what catches it: an incomplete file is a failed download, not a file
  // that fails its checksum three steps later.
  if (total && received !== total) {
    throw new Error(`the connection ended after ${received} of ${total} bytes`);
  }
  return { sha512: hash.digest("base64"), size: received };
}
