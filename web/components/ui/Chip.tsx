import type { ReactNode } from "react";

// The small label pill, at the two fills the theme allows a small block to
// take. Each carries the outline it needs to be a shape and no more:
//
// - `neutral` — paper in an ink outline, for a plain aside.
//               Paper on paper is nothing without the line, so the line stays.
// - `solid`   — the deep ember with a paper label, for a token that belongs to
//               the product. Bare: a filled block is read by its fill, and
//               framing this one only makes a pill the same weight as the panel
//               around it.
//
// There is no tinted tone. The ember is either the full-strength fill or it
// isn't there: `bg-accent/10` is an ember diluted to a grey, which is neither
// the accent nor a neutral, and it reads as a chip that failed to load.
const TONE = {
  neutral: "border-2 border-border bg-elev text-ink",
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
      className={`inline-flex items-center rounded-full px-3 py-0.5 font-mono text-xs ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
