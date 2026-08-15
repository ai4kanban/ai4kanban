"use client";

import { useEffect } from "react";

// The landing page's scroll motion (design.md §2) — one gesture, two triggers:
//
// - **`data-enter`** — the hero, on screen before anything can observe it. A
//   keyframe on load, so it moves with the first frame, not with hydration.
// - **`data-reveal`** — below the fold. Rests hidden, released by the observer.
//
// Same distance, period and curve for both, and both read `--rv` for their
// delay. The curve is a hard-out ease: a symmetric one reads as a slide, this
// reads as something coming to rest.
const DIST = "1.25rem";
const DUR = "0.72s";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Three steps of stagger and no more — past ~0.3s the last item is a second
// event rather than part of the same arrival.
const STEP = 0.085;

// `rv-lift` is the no-fade variant, for the hero's deck: it's the LCP element,
// and an element held at `opacity: 0` isn't painted as far as the browser's
// measurement is concerned, so fading it in delays the largest paint by the
// whole animation.
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

// With JS off the observer never runs, so the resting style is where a reader
// is left. The keyframed half needs no such line.
const NO_JS = `<style>[data-reveal]{opacity:1;translate:none}</style>`;

// A tenth of the way into the viewport, so a section starts moving as you
// arrive at it rather than as its first pixel clears the fold.
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

    // One observer for the page, and each block is dropped once it lands — a
    // reveal, not a state that tracks scroll position.
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
