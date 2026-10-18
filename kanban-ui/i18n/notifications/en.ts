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
  filled: (cards) =>
    cards === 1 ? "1 card was already waiting for you" : `${cards} cards were already waiting for you`,
  tabs: { todo: "To do", landed: "Landed" },
  tabNew: "something new",
  status: {
    question: "Question waiting",
    readyForReview: "Ready for review",
    accepted: "Starting",
    waitingForServer: "Waiting for a machine",
    running: "Working on it",
    completed: "Landed",
    failed: "Did not land",
    cancelled: "Stopped",
    interrupted: "Interrupted",
    stale: "No longer waiting",
  },
  newCount: (unread) => `${unread} new`,
  markAllRead: "Mark all read",
  justNow: "just now",
  minutesAgo: (m) => `${m}m ago`,
  hoursAgo: (h) => `${h}h ago`,
  daysAgo: (d) => `${d}d ago`,
  runStopped: "Run didn't finish",
  runStoppedBody: "The run on this card didn't finish. Open it to see what happened.",
  loadMore: "Load more",
  loadingMore: "Loading…",
  loadFailed: "Couldn't load more",
  retry: "Retry",
  end: "No more notifications",
  checking: "Checking…",
  unavailable: "Notifications aren’t available here",
  off: {
    title: "Notifications are off",
    body: "Turn them on in Configuration → Notifications.",
  },
  empty: {
    title: "Nothing waiting",
    body: "Cards that need you appear here — one to review, one asking a question, one that did not land.",
  },
  emptyLanded: {
    title: "Nothing landed yet",
    body: "Deliveries that landed appear here, and stay 30 days.",
  },
  unreachable: (why) => `Cloud could not be reached: ${why}. These are the rows we last knew about.`,
  unsent: (changes) =>
    changes === 1
      ? "Cloud is out of step: 1 change never reached it. This board is the one that is right."
      : `Cloud is out of step: ${changes} changes never reached it. This board is the one that is right.`,
};

export default en;
