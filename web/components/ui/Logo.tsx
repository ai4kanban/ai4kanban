// The product logo: the square block, then the name, on one line.
//
// The block is nothing new — it is the site's own vocabulary at mark size. The
// same deep blue fill that every icon block takes, the same 2px ink outline
// every block on the site carries, the same hard ink shadow every card casts.
// That is the point: the logo is the page's rule stated once, not a separate
// piece of art the rest of the site has to live next to.
//
// The glyph is a board reduced to three columns that step down left to right —
// the backlog draining as work leaves the board. It is paper white, because a
// filled blue block carries a paper glyph or it carries nothing; there is no
// tint of the azure that can hold a shape.
//
// The name is set in the system sans. The pixel face is subset to the six
// letters of the footer wordmark and draws that and nothing else. It is not
// copy either — the brand reads AI4Kanban in all five languages — so it stays
// here rather than in `i18n/`, like the footer's wordmark does.

// The glyph, in its own 60×60 box, so the block can be any size and the columns
// keep their proportions. Shared top, descending lengths: three columns of a
// board, not three bars of a chart.
const COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];

// One scale per use: a tag, the header, a page byline, a hero or an OG image.
// The shadow steps with the block — at 28px a 4px shadow is a second block, and
// by `xs` it is gone. That size names the product beside a competitor's mark on
// the comparison pages, where the other marks run 16–24px and bring no shadow
// of their own; ours arriving with one would be the loudest thing in a row that
// is meant to read as a fair pair. It is one size at every one of those call
// sites rather than one per neighbour — our mark is the constant there.
const SIZE = {
  xs: {
    block: "h-5 w-5 rounded-md",
    gap: "gap-2",
    word: "text-sm",
  },
  sm: {
    block: "h-7 w-7 rounded-lg shadow-[2px_2px_0_0_var(--color-ink)]",
    gap: "gap-2.5",
    word: "text-lg",
  },
  md: {
    block: "h-9 w-9 rounded-lg shadow-[3px_3px_0_0_var(--color-ink)]",
    gap: "gap-3",
    word: "text-2xl",
  },
  lg: {
    block: "h-14 w-14 rounded-xl shadow-[4px_4px_0_0_var(--color-ink)]",
    gap: "gap-4",
    word: "text-4xl",
  },
} as const;

type Size = keyof typeof SIZE;

// The square on its own — for a favicon, an avatar, or anywhere the name is
// already on screen next to it.
export function LogoMark({ size = "md" }: { size?: Size }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border-2 border-border bg-accent-deep text-elev ${SIZE[size].block}`}
    >
      <svg
        viewBox="0 0 60 60"
        fill="currentColor"
        aria-hidden="true"
        className="h-[62%] w-[62%]"
      >
        {COLUMNS.map((c) => (
          <rect key={c.x} x={c.x} y={8} width={12} height={c.h} rx={3.5} />
        ))}
      </svg>
    </span>
  );
}

export function Logo({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    // The word names no color: on the page it inherits the ink from `body`, and
    // in the dark footer it inherits the paper. The block always names its own,
    // because a mark is the same object on any ground.
    <span
      className={`inline-flex items-center ${SIZE[size].gap} ${className}`}
    >
      <LogoMark size={size} />
      <span className={`font-bold tracking-tight ${SIZE[size].word}`}>
        AI4Kanban
      </span>
    </span>
  );
}
