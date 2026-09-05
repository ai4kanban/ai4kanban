"use client";

import { useEffect } from "react";
import { countPageView } from "@/lib/usage";

// One page view per document load (#297). It draws nothing, and both root layouts mount
// it, so every page of the site in every language is counted once.
//
// The count waits for the browser to go idle rather than going on mount: nothing the
// reader sees waits on it, and the landing page's largest paint is a screenshot deck. The
// two-second ceiling is what keeps a backgrounded tab from never counting at all.
export function PageView() {
  useEffect(() => {
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle
      ? window.requestIdleCallback(countPageView, { timeout: 2000 })
      : window.setTimeout(countPageView, 1);
    // React mounts an effect twice in development; cancelling keeps that one view.
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return null;
}
