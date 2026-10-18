"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";

const SRC = "https://cdn.ai4kanban.dev/home/hero-demo-v1.mp4";
const POSTER = "/home/hero-demo-poster.webp";

// The /demo recording, muted and looping. The poster is the page's LCP element, so the video
// waits for it before it starts loading, and it plays only while on screen. It starts from
// script rather than `autoPlay`, so a reader who prefers reduced motion keeps the first frame.
export function HeroVideo({ label }: { label: string }) {
  preload(POSTER, { as: "image", fetchPriority: "high" });
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ready = false;
    let seen = false;
    const sync = () => (ready && seen ? video.play().catch(() => {}) : video.pause());
    const poster = new Image();
    poster.src = POSTER;
    poster.decode().catch(() => {}).finally(() => {
      ready = true;
      sync();
    });
    const io = new IntersectionObserver(([entry]) => {
      seen = !!entry?.isIntersecting;
      sync();
    });
    io.observe(video);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={SRC}
      poster={POSTER}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      className="block aspect-[16/10] w-full bg-elev"
    />
  );
}
