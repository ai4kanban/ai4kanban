import type { ReactNode } from "react";

// The small label pill: an ink hairline around a filled body, at the two fills
// the theme allows a small block to take.
//
// - `neutral` — paper in an ink outline, for a plain aside (the install notes).
// - `solid`   — the deep blue with a paper label, for a token that belongs to
//               the product (the `Markdown` mark in the iteration diagram).
//
// There is no tinted tone. A blue is either the full-strength fill or it isn't
// there: `bg-accent/10` is a blue diluted until it is a grey, which is neither
// the accent nor a neutral, and it reads as a chip that failed to load.
const TONE = {
  neutral: "bg-elev text-ink",
  solid: "bg-accent-deep text-elev",
} as const;

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-border px-3 py-0.5 font-mono text-xs ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
