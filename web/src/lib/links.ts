// A task's review link: the one this browser made while it is still active, else a new
// `invited` one. A link's address is shown only when it is made, so it is kept here.

import * as api from "../api";

const KEY = (task: string) => `wildcrane.web.link.${task}`;

export async function reviewLink(task: string): Promise<{ link: api.ShareLink; url: string }> {
  let saved: { id: string; url: string } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY(task)) ?? "null");
  } catch {
    saved = null;
  }
  if (saved) {
    const live = (await api.listShareLinks(task).catch(() => [])).find((l) => l.id === saved!.id && l.active !== false && !l.revoked);
    if (live) return { link: live, url: saved.url };
  }
  const made = await api.createShareLink(task);
  remember(task, made);
  return { link: made, url: made.url };
}

export const remember = (task: string, link: { id: string; url: string }) => localStorage.setItem(KEY(task), JSON.stringify({ id: link.id, url: link.url }));
