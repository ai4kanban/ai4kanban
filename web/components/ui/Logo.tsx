// The product logo: the square block, then the name, on one line.
//
// The block takes the bright ember, not `accent-deep` — the one filled block on
// the site that does, matching the board's mark (kanban-ui/components/Logo.tsx).
// White on `#dd4f1e` is 4.03:1: enough for a shape, not for a label, which is
// why ember blocks elsewhere still take the deep cut. Its shadow is doubled,
// deep ember one step out and ink two, and only here — a page of
// double-shadowed blocks would be a page of stickers.
//
// The word is not copy (the brand reads AI4Kanban in all five languages), so it
// stays here rather than in `i18n/`.
const WORD = "font-black";

// The glyph, in its own 60×60 box so the columns keep their proportions at any
// block size. Shared top, descending lengths: three columns of a board draining
// left to right, not three bars of a chart.
const COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];

// One scale per use: a tag, the header, a page byline, a hero or an OG image.
// The word runs about seven tenths of the block at every step, where its
// cap-height reads level with the square's edges.
//
// At `md` and `lg` the word's drop takes the block's first offset only: an ink
// copy down-right, with a paper halo all round the letters so a neighbour's
// shadow can't touch them.
//
// `xs` is flat, square and word both: it names the product beside competitors'
// marks on the comparison pages. `sm`, the header's, keeps the square's shadow
// but not the word's — at that size the drop read as a double image.
const SIZE = {
  xs: {
    block: "h-5 w-5 rounded-md",
    gap: "gap-2",
    word: "text-sm tracking-tight",
  },
  sm: {
    block:
      "h-7 w-7 rounded-lg shadow-[2px_2px_0_0_var(--color-accent-deep),4px_4px_0_0_var(--color-ink)]",
    gap: "gap-2.5",
    // `text-xl`'s line box is exactly the 28px block, so the header row keeps
    // its height.
    word: "text-xl tracking-tight",
  },
  md: {
    block:
      "h-9 w-9 rounded-lg shadow-[3px_3px_0_0_var(--color-accent-deep),6px_6px_0_0_var(--color-ink)]",
    gap: "gap-3",
    word: "text-2xl tracking-tight",
    drop: {
      paper:
        "[text-shadow:1px_1px_0_var(--color-elev),-1px_1px_0_var(--color-elev),1px_-1px_0_var(--color-elev),-1px_-1px_0_var(--color-elev),3px_3px_0_var(--color-ink)]",
      ink: "[text-shadow:1px_1px_0_var(--color-ink),-1px_1px_0_var(--color-ink),1px_-1px_0_var(--color-ink),-1px_-1px_0_var(--color-ink),3px_3px_0_var(--color-accent-deep)]",
    },
  },
  lg: {
    block:
      "h-14 w-14 rounded-xl shadow-[4px_4px_0_0_var(--color-accent-deep),8px_8px_0_0_var(--color-ink)]",
    gap: "gap-4",
    word: "text-4xl tracking-tight",
    drop: {
      paper:
        "[text-shadow:2px_2px_0_var(--color-elev),-2px_2px_0_var(--color-elev),2px_-2px_0_var(--color-elev),-2px_-2px_0_var(--color-elev),4px_4px_0_var(--color-ink)]",
      ink: "[text-shadow:2px_2px_0_var(--color-ink),-2px_2px_0_var(--color-ink),2px_-2px_0_var(--color-ink),-2px_-2px_0_var(--color-ink),4px_4px_0_var(--color-accent-deep)]",
    },
  },
} as const;

type Size = keyof typeof SIZE;

// Which ground the lockup is laid on; the drop inverts with it — halo and
// shadow are paper/ink on the page, ground/ember on a dark card. Only the
// shadow names a colour, never the letters.
type Tone = "paper" | "ink";

// The square on its own — favicon, avatar, or anywhere the name is already on
// screen next to it.
export function LogoMark({ size = "md" }: { size?: Size }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border-2 border-border bg-accent text-elev ${SIZE[size].block}`}
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
  tone = "paper",
  className = "",
}: {
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  const s = SIZE[size];
  const drop = "drop" in s ? s.drop[tone] : "";

  return (
    // The word inherits its colour (ink on the page, paper in the dark footer);
    // the block always names its own.
    <span
      className={`inline-flex items-center ${s.gap} ${className}`}
    >
      <LogoMark size={size} />
      <span className={`${WORD} ${s.word} ${drop}`}>AI4Kanban</span>
    </span>
  );
}
