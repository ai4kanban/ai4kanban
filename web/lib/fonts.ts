import { Inter } from "next/font/google";

// The site's one downloaded face. `next/font` fetches Inter at build time and
// emits it into `_next/static/media`, so it ships from our own origin with no
// call out to Google — and it hands back a `size-adjust` fallback rule, so the
// swap from the system stack doesn't shift the layout.
//
// Latin only, on purpose: the zh and ja pages fall through to `--font-sans`'s
// system stack for their glyphs, and a CJK web font would be megabytes.
//
// Both root layouts put `inter.variable` on <html>; `--font-sans` in
// globals.css lists `var(--font-inter)` first and keeps the old system stack
// behind it as the fallback.
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
