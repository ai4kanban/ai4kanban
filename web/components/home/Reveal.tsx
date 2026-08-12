"use client";

import { useEffect } from "react";

// The landing page's scroll motion — the one place on the site where something
// moves that isn't a diagram making an argument (design.md §2).
//
// It is one rule stated twice, because the page has two kinds of block:
//
// - **`data-enter`** — the hero, which is already on screen before anything can
//   observe it. It runs a keyframe on load, so it paints and moves with the
//   first frame instead of waiting for hydration.
// - **`data-reveal`** — everything below the fold. It rests hidden and is
//   released when the block scrolls into view, by the one observer below.
//
// Both read `--rv` for their delay, so `data-delay` staggers either of them, and
// both travel the same distance over the same period on the same curve: a block
// arriving from below the fold and a block arriving on load are the same
// gesture, and giving each its own timing would make the page look like two
// pages spliced together.
//
// The curve is a hard-out ease — most of the distance is covered in the first
// third and the block settles into place. A symmetric ease reads as a slide;
// this reads as something coming to rest, which is the only reason to move a
// paragraph at all.
const DIST = "1.25rem";
const DUR = "0.72s";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Three steps of stagger and no more. The delay is what makes a group read as
// one thing arriving rather than four things arriving; past ~0.3s the last item
// is no longer part of the same arrival, it is a second event.
const STEP = 0.085;

// The hero's deck moves without fading, and that is not a style choice: the
// screenshot deck is the page's LCP element, and an element held at `opacity: 0`
// is not painted as far as the browser's measurement is concerned. A block that
// rises into place is reported the moment it is drawn; a block that fades in
// pushes the page's largest paint out by the whole animation. Everything else in
// the hero is type, and type is not the LCP.
const MOTION = `
@keyframes rv-rise {
  from { opacity: 0; translate: 0 ${DIST} }
  to { opacity: 1; translate: none }
}
@keyframes rv-lift {
  from { translate: 0 ${DIST} }
  to { translate: none }
}
@media (prefers-reduced-motion: no-preference) {
  [data-enter] { animation: rv-rise ${DUR} ${EASE} var(--rv, 0s) both }
  [data-enter="lift"] { animation-name: rv-lift }

  [data-reveal] {
    opacity: 0;
    translate: 0 ${DIST};
    transition:
      opacity ${DUR} ${EASE} var(--rv, 0s),
      translate ${DUR} ${EASE} var(--rv, 0s);
  }
  [data-reveal][data-shown] { opacity: 1; translate: none }

  [data-delay="1"] { --rv: ${STEP}s }
  [data-delay="2"] { --rv: ${STEP * 2}s }
  [data-delay="3"] { --rv: ${STEP * 3}s }
}
`;

// With JS off the observer never runs, so the resting style would be the final
// state a reader is left in. The keyframed half needs no such line — a CSS
// animation runs either way.
const NO_JS = `<style>[data-reveal]{opacity:1;translate:none}</style>`;

// Released when the block's top edge is a tenth of the way into the viewport,
// so a section starts moving as you arrive at it rather than the instant its
// first pixel clears the fold.
const MARGIN = "0px 0px -10% 0px";

export function Reveal() {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const show = (el: HTMLElement) => el.setAttribute("data-shown", "");

    // Anything without the observer gets the page, just not the motion.
    if (!("IntersectionObserver" in window)) {
      blocks.forEach(show);
      return;
    }

    // One observer for the page rather than one per block, and each block is
    // dropped the moment it lands: this is a reveal, not a state that tracks
    // the scroll position, so a block that has arrived has nothing left to say.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: MARGIN },
    );
    blocks.forEach((block) => io.observe(block));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <style>{MOTION}</style>
      <noscript dangerouslySetInnerHTML={{ __html: NO_JS }} />
    </>
  );
}
