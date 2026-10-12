"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A drawing laid out at w×h and scaled to its box's width. The box holds the
// aspect ratio itself, so nothing moves while the scale is measured.
export function Fit({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  return (
    <div ref={box} className="relative overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: w, height: h, transform: `scale(${scale ?? 0})`, visibility: scale ? undefined : "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}
