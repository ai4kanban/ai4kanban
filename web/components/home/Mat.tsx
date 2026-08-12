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

// The `fit="width"` ground. Where `cover` crops the painting so no ground shows
// at all, this one lays the whole painting across the mat and leaves the rest of
// the height to the fill — so the fill has to be the painting's own paper, or
// there is a seam across the mat where one stops and the other starts. Sampled
// off the bottom edge of `bg-hero-v1.webp`, which is uniform there.
const PAPER = "#fbf9f7";

// The print sits on the mat the way a print sits on a mount: a soft shadow, so
// it reads as laid on top rather than cut out of it. The shadow is the page's
// own ink at low alpha, and soft where every other shadow on the site is hard —
// a mounted print casts a real one. No edge line either: the shadow is what
// lifts it, and an outline on top of that reads as a frame in a frame.
export const printFrame =
  "overflow-hidden rounded-lg shadow-[0_6px_18px_-6px_rgba(25,28,34,0.45)]";

// How the painting is laid on the mat.
//
// `cover` — the default, and right when the painting is roughly the mat's own
// shape: it is scaled until it fills and the overflow is cropped, so every inch
// of the mat is paint.
//
// `width` — for a painting composed edge to edge, where cropping it would throw
// away the composition. `bg-hero-v1.webp` is the one: a 2.33 banner with a bloom
// in each top corner and nothing in the middle, and `cover` on a mat half that
// wide crops off exactly the two corners the painting is made of. This lays the
// full width across the top and lets its own paper carry the rest.
type Fit = "cover" | "width";

export function Mat({
  src,
  fit = "cover",
  className = "",
  children,
}: {
  src: string;
  fit?: Fit;
  className?: string;
  children: ReactNode;
}) {
  const wide = fit === "width";
  return (
    <div
      className={`overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: wide ? PAPER : GROUND,
        backgroundImage: `url(${src})`,
        backgroundSize: wide ? "100% auto" : "cover",
        backgroundPosition: wide ? "top center" : "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </div>
  );
}
