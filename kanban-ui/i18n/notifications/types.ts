/** The bell in the top row and the rail it opens (#319). The rows themselves are
 *  words `akb` built and are never translated — this is the chrome around them. */
export type NotificationsCopy = {
  /** The bell, in its two states. Only read out loud. */
  bell: string;
  bellUnread: (unread: number) => string;
  title: string;
  close: string;
  /** The machine's silencing switch, said where its effect is felt. */
  silenced: string;
  silencedTip: string;
  /** The unread count over the list. */
  newCount: (unread: number) => string;
  sortOrder: string;
  /** The rail's ends: a mark, what would fill it, and where to go. */
  unavailable: string;
  signedOut: { title: string; body: string; hint: string };
  noRelease: { title: string; body: string };
  empty: { title: string; body: string };
  /** Cloud answered with less than the whole truth. */
  unreachable: (why: string) => string;
  unsent: (changes: number) => string;
  /** A row whose board has left this machine. */
  boardGone: (board: string) => string;
  /** The watched release closed, and what to watch instead. */
  closed: { title: string; body: string; all: string; failed: string };
};
