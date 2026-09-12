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
  /** The scope just moved and brought cards in (#451): one line above the rows it filled,
   *  saying why none of them raised anything. `scope` is a release, or `everyRelease`. */
  filled: (scope: string, cards: number) => string;
  everyRelease: string;
  /** The two tabs beside the title (#613): what still wants a person, and what landed. */
  tabs: { todo: string; landed: string };
  /** Read out loud on the landed tab while it holds something new — the dot alone. */
  tabNew: string;
  /** The unread count over the list, and the one click that empties it. */
  newCount: (unread: number) => string;
  markAllRead: string;
  /** How long ago a row changed — what says the list is newest first. */
  justNow: string;
  minutesAgo: (m: number) => string;
  hoursAgo: (h: number) => string;
  daysAgo: (d: number) => string;
  /** Still asking the board where the account stands. */
  checking: string;
  /** The rail's ends: a mark, what would fill it, and where to go. */
  unavailable: string;
  signedOut: { title: string; body: string; hint: string };
  noRelease: { title: string; body: string };
  empty: { title: string; body: string };
  /** Nothing has landed yet — the other tab's end. */
  emptyLanded: { title: string; body: string };
  /** Cloud answered with less than the whole truth. */
  unreachable: (why: string) => string;
  unsent: (changes: number) => string;
  /** The watched release closed, and what to watch instead. */
  closed: { title: string; body: string; all: string; failed: string };
};
