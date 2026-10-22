"use client";

import { useEffect, useState } from "react";

/** Contents that open and shut by height (#1950) — the rail's Memory panel's 0fr → 1fr, which
 *  needs no measuring. Drawn from the first open on, so a fold never opened costs nothing; the
 *  first open starts shut for a frame so it has something to grow from. */
export function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [drawn, setDrawn] = useState(open);
  const [shown, setShown] = useState(open);
  if (open && !drawn) setDrawn(true);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    // Two frames: the first paints it shut, the second opens it.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setShown(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
  if (!drawn) return null;
  return (
    <div
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
