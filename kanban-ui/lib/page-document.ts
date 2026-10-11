// A `.tsx` or `.html` asset's document (#1626, #1628): inline scripts run, nothing else loads. The iframe
// that shows it is `sandbox="allow-scripts"`, so the page has an opaque origin of its own.
export const PAGE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; " +
  "media-src data:; font-src data:; worker-src 'none'; base-uri 'none'; form-action 'none'";

// The doctype and any comments before it run nothing, and moving the policy above them would
// drop the page into quirks mode.
const PROLOGUE = /^﻿?\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\b[^>]*>)?/i;

/** `head` goes in front of everything the author wrote, so no earlier tag escapes the policy. */
export function pageDocument(html: string, head: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`;
  if (!/<!doctype\b|<html[\s>]|<head[\s>]/i.test(html)) return `<!doctype html><html><head>${meta}${head}</head><body>${html}</body></html>`;
  const at = PROLOGUE.exec(html)![0].length;
  return html.slice(0, at) + meta + head + html.slice(at);
}

// Sideways is the one direction a mockup never scrolls. `contain` keeps a wheel over a card's
// mockup from scrolling the card; the mockup's own page leaves it off so its panel scrolls.
export function frameHead(contain: boolean): string {
  return `<meta charset="utf-8"><style>html{overflow-x:hidden${contain ? ";overscroll-behavior:contain" : ""}}</style>`;
}

/** A `.tsx` mockup's rendered markup; an inline `<script>` in it runs like an `.html` page's. */
export function componentDocument(css: string, markup: string, contain: boolean): string {
  return pageDocument(`<!doctype html><html><head><style>${css}</style></head><body>${markup}</body></html>`, frameHead(contain));
}
