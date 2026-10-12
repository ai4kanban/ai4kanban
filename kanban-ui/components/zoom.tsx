"use client";

// Zoom for a mockup or image (#1637): 25%–400% in ×1.25 steps, plus fit to width. Buttons only —
// the desktop app's ⌘+/⌘- zoom the whole window, and a mockup's frame swallows pinch gestures.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";

const MIN = 0.25;
const MAX = 4;
const STEP = 1.25;
const EPS = 0.001;

export type Zoom = {
  /** The drawn scale; 0 until the fit is measured. */
  scale: number;
  fit: number;
  /** Whether the scale is the fit one — following it as the width changes. */
  fitted: boolean;
  setFit: (fit: number) => void;
  set: (scale: number | null) => void;
};

/** `start` is the scale before any button is pressed; none means fit to width. */
export function useZoom(start?: number): Zoom {
  const [fit, setFitState] = useState(0);
  const [manual, set] = useState<number | null>(start ?? null);
  const setFit = useCallback((f: number) => setFitState((prev) => (Math.abs(prev - f) < EPS ? prev : f)), []);
  const scale = manual ?? fit;
  return { scale, fit, fitted: manual === null || Math.abs(manual - fit) < EPS, setFit, set };
}

/** Reports `fitOf(width)` for the element's width, now and whenever it changes. `fitOf`
 *  must be stable. */
export function useFitWidth<T extends HTMLElement>(
  setFit: (fit: number) => void,
  fitOf: ((width: number) => number) | null,
) {
  const box = useRef<T>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !fitOf) return;
    const measure = () => {
      if (el.clientWidth) setFit(fitOf(el.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [setFit, fitOf]);
  return box;
}

function FitWidth() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4v16M21 4v16M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3" />
    </svg>
  );
}

const BUTTON =
  "nb-tip nb-tip-below relative inline-flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-accent-deep disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

/** Zoom out · the percentage · zoom in · fit to width. Nothing until the fit is measured. */
export function ZoomControls({ zoom }: { zoom: Zoom }) {
  const c = useCopy().card.mockup;
  if (!zoom.fit) return null;
  const { scale } = zoom;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        className={BUTTON}
        data-tip={c.zoomOut}
        aria-label={c.zoomOut}
        disabled={scale <= MIN + EPS}
        onClick={() => zoom.set(Math.max(MIN, scale / STEP))}
      >
        <FiZoomOut size={13} aria-hidden />
      </button>
      <span className="w-[38px] text-center text-[12px] font-[600] tabular-nums text-nb-ink-soft">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        className={BUTTON}
        data-tip={c.zoomIn}
        aria-label={c.zoomIn}
        disabled={scale >= MAX - EPS}
        onClick={() => zoom.set(Math.min(MAX, scale * STEP))}
      >
        <FiZoomIn size={13} aria-hidden />
      </button>
      <button
        type="button"
        className={BUTTON}
        data-tip={c.fit}
        aria-label={c.fit}
        disabled={zoom.fitted}
        onClick={() => zoom.set(null)}
      >
        <FitWidth />
      </button>
    </span>
  );
}
