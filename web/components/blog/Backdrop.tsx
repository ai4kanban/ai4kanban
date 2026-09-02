import { CDN } from "@/lib/site";

// The artwork behind a page's opening: a pixel landscape under the headline and
// the site header, washed out so both read as ink on paper.
//
// It fills its parent, so the parent is what decides where the plate stops —
// give it to a full-bleed block that ends where the opening ends, and the
// artwork never reaches the body. `-top-24` is the one measurement it makes:
// the opening starts under the site header row, and the plate has to run up
// behind it. Overshooting is free — nothing scrolls above the document's top.
export function Backdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10 overflow-hidden"
    >
      {/* The subject is the mountain on the right; the left of the plate is
          empty sky, which is where the headline goes. `85%` holds that side in
          frame at any crop, so a phone gets the mountain rather than the blank
          half. The vertical anchor is the foot, which drops the empty sky off
          the top: the mountain lives in the picture's lower half, and anchoring
          the other way lands it in the plate's lower half, where the wash is
          heaviest and it barely reads. */}
      <img
        src={`${CDN}/blog-backdrop-v1.webp`}
        alt=""
        className="h-full w-full object-cover object-[85%_100%]"
      />
      {/* The wash. Illustration never carries readable content on pigment
          (design.md), and this plate has a headline, a byline and the whole
          header on it — so paper covers most of it, and nearly all of it by the
          bottom edge, where the opening hands over to the body. */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/55 via-bg/78 via-50% to-bg" />
    </div>
  );
}
