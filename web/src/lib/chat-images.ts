// The pictures sent in an idea chat (#2202), kept in this browser only: Cloud keeps their names,
// never the pictures. Keyed `<discussion>/<message>/<name>`; the oldest go past 200 MB or 30 days.

import type { ChatImage, ChatMessage } from "@review/api";

type Kept = { key: string; chat: string; workspace: string; blob: Blob; at: number };

const STORE = "images";
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_AGE = 30 * 24 * 3600 * 1000;

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("wildcrane-chat-images", 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("chat", "chat");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opened = null;
      reject(req.error);
    };
  });
  return opened;
}

const done = (r: IDBRequest | IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    if (r instanceof IDBTransaction) {
      r.oncomplete = () => resolve();
      r.onerror = r.onabort = () => reject(r.error);
    } else {
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }
  });

async function all(): Promise<Kept[]> {
  const req = (await db()).transaction(STORE).objectStore(STORE).getAll();
  await done(req);
  return req.result as Kept[];
}

async function drop(keep: (k: Kept) => boolean) {
  const gone = (await all()).filter((k) => !keep(k));
  if (!gone.length) return;
  const tx = (await db()).transaction(STORE, "readwrite");
  for (const k of gone) tx.objectStore(STORE).delete(k.key);
  await done(tx);
}

const keyOf = (chat: string, message: string, name: string) => `${chat}/${message}/${name}`;

const blobOf = (i: ChatImage) => new Blob([Uint8Array.from(atob(i.content), (c) => c.charCodeAt(0))], { type: i.type });

/** Keeps the pictures of the user message `chat`'s answer ends with. */
export async function keepImages(chat: string, workspace: string, messages: ChatMessage[], images: ChatImage[]) {
  const sent = messages.findLast((m) => m.role === "user");
  if (!images.length || !sent) return;
  try {
    const at = Date.now();
    const tx = (await db()).transaction(STORE, "readwrite");
    for (const i of images) tx.objectStore(STORE).put({ key: keyOf(chat, sent.id, i.name), chat, workspace, blob: blobOf(i), at } satisfies Kept);
    await done(tx);
    await trim();
  } catch {}
}

/** Past 30 days, then the oldest until all of them fit 200 MB. */
async function trim() {
  const now = Date.now();
  let total = 0;
  const fresh = new Set((await all()).sort((a, b) => b.at - a.at).filter((k) => now - k.at < MAX_AGE && (total += k.blob.size) <= MAX_BYTES).map((k) => k.key));
  await drop((k) => fresh.has(k.key));
}

export async function readImage(chat: string, message: string, name: string): Promise<Blob | undefined> {
  try {
    const req = (await db()).transaction(STORE).objectStore(STORE).get(keyOf(chat, message, name));
    await done(req);
    return (req.result as Kept | undefined)?.blob;
  } catch {
    return undefined;
  }
}

export const forgetChat = (chat: string) => drop((k) => k.chat !== chat).catch(() => {});

/** Drops the pictures of `workspace`'s discussions that are no longer in its whole list. */
export const forgetAllBut = (workspace: string, chats: string[]) => {
  const keep = new Set(chats);
  return drop((k) => k.workspace !== workspace || keep.has(k.chat)).catch(() => {});
};

export const forgetAll = async () => {
  try {
    const tx = (await db()).transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await done(tx);
  } catch {}
};
