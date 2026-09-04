// English copy for the words more than one screen uses — the source of truth a
// second language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const en: SharedCopy = {
  close: "Close",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  delete: "Delete",
  copy: "Copy",
  copied: "Copied",
  none: "—",
  stop: ".",
  channelStatus: {
    none: "nothing written",
    draft: "draft",
    ready: "ready",
    scheduled: "scheduled",
    published: "published",
  },
  channelAt: (channel, status) => `${channel} — ${status}`,
};

export default en;
