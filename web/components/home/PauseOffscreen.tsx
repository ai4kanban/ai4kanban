"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A box whose CSS animations hold still while it is off screen.
const CSS = "[data-off] *{animation-play-state:paused!important}";

export function PauseOffscreen({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute("data-off", !entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className={className}>
      <style>{CSS}</style>
      {children}
    </div>
  );
}
