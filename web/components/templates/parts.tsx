import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { FiImage } from "react-icons/fi";
import { panelInset } from "@/components/styles";
import type { Access } from "@/lib/templates";
import type { TemplatesCopy } from "@/i18n/templates/types";

// The small pieces the catalog and a template's page share.

type Tone = "plain" | "free" | "pro" | "free-cover";

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: Tone }) {
  const fill = {
    plain: "bg-code text-muted",
    free: "bg-growth/10 text-growth",
    "free-cover": "bg-elev text-growth shadow-sm",
    pro: "bg-accent-deep text-elev",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${fill}`}>
      {children}
    </span>
  );
}

export function AccessTag({ access, t, cover }: { access: Access; t: TemplatesCopy; cover?: boolean }) {
  if (access === "pro") return <Tag tone="pro">{t.pro}</Tag>;
  return <Tag tone={cover ? "free-cover" : "free"}>{t.free}</Tag>;
}

export function Duration({ children }: { children: ReactNode }) {
  return (
    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-elev">
      {children}
    </span>
  );
}

/** Where an image would be, when none was registered. Never another template's. */
export function NoPreview({ label, aspect }: { label: string; aspect: string }) {
  return (
    <div className={`flex ${aspect} w-full flex-col items-center justify-center gap-2 rounded-xl bg-code text-sm text-muted`}>
      <FiImage className="h-5 w-5" aria-hidden="true" />
      {label}
    </div>
  );
}

/** One line where the content would be, and the one thing to do about it. */
export function StateBox({ line, children }: { line: string; children?: ReactNode }) {
  return (
    <div className={`${panelInset} flex flex-col items-center gap-4 px-8 py-16 text-center`}>
      <p className="text-lg font-semibold text-ink">{line}</p>
      {children}
    </div>
  );
}

/** A thin bar along a playing clip's foot. Drawn every frame: `timeupdate` is too coarse for a clip of a few seconds. */
export function Progress({ video }: { video: RefObject<HTMLVideoElement | null> }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const v = video.current;
      if (v && bar.current && v.duration) bar.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [video]);
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-ink/10" aria-hidden="true">
      <span ref={bar} className="block h-full w-0 bg-accent" />
    </span>
  );
}

/** A quiet block where content will be, breathing slowly; still under reduced motion. */
export function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" style={style} className={`block rounded-md bg-code motion-safe:animate-pulse ${className}`} />;
}

/** An image that fades in once loaded, over whatever wash sits behind it. `until` sizes it
 *  before then, for an image whose own ratio is not known yet. */
export function Img({ src, className = "", until = "", lazy }: { src: string; className?: string; until?: string; lazy?: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  // A cached image may finish before React attaches `onLoad`.
  useEffect(() => setLoaded(!!img.current?.complete && img.current.naturalWidth > 0), [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static export, and the image is Cloud's
    <img
      ref={img}
      src={src}
      alt=""
      loading={lazy ? "lazy" : undefined}
      decoding={lazy ? "async" : undefined}
      onLoad={() => setLoaded(true)}
      className={`transition-[opacity,transform] duration-200 motion-reduce:transition-none ${loaded ? "" : `opacity-0 ${until}`} ${className}`}
    />
  );
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
