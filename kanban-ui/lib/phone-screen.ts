// A phone mockup as an iPhone 16 (iOS 26) shows a web page (#1215): the screen is the whole
// 393×852, the frame overlays the status bar and home indicator, and the page gets the
// device's safe-area insets.

/** iPhone 16 safe-area insets, in CSS px. */
export const SAFE_AREA = { top: 59, bottom: 34, left: 0, right: 0 } as const;

const ENV = /env\(\s*safe-area-inset-(top|bottom|left|right)\b/gi;

/** Every `env(safe-area-inset-*)` — fallback and nested parentheses included — as its value. */
export function fillSafeArea(doc: string): string {
  let out = "";
  let from = 0;
  for (const m of doc.matchAll(ENV)) {
    if (m.index < from) continue;
    let depth = 1;
    let end = m.index + m[0].length;
    while (end < doc.length && depth > 0) {
      if (doc[end] === "(") depth++;
      else if (doc[end] === ")") depth--;
      end++;
    }
    out += doc.slice(from, m.index) + `${SAFE_AREA[m[1]!.toLowerCase() as keyof typeof SAFE_AREA]}px`;
    from = end;
  }
  return out + doc.slice(from);
}

const COVER = /env\(\s*safe-area-inset-|viewport-fit\s*=\s*cover/i;
const META = /<meta\b[^>]*>/gi;

/** Hides everything but the page's own background, for the safe areas of a page laid out
 *  inside them. */
const BACKDROP = "<style>body *,body::before,body::after{visibility:hidden!important}</style>";

export type PhoneScreen = {
  /** The page, safe-area values filled in. */
  doc: string;
  /** Laid out from the top of the screen (`viewport-fit=cover` or a `black-translucent` status
   *  bar), not inside the safe areas. */
  cover: boolean;
  /** The page's background alone, filling the safe areas when not `cover`. */
  backdrop: string | null;
  /** `black-translucent` status bar: white text, icons and home indicator. */
  light: boolean;
};

export function phoneScreen(raw: string): PhoneScreen {
  const light = [...raw.matchAll(META)].some(
    ([tag]) =>
      /\bname\s*=\s*["']?apple-mobile-web-app-status-bar-style\b/i.test(tag) &&
      /\bcontent\s*=\s*["']?black-translucent\b/i.test(tag),
  );
  const cover = light || COVER.test(raw);
  const doc = fillSafeArea(raw);
  // Last in the document, so it outranks the page's own rules.
  return { doc, cover, backdrop: cover ? null : doc + BACKDROP, light };
}
