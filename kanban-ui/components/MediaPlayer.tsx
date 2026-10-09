"use client";

// A video or audio `<Asset>` (#872): the browser's own player, loading only the file's
// metadata until it is played. A file the browser turns down becomes a note in its place.
// A `loop` video (#1595) is an animation instead: muted, looping, no controls, playing
// only while on screen.

import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiPlay } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";

export type MediaMeta = { width: number; height: number; duration: number };

export function MediaPlayer({
  kind,
  href,
  title,
  fill,
  loop = false,
  onMeta,
}: {
  kind: "video" | "audio";
  href: string;
  title: string;
  /** A video as wide as its container; otherwise it stops at its own size. Audio always is. */
  fill: boolean;
  loop?: boolean;
  onMeta?: (meta: MediaMeta) => void;
}) {
  const c = useCopy().card.mockup;
  const [failed, setFailed] = useState(false);
  const report = useCallback(
    (el: HTMLMediaElement) => {
      const video = el instanceof HTMLVideoElement;
      onMeta?.({ width: video ? el.videoWidth : 0, height: video ? el.videoHeight : 0, duration: el.duration });
    },
    [onMeta],
  );
  // An error or metadata that arrived before hydration never reaches the handlers.
  const watch = useCallback(
    (el: HTMLMediaElement | null) => {
      if (el?.error) setFailed(true);
      else if (el && el.readyState >= HTMLMediaElement.HAVE_METADATA) report(el);
    },
    [report],
  );

  if (failed) {
    return (
      <span
        className="nb-outline flex items-start gap-2 px-3 py-2.5 text-[12.5px] leading-[18px] text-nb-ink-soft"
        style={{ background: "var(--color-nb-peach-soft)" }}
      >
        <FiAlertCircle aria-hidden className="relative top-[3px] shrink-0" style={{ width: 13, height: 13 }} />
        <span className="min-w-0 break-words">{c.unplayable}</span>
      </span>
    );
  }

  const common = {
    ref: watch,
    src: href,
    title,
    controls: true,
    preload: "metadata",
    onError: () => setFailed(true),
    onLoadedMetadata: (e: SyntheticEvent<HTMLMediaElement>) => report(e.currentTarget),
  } as const;

  if (kind === "audio") {
    return (
      <audio
        {...common}
        style={{ display: "block", width: "100%" }}
      />
    );
  }
  const style = {
    display: "block",
    background: "#000",
    ...(fill ? { width: "100%", maxHeight: "62.5cqw" } : { maxWidth: "100%", height: "auto" }),
  } as const;
  return (
    <span className="relative block" style={fill ? { containerType: "inline-size" } : undefined}>
      {loop ? (
        <LoopVideo common={common} style={style} play={c.play} />
      ) : (
        <video {...common} playsInline style={style} />
      )}
    </span>
  );
}

/** Plays while on screen; with reduced motion, or when the browser refuses to start it,
 *  it holds its first frame under a play button. */
function LoopVideo({
  common,
  style,
  play,
}: {
  common: Omit<React.ComponentProps<"video">, "ref"> & { ref: (el: HTMLMediaElement | null) => void };
  style: React.CSSProperties;
  play: string;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [held, setHeld] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeld(true);
      return;
    }
    const el = video.current;
    if (!el) return;
    const start = () => el.play().catch(() => setHeld(true));
    if (typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : el.pause()));
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  return (
    <>
      <video
        {...common}
        ref={(el) => {
          video.current = el;
          common.ref(el);
        }}
        controls={false}
        muted
        loop
        playsInline
        style={style}
      />
      {held && (
        <button
          type="button"
          aria-label={play}
          title={play}
          onClick={() => {
            setHeld(false);
            setStarted(true);
            video.current?.play().catch(() => setHeld(true));
          }}
          className="absolute left-1/2 top-1/2 flex size-[56px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]"
        >
          <FiPlay size={22} className="ml-[3px]" />
        </button>
      )}
    </>
  );
}

/** `0:42`, `1:02:05`. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const two = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}
