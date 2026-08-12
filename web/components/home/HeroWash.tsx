"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// How the painted wash is kept off the critical path.
//
// The hero is the first thing rendered and the screenshot deck in it is the
// page's LCP element, so the mat's ground has exactly one job at load: be
// there, in the HTML, costing nothing. `Mat.tsx` does that with a CSS gradient —
// it ships as an inline style in the static export, paints with the first frame,
// and is what a reader with no JS keeps.
//
// Everything that draws is behind two gates on top of that:
//
// - **`ssr: false`** — the canvas is its own chunk, absent from the server HTML
//   and from the entry bundle. Nothing a crawler parses mentions it.
// - **idle** — the chunk isn't even requested until the browser says it has
//   nothing better to do. A canvas fighting the hero screenshot for bandwidth
//   would push out the LCP the section is built around, which is the whole
//   reason the old build used one flat `.webp` and not something clever.
//
// The canvas is `absolute inset-0`, so it enters and leaves without reserving,
// releasing, or shifting a single pixel of layout: CLS is structurally zero
// rather than measured-and-hoped-for.
const PixelWash = dynamic(() => import("./PixelWash"), { ssr: false });

export function HeroWash() {
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    // `requestIdleCallback` where it exists; a timeout everywhere else (Safari
    // is the everywhere else). The deadline on the idle call is the same idea
    // as the timeout — on a busy page, paint it soon rather than never.
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(() => setAwake(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setAwake(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  return awake ? <PixelWash /> : null;
}
