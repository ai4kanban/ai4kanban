/** Words more than one screen uses. A word only one screen says belongs in that
 *  screen's folder, however short it is. */
export type SharedCopy = {
  close: string;
  cancel: string;
  save: string;
  saving: string;
  delete: string;
  copy: string;
  copied: string;
  /** The dash a row shows where a field has no value. */
  none: string;
  /** The full stop that closes a sentence a button or a link ends. */
  stop: string;
  /** How far one channel has got with a topic (#411) — the board card's marks and the
   *  drafts block's strip both say these. The channel NAMES are product names and stay in
   *  the component. */
  channelStatus: {
    /** Chosen, and nothing written for it yet. */
    none: string;
    draft: string;
    ready: string;
    scheduled: string;
    published: string;
  };
  /** One channel and where it has got to, as a mark's tooltip: `X — draft`. */
  channelAt: (channel: string, status: string) => string;
};
