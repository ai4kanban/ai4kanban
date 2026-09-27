// English copy for the words more than one screen uses — the source of truth a
// second language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const en: SharedCopy = {
  close: "Close",
  viewLarger: "View larger",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  delete: "Delete",
  copy: "Copy",
  copied: "Copied",
  none: "—",
  stop: ".",
  contextWindow: (used, limit) => `Context window ${used}/${limit}`,
  pro: { mark: "Pro", upgrade: "Upgrade to Pro", signIn: "Sign in to use Pro", locked: "A Pro workflow. Upgrade to use it." },
};

export default en;
