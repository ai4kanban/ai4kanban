"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { WashName } from "./washes";

// Two gates keep the canvas off the critical path, where the hero screenshot is
// the LCP element: `ssr: false` puts it in its own chunk (shared by all five
// mats, absent from the server HTML), and idle holds the request until the
// browser has nothing better to do. The CSS ground in `washes.ts` is what
// paints until then. The canvas is `absolute inset-0`, so CLS is structurally
// zero rather than measured-and-hoped-for.
const PixelWash = dynamic(() => import("./PixelWash"), { ssr: false });

export function Wash({
  name,
  animated,
}: {
  name: WashName;
  animated?: boolean;
}) {
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    // `requestIdleCallback` where it exists, a timeout in Safari. Both are
    // capped: on a busy page, paint it soon rather than never.
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(() => setAwake(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setAwake(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  return awake ? <PixelWash name={name} animated={animated} /> : null;
}
