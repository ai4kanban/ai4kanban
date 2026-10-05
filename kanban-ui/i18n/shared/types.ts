/** Words more than one screen uses. A word only one screen says belongs in that
 *  screen's folder, however short it is. */
export type SharedCopy = {
  close: string;
  /** Opens a picture in the full-window preview. */
  viewLarger: string;
  cancel: string;
  save: string;
  saving: string;
  delete: string;
  copy: string;
  copied: string;
  /** A board picture's right-click menu (#1549). */
  copyImage: string;
  downloadImage: string;
  /** The dash a row shows where a field has no value. */
  none: string;
  /** The full stop that closes a sentence a button or a link ends. */
  stop: string;
  /** What the context ring says when you point at it (#675): how much of the model's window
   *  this conversation or run has filled, and how big the window is. Both numbers arrive
   *  already shortened — `100k`, `1M`. */
  contextWindow: (used: string, limit: string) => string;
  /** A card a discussion was written into (#1535), by where it stands now. */
  became: { open: string; done: string; dropped: string };
  /** A Pro workflow (#1038): its mark, and the one way to it for an account without Pro. */
  pro: {
    mark: string;
    upgrade: string;
    signIn: string;
    /** Why a Pro row cannot be picked. */
    locked: string;
  };
};
