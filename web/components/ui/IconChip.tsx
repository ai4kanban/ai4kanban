import type { IconType } from "react-icons";

// The square block an icon sits in. Repeating one of these is what makes a
// column of nodes read as a single drawing rather than a list that happens to
// have pictures.
//
// It is filled, always, and only in a color dark enough to carry a paper glyph:
// the deep blue for a mark that belongs to the product, the ink for a neutral
// one. A tinted block can't hold a glyph — `accent` is 3.84:1 against paper, so
// a blue glyph on a 10% blue wash is a shape you have to hunt for.
const TONE = {
  blue: "bg-accent-deep text-elev",
  ink: "bg-ink text-elev",
} as const;

// The small size is borderless so a row of four reads as one drawing; the large
// one keeps the ink frame, since at that size it is a block in its own right.
const SIZE = {
  sm: "h-8 w-8 [&>svg]:h-[1.05rem] [&>svg]:w-[1.05rem]",
  md: "h-10 w-10 border-2 border-border [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]",
} as const;

export function IconChip({
  icon: Icon,
  tone = "blue",
  size = "sm",
  className = "",
}: {
  icon: IconType;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  // For a caller that animates the block — `Iterate.tsx` lights each one as the
  // signal reaches it. The fill still comes from `tone`; this only adds to it.
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${TONE[tone]} ${SIZE[size]} ${className}`}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
