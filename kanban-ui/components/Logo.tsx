import { cn } from "@/lib/utils";

// The product mark, in this app's palette.
//
// Same geometry as the marketing site's (`web/components/ui/Logo.tsx`): a
// square block carrying three board columns that share a top and step down as
// work leaves the board. What changes is the fill. The site fills it with its
// azure; here the accent is the ember, and a blue block would be the only blue
// in the app — so the mark reads as part of this board rather than as a sticker
// from the website.
//
// The fill is `nb-accent` and not the deep cut, because the mark shares a header
// with the Create-task button and that is the ember a filled block rests at
// here. The deep one is what a button turns on hover, and using it left two
// different reds a few hundred pixels apart. White on it is 4.03:1 — under the
// bar for text, over the 3:1 a shape needs, and these columns are a fifth of the
// block wide.
//
// It carries no frame and no shadow. A filled block on this board normally gets
// both — that is what an ember button is — but a button is 40px tall and this is
// 22px, where a 1.5px ink hairline is a seventh of the width on each side and
// turns the ember muddy instead of framing it. The fill is doing the work the
// outline would: ember on cream needs no help finding its edge.

const COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];

// One scale per use, the way the site's lockup is scaled (web/components/ui/
// Logo.tsx): the word is set so its cap-height reads level with the block's
// edges, and the corner radius steps with the block so a 32px mark isn't a 22px
// mark's radius blown up. What does NOT come across from the site is the frame,
// the shadow and the word's halo drop — the site's block carries a 2px outline
// and a hard shadow because everything on that page does, and here it doesn't:
// see the note above about a hairline turning a 22px ember block muddy. A word
// beside a flat block has to be flat too.
const SIZE = {
  sm: { block: "h-[18px] w-[18px] rounded-[5px]", gap: "gap-1.5", word: "text-[13.5px]" },
  md: { block: "h-[22px] w-[22px] rounded-[6px]", gap: "gap-2", word: "text-[17px]" },
  lg: { block: "h-[30px] w-[30px] rounded-[8px]", gap: "gap-2.5", word: "text-[23px]" },
} as const;

export type LogoSize = keyof typeof SIZE;

/** The square on its own — for the header, where the project name is already
 *  beside it, or anywhere the product is named by its surroundings. `className`
 *  overrides the size box, which is how /design shows the mark at four scales. */
export function LogoMark({ className = SIZE.md.block }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px] bg-nb-accent text-nb-paper",
        className,
      )}
    >
      <svg viewBox="0 0 60 60" fill="currentColor" aria-hidden="true" className="h-[62%] w-[62%]">
        {COLUMNS.map((c) => (
          <rect key={c.x} x={c.x} y={8} width={12} height={c.h} rx={3.5} />
        ))}
      </svg>
    </span>
  );
}

/** Mark plus name, on one line — for screens that carry no header to say which
 *  app this is (components/NoBoard.tsx). The word names no colour, so it takes
 *  the ink from whatever it is laid on. It is not copy: the brand reads
 *  AI4Kanban in every language, so it stays a literal here. */
export function Logo({ size = "md", className }: { size?: LogoSize; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", SIZE[size].gap, className)}>
      <LogoMark className={SIZE[size].block} />
      <span className={cn("font-[800] tracking-[-0.02em]", SIZE[size].word)}>AI4Kanban</span>
    </span>
  );
}
