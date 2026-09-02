import { Figure } from "./figures/kit";
import { printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import { CDN } from "@/lib/site";

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
// Captures live in the CDN's `shots/` prefix, so a Pages deploy never carries
// them (lib/site.ts) and a clean checkout can still build — the local
// `screenshots/` directory is not in git. The key is the versioned file name:
// replacing a capture means uploading `-v2` and changing the caller, never
// overwriting.

export function Shot({
  src,
  alt,
  caption,
  wash = "peachEmber",
}: {
  /** Versioned screenshot key, served as `<CDN>/shots/<key>.webp`. */
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
          src={`${CDN}/shots/${src}.webp`}
          alt={alt}
          className="block w-full"
          loading="lazy"
        />
      </div>
    </Figure>
  );
}
