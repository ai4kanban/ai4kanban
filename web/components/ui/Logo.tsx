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
// The name gets the block's other rule: it casts the same hard offset shadow
// every block on the site casts. That is what makes it a mark and not a label —
// the word is an object lying on the page at the same height as the square
// beside it, lit from the same corner, rather than type set next to a logo.
// It is still the system sans, because the site ships no display face and does
// not need one; the weight and the shadow do the work.
//
// Ink letters can't cast an ink shadow — you'd see one smear. So the drop is
// the ink copy one step down and right, with a paper halo held between it and
// the letters. The halo is not a second shadow, it is the gap: text shadows are
// drawn as whole strings stacked under the type, so a paper copy of the word
// laid over the ink one cuts a clean edge around every letter.
//
// It has to be a halo and not a single offset copy, because the shadow a letter
// has to be kept out of is mostly its *neighbour's* — which arrives from the
// left, where a down-right gap offers nothing. A one-sided gap holds up at 20px
// and falls apart at 36px, where the drop is wide enough to land square on the
// next letter's stem. The alternative is tracking the word apart until the
// drops stop colliding, and a wordmark set that loose is no longer a mark. The
// halo is what buys the tight setting.
//
// The halo is paper rather than the wash because the header band is paper, and
// a wash halo reads there as a grey line inside the letterform rather than as
// air. On the page's neutral it is a hairline of white, which is the same thing
// the panels do to the page anyway.
//
// It is not copy — the brand reads AI4Kanban in all five languages — so it
// stays here rather than in `i18n/`, like the footer's wordmark does.
const WORD = "font-black";

// The glyph, in its own 60×60 box, so the block can be any size and the columns
// keep their proportions. Shared top, descending lengths: three columns of a
// board, not three bars of a chart.
const COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];

// One scale per use: a tag, the header, a page byline, a hero or an OG image.
// The word is set at roughly seven tenths of the block at every step, which is
// where its cap-height reads level with the square's edges — set any smaller
// and the heavy word goes back to being a label the mark is carrying.
// The shadow steps with the block, and the word's drop steps with it — the two
// are one object and have to be lit the same. The drop stays well under the
// block's shadow at every step, because the block is one shape and the word is
// nine, and nine shapes each throwing the block's 4px would close up the page.
// By `xs` it is gone — from the square and from the word both, so the tag is
// flat all through. That size names the product beside a competitor's mark on
// the comparison pages, where the other marks run 16–24px and bring no shadow
// of their own; ours arriving with one would be the loudest thing in a row that
// is meant to read as a fair pair. It is one size at every one of those call
// sites rather than one per neighbour — our mark is the constant there.
const SIZE = {
  xs: {
    block: "h-5 w-5 rounded-md",
    gap: "gap-2",
    word: "text-sm tracking-tight",
  },
  sm: {
    block: "h-7 w-7 rounded-lg shadow-[2px_2px_0_0_var(--color-ink)]",
    gap: "gap-2.5",
    // `text-xl`'s line box is exactly the 28px block, so the header row is the
    // same height it was when the word was a step smaller.
    word: "text-xl tracking-tight",
    drop: {
      paper:
        "[text-shadow:1px_1px_0_var(--color-elev),-1px_1px_0_var(--color-elev),1px_-1px_0_var(--color-elev),-1px_-1px_0_var(--color-elev),2px_2px_0_var(--color-ink)]",
      ink: "[text-shadow:1px_1px_0_var(--color-ink),-1px_1px_0_var(--color-ink),1px_-1px_0_var(--color-ink),-1px_-1px_0_var(--color-ink),2px_2px_0_var(--color-accent)]",
    },
  },
  md: {
    block: "h-9 w-9 rounded-lg shadow-[3px_3px_0_0_var(--color-ink)]",
    gap: "gap-3",
    word: "text-2xl tracking-tight",
    drop: {
      paper:
        "[text-shadow:1px_1px_0_var(--color-elev),-1px_1px_0_var(--color-elev),1px_-1px_0_var(--color-elev),-1px_-1px_0_var(--color-elev),3px_3px_0_var(--color-ink)]",
      ink: "[text-shadow:1px_1px_0_var(--color-ink),-1px_1px_0_var(--color-ink),1px_-1px_0_var(--color-ink),-1px_-1px_0_var(--color-ink),3px_3px_0_var(--color-accent)]",
    },
  },
  lg: {
    block: "h-14 w-14 rounded-xl shadow-[4px_4px_0_0_var(--color-ink)]",
    gap: "gap-4",
    word: "text-4xl tracking-tight",
    drop: {
      paper:
        "[text-shadow:2px_2px_0_var(--color-elev),-2px_2px_0_var(--color-elev),2px_-2px_0_var(--color-elev),-2px_-2px_0_var(--color-elev),4px_4px_0_var(--color-ink)]",
      ink: "[text-shadow:2px_2px_0_var(--color-ink),-2px_2px_0_var(--color-ink),2px_-2px_0_var(--color-ink),-2px_-2px_0_var(--color-ink),4px_4px_0_var(--color-accent)]",
    },
  },
} as const;

type Size = keyof typeof SIZE;

// Which ground the lockup is laid on. The drop has to be inverted with it:
// against the page the gap is the wash and the shadow is the ink, and on the
// dark card that pair is the ground and the azure — the ink one would be
// invisible there, and the wash one would read as a second, brighter copy of
// the word rather than as its shadow. The letters themselves still name no
// colour on either ground; only their shadow does.
type Tone = "paper" | "ink";

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
  tone = "paper",
  className = "",
}: {
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  // `xs` is the flat one: no shadow under the square, so none under the word.
  const drop = size === "xs" ? "" : SIZE[size].drop[tone];

  return (
    // The word names no color: on the page it inherits the ink from `body`, and
    // in the dark footer it inherits the paper. The block always names its own,
    // because a mark is the same object on any ground.
    <span
      className={`inline-flex items-center ${SIZE[size].gap} ${className}`}
    >
      <LogoMark size={size} />
      <span className={`${WORD} ${SIZE[size].word} ${drop}`}>AI4Kanban</span>
    </span>
  );
}
