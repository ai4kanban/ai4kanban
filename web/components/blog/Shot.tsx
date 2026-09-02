import { Figure } from "./figures/kit";
import { printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";

// A capture of the real app, mounted the way `SelfBoardProgress` mounts one and
// the landing page mounts every screenshot: a print on a watercolour mat, no
// frame of its own, nothing drawn on top of the capture.
//
// The rest of `figures/` is drawings, and that is still the rule — a claim about
// how something works is drawn to the site's grammar. This is the exception the
// rule already has: when the claim is *the product does this*, the honest
// picture is the product, and a drawing of it would be a smaller, prettier lie.
//
// Unlike a figure, this takes props, so it is not in the closed set every post
// can write. A page passes it through `BlogMdx`'s `extra`.
//
// `/shots/` is served from the site's own `public/`. Screenshots elsewhere on
// the site come off the CDN; these are small enough (~50-110 kB webp) that a
// second origin buys nothing, and keeping them in the repo means the page and
// its pictures are re-shot and reviewed together.

export function Shot({
  src,
  alt,
  caption,
  wash = "peachEmber",
}: {
  /** File name under `public/shots/`, without the extension. */
  src: string;
  alt: string;
  caption: string;
  wash?: WashName;
}) {
  return (
    <Figure single wash={wash} caption={caption}>
      <div className={`${printFrame} bg-elev`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/shots/${src}.webp`}
          alt={alt}
          className="block w-full"
          loading="lazy"
        />
      </div>
    </Figure>
  );
}
