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

export function LogoMark({
  className = "h-[22px] w-[22px]",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[6px] bg-nb-accent text-nb-paper ${className}`}
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
