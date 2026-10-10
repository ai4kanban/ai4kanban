"use client";

import { useEffect, useRef, useState } from "react";

// A site animation (#1595): a muted, looping MP4 in place of a GIF. Nothing downloads,
// the poster included, until it nears the viewport, so no `autoplay`. With reduced
// motion, or when the browser refuses to start it, the poster stays up with the
// browser's own controls.
export function LoopVideo({
  src,
  poster,
  width,
  height,
  alt,
  className,
}: {
  src: string;
  poster: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [controls, setControls] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) setControls(true);
    const start = () => {
      setNear(true);
      if (!still) el.play().catch(() => setControls(true));
    };
    if (typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? start() : el.pause()),
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={video}
      src={src}
      poster={near ? poster : undefined}
      width={width}
      height={height}
      aria-label={alt}
      muted
      loop
      playsInline
      preload="none"
      controls={controls}
      className={className}
      style={{ aspectRatio: `${width} / ${height}`, height: "auto", maxWidth: "100%" }}
    />
  );
}
