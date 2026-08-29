// English copy for the notification bell and its rail — the source of truth a
// second language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { NotificationsCopy } from "./types";

const en: NotificationsCopy = {
  bell: "Notifications",
  bellUnread: (unread) => `Notifications — ${unread} unread`,
  title: "Notifications",
  close: "Close notifications",
  silenced: "silenced",
  silencedTip: "System notifications are silenced for every board on this machine.",
  newCount: (unread) => `${unread} new`,
  sortOrder: "Newest change first",
  unavailable: "Notifications aren’t available here",
  signedOut: {
    title: "Not signed in to Cloud",
    body: "Sign in and this board's cards start filling the bell. Nothing leaves this machine until you do.",
    hint: "Configuration → Notifications",
  },
  noRelease: {
    title: "No open release",
    body: "The bell watches one open release. Start one from the version picker in the header.",
  },
  empty: {
    title: "Nothing waiting",
    body: "Cards that need you appear here, and stay 30 days after they finish.",
  },
  unreachable: (why) => `Cloud could not be reached: ${why}. These are the rows we last knew about.`,
  unsent: (changes) =>
    changes === 1
      ? "Cloud is out of step: 1 change never reached it. This board is the one that is right."
      : `Cloud is out of step: ${changes} changes never reached it. This board is the one that is right.`,
  boardGone: (board) => `${board} is no longer on this machine.`,
  closed: {
    title: "The release you were watching closed.",
    body: "Nothing new fills the bell until you pick what to watch.",
    all: "All releases",
    failed: "that release could not be watched",
  },
};

export default en;
