import type { ReactNode } from "react";
import { Wash } from "./Wash";
import { washGround, type WashName } from "./washes";

// A watercolour ground with a print mounted on it — how every picture on the
// landing page is mounted. The ground ships as a CSS gradient; the canvas fades
// in over it and paints the same picture in pixels.
//
// The paper the wash is painted on is `band`, not white: the prints are white,
// and on a white page a white mat has neither an outer edge nor anything for
// the print to sit against. It is the site's other use of the warm tone.
//
// No border on either the mat or the print: an ink box around a watercolour
// reads as a frame. The print's soft shadow is what lifts it, where every other
// shadow on the site is hard.
export const printFrame =
  "overflow-hidden rounded-xl shadow-[0_6px_18px_-6px_rgba(36,35,31,0.45)]";

// The scroll reveal rides on the mat rather than a wrapper around it — the mat
// usually *is* the block that arrives. `Reveal.tsx` owns what these mean.
type Reveal = {
  "data-reveal"?: boolean;
  "data-enter"?: boolean | "lift";
  "data-delay"?: "1" | "2" | "3";
};

type MatProps = Reveal & {
  wash: WashName;
  /** The hero's, and only the hero's — see `PixelWash.tsx`. */
  animated?: boolean;
  className?: string;
  children: ReactNode;
};

export function Mat({
  wash,
  animated,
  className = "",
  children,
  ...reveal
}: MatProps) {
  return (
    <div
      {...reveal}
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: "var(--color-band)",
        backgroundImage: washGround(wash),
      }}
    >
      <Wash name={wash} animated={animated} />
      {/* Its own stacking context, so the canvas can never draw over a print.
          `w-full` is a no-op under a block mat and is what lets a print fill a
          mat that centres its content with flex. */}
      <div className="relative w-full">{children}</div>
    </div>
  );
}
