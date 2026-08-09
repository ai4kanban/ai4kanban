import type { ReactNode } from "react";

// The mat: a watercolour ground with a print mounted on it. Two sections on the
// landing page mount something this way — the four step shots in `Loop.tsx` and
// the memory tree in `Memory.tsx` — so the ground colour and the print's shadow
// are declared once here instead of twice.
//
// The mat itself is bare, and has to be: it is a picture, and an ink box around
// a watercolour is a frame around a picture. What holds it is its own bleed to
// the edge; what holds the print is the shadow it casts onto it.

// Backs the mat so a failed image load leaves a pale blue field rather than a
// bare hole. Keyed to the site's one azure, `--color-accent` #2f7ff5, lightened
// until text and a screenshot both sit on it comfortably.
const GROUND = "#d9e8fd";

// The print sits on the mat the way a print sits on a mount: a soft shadow, so
// it reads as laid on top rather than cut out of it. The shadow is the page's
// own ink at low alpha, and soft where every other shadow on the site is hard —
// a mounted print casts a real one. No edge line either: the shadow is what
// lifts it, and an outline on top of that reads as a frame in a frame.
export const printFrame =
  "overflow-hidden rounded-lg shadow-[0_6px_18px_-6px_rgba(25,28,34,0.45)]";

export function Mat({
  src,
  className = "",
  children,
}: {
  src: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-cover bg-center ${className}`}
      style={{ backgroundColor: GROUND, backgroundImage: `url(${src})` }}
    >
      {children}
    </div>
  );
}
