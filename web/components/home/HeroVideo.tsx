"use client";

import { useEffect, useRef } from "react";

const SRC = "https://cdn.ai4kanban.dev/home/hero-demo-v1.mp4";
const POSTER = "https://cdn.ai4kanban.dev/home/hero-demo-poster-v1.jpg";

// The /demo recording, muted and looping. It starts from script rather than `autoPlay`, so a
// reader who prefers reduced motion keeps the first frame.
export function HeroVideo({ label }: { label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.play().catch(() => {});
  }, []);
  return (
    <video
      ref={ref}
      src={SRC}
      poster={POSTER}
      muted
      loop
      playsInline
      preload="auto"
      aria-label={label}
      className="block aspect-[16/10] w-full bg-elev"
    />
  );
}
