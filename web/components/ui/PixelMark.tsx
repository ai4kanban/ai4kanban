// A section's opening mark: a handful of cells in the site's own pixel.
//
// The pixel is already how the site draws texture — the band dissolves into it
// (`Band.tsx`), the mats are painted in it (`PixelWash.tsx`), the footer's
// wordmark is set in it. This is the same texture at a section head, for a
// section that carries no band and would otherwise open on bare type.
//
// It is decoration and it stays quiet: wash cells on white, and one ember so the
// mark belongs to the product rather than being grey confetti.

// `#` wash, `o` ember, `.` paper. A corner of a dissolve, not a picture: dense
// at the top-left, dust at the bottom-right.
const CELLS = ["##.#", "##o.", ".#..", "o..."].join("");

const FILL: Record<string, string> = { "#": "bg-code", o: "bg-accent" };

export function PixelMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-grid grid-cols-4 gap-[3px] ${className}`}>
      {[...CELLS].map((cell, i) => (
        <span key={i} className={`h-[9px] w-[9px] ${FILL[cell] ?? ""}`} />
      ))}
    </span>
  );
}
