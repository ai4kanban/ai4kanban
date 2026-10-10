"use client";

import { useEffect, useRef, useState } from "react";

// An image that requests nothing until it is about to scroll into view; Chrome's own
// `loading="lazy"` starts up to 2500px early. `width`/`height` hold its box meanwhile.
export function NearImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = img.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src={near ? src : undefined}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      className={className}
    />
  );
}
