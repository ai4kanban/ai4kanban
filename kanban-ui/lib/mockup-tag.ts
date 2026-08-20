// The one tag a card body may carry (#239):
//
//   <Mockup src="mockups/239/a.tsx" label="A" />
//
// `src` starts at the board folder, so every one begins `mockups/<card id>/`. The board
// reads that file and draws the screen it holds where the tag sits.
//
// Client-safe on purpose: the remark plugin in Markdown.tsx runs in the browser, and the
// reader in lib/mockup.ts runs on the server. Both agree on the tag here.

/** A mockup as a card body points at it. */
export type MockupTag = {
  /** The path as written, from the board folder — `mockups/239/a.tsx`. */
  src: string;
  /** The name on the frame — `A`, `B`, `C`. Empty when the tag carries none. */
  label: string;
};

/** What the card page draws for one tag: the screen, or the note saying why not. */
export type MockupView =
  | {
      src: string;
      /** A whole HTML document, ready for the frame's iframe. */
      doc: string;
      /** The file's own text, for the switch to the code behind the picture. */
      code: string;
      error?: undefined;
    }
  // The note in a mockup's place. It still carries the file's text when there was a file
  // to read — a mockup that would not draw is one you want to read the code of.
  | { src: string; doc?: undefined; code?: string; error: string };

/** The mockups a page has already read, keyed by `src` exactly as the tag wrote it. */
export type MockupSet = Record<string, MockupView>;

// A self-closing tag with no `<` or `>` inside it. Sticky-free: callers build their own
// matcher with `mockupTags`, so no lastIndex is ever shared.
const TAG = /<Mockup\b([^<>]*?)\/>/g;
const ATTR = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'/g;

/** Every mockup tag in a run of raw HTML, in the order they appear. */
export function mockupTags(raw: string): MockupTag[] {
  const found: MockupTag[] = [];
  for (const match of raw.matchAll(TAG)) {
    const attrs: Record<string, string> = {};
    for (const a of match[1]!.matchAll(ATTR)) {
      attrs[(a[1] ?? a[3])!] = (a[2] ?? a[4])!;
    }
    if (attrs.src) found.push({ src: attrs.src, label: attrs.label ?? "" });
  }
  return found;
}

/** The tags in a block that holds nothing but tags — `null` when anything else is in
 *  there. A tag mixed into a line of prose is not one the board draws: the card writes
 *  each one on a line of its own, and a half-matched block is text, never a picture. */
export function mockupBlock(raw: string): MockupTag[] | null {
  const tags = mockupTags(raw);
  if (tags.length === 0) return null;
  return raw.replace(TAG, "").trim() === "" ? tags : null;
}

/** Every `src` a body points at, deduplicated — what the server reads before drawing. */
export function mockupSources(body: string): string[] {
  return [...new Set(mockupTags(body).map((t) => t.src))];
}
