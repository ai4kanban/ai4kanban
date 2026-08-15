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
  "overflow-hidden rounded-xl shadow-[0_6px_18px_-6px_rgba(25,28,34,0.45)]";

// How the painting is laid on the mat.
//
// `cover` — the default, and right when the painting is roughly the mat's own
// shape: it is scaled until it fills and the overflow is cropped, so every inch
// of the mat is paint.
//
// `width` — for a painting composed edge to edge, where cropping it would throw
// away the composition: a 2.33 banner with a bloom in each top corner and
// nothing in the middle, where `cover` on a mat half that wide crops off exactly
// the two corners the painting is made of. This lays the full width across the
// top and lets its own paper carry the rest. It is the shape the hero's wash is
// still composed to, now that the wash is painted rather than downloaded.
type Fit = "cover" | "width";

// The hero's ground, as CSS: the same composition `PixelWash.tsx` paints — a
// wash off the top-right corner and one off the bottom-left, white between them
// — drawn with two radial gradients. This is not a placeholder in the
// loading-spinner sense; it is the mat's real ground. It ships inline in the
// static HTML, needs no network and no script, and is what stands if JS never
// runs. The canvas fades in over it and paints the same picture, moving.
//
// The white is the page's paper, `--color-elev`, named as the token rather than
// typed as a hex — but `PixelWash.tsx` has to hardcode its RGB to build a
// palette, so the two are coupled: change the token and change it there too, or
// the canvas fades in against a ground a shade off its own and the crossfade
// shows a seam.
//
// The radii are percentages of the mat's box where the canvas works in mat
// widths, so the two drift apart on a very tall mat. That is acceptable for the
// fraction of a second before the canvas lands — matching them exactly would
// mean expressing a height as a share of a width, which CSS gradients cannot do.
const BLOOMS = [
  "radial-gradient(40% 36% at 98% -4%, rgba(47,127,245,0.54), rgba(47,127,245,0) 72%)",
  "radial-gradient(42% 38% at 2% 104%, rgba(47,127,245,0.54), rgba(47,127,245,0) 72%)",
].join(",");

// Either a painting is laid on the mat (`src`) or one is painted onto it
// (`paint` — a layer this mounts behind the print). Never both: they are two
// ways to draw the same ground.
// The landing page's scroll reveal rides on the mat rather than on a wrapper
// around it: on that page the mat usually *is* the block that arrives, and a div
// whose only job is to hold two attributes is a layout box the grid then has to
// be told to ignore. `Reveal.tsx` owns what these mean.
type Reveal = {
  "data-reveal"?: boolean;
  "data-enter"?: boolean | "lift";
  "data-delay"?: "1" | "2" | "3";
};

type MatProps = Reveal & {
  className?: string;
  children: ReactNode;
} & (
    | { src: string; fit?: Fit; paint?: never }
    | { src?: never; fit?: never; paint: ReactNode }
  );

export function Mat({
  src,
  fit = "cover",
  className = "",
  paint,
  children,
  ...reveal
}: MatProps) {
  if (paint) {
    return (
      <div
        {...reveal}
        className={`relative overflow-hidden rounded-xl ${className}`}
        style={{
          backgroundColor: "var(--color-elev)",
          backgroundImage: BLOOMS,
        }}
      >
        {paint}
        {/* The print sits above the ground, and owns a stacking context of its
            own so the canvas can never draw over a screenshot. */}
        <div className="relative">{children}</div>
      </div>
    );
  }

  const wide = fit === "width";
  return (
    <div
      {...reveal}
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
