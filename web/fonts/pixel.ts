import localFont from "next/font/local";

// Silkscreen (SIL Open Font License) — the pixel face used for the big wordmark
// in the Chinese footer, and nothing else. It is self-hosted rather than pulled
// from `next/font/google` so a build never needs to reach fonts.googleapis.com.
export const pixel = localFont({
  src: [
    { path: "./silkscreen-400.woff2", weight: "400", style: "normal" },
    { path: "./silkscreen-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});
