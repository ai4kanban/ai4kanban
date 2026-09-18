"use client";

// A video or audio `<Asset>` (#872): the browser's own player, loading only the file's
// metadata until it is played. A file the browser turns down becomes a note in its place.

import { type SyntheticEvent, useCallback, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";

export type MediaMeta = { width: number; height: number; duration: number };

export function MediaPlayer({
  kind,
  href,
  title,
  fill,
  onMeta,
}: {
  kind: "video" | "audio";
  href: string;
  title: string;
  /** A video as wide as its container; otherwise it stops at its own size. Audio always is. */
  fill: boolean;
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
  return (
    <span className="block" style={fill ? { containerType: "inline-size" } : undefined}>
      <video
        {...common}
        playsInline
        style={{
          display: "block",
          background: "#000",
          ...(fill ? { width: "100%", maxHeight: "62.5cqw" } : { maxWidth: "100%", height: "auto" }),
        }}
      />
    </span>
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
