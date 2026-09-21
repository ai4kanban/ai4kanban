"use client";

// One picture, whole, over everything else (#530, #979): the chat's pasted pictures, a
// storyboard's frames and every markdown image open here.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMaximize2, FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useOverRail } from "@/lib/over-rail";
import { useSwipeBack } from "@/lib/swipe-back";

/** Fitted to the window and never past the picture's own pixels. Every way out — Esc, the ✕,
 *  the scrim, the swipe back — closes only this: Esc is taken in the capture phase and
 *  stopped, because the screens underneath answer it too. Focus goes back to whatever opened
 *  it, without scrolling, if that is still on the page. */
export function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const c = useCopy().shared;
  const close = useRef<HTMLButtonElement>(null);
  useOverRail();
  useSwipeBack(true, onClose);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    return () => {
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        // The ✕ is the dialog's one control, so focus stays on it.
        e.preventDefault();
        close.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || undefined}
      className="nb-scrim"
      style={{ alignItems: "center", zIndex: 60 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        ref={close}
        type="button"
        aria-label={c.close}
        onClick={onClose}
        className="absolute right-4 top-4 grid size-9 cursor-pointer place-items-center rounded-[8px] bg-nb-paper text-nb-ink shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
      >
        <FiX size={18} aria-hidden />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine or a
          markdown body's own URL. */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-[10px] object-contain shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
      />
    </div>,
    document.body,
  );
}

/** A picture that opens in ImagePreview to a click, Enter or Space — once it has loaded, so a
 *  broken one never opens a blank preview. Its own size and layout are the `<img>`'s; `hint`
 *  adds the corner "View larger" on hover and focus. */
export function ExpandableImage({
  className,
  hint,
  onLoad,
  onError,
  ...img
}: React.ComponentProps<"img"> & { hint?: boolean }) {
  const c = useCopy().shared;
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  // What it had loaded when pressed, so a picture that recovered opens as it recovered.
  const [open, setOpen] = useState<string | null>(null);
  const src = typeof img.src === "string" ? img.src : undefined;

  // A picture loaded before hydration has already fired its load event.
  useEffect(() => {
    const el = ref.current;
    setReady(!!el && el.complete && el.naturalWidth > 0);
  }, [src]);

  return (
    <>
      <span
        role={ready ? "button" : undefined}
        tabIndex={ready ? 0 : undefined}
        aria-label={ready ? c.viewLarger : undefined}
        title={ready && !hint ? c.viewLarger : undefined}
        onClick={(e) => {
          if (!ready) return;
          e.preventDefault();
          e.stopPropagation();
          setOpen(ref.current?.currentSrc || src || null);
        }}
        onKeyDown={(e) => {
          if (!ready || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          setOpen(ref.current?.currentSrc || src || null);
        }}
        className={`group relative max-w-full ${className ?? "inline-block align-bottom"} ${ready ? "cursor-zoom-in rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- its own src, passed through. */}
        <img
          {...img}
          alt={img.alt ?? ""}
          ref={ref}
          onLoad={(e) => {
            setReady(true);
            onLoad?.(e);
          }}
          onError={(e) => {
            setReady(false);
            onError?.(e);
          }}
        />
        {hint && ready && (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-[6px] bg-nb-paper px-2 py-1 text-[11.5px] font-[700] text-nb-ink opacity-0 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <FiMaximize2 size={12} aria-hidden />
            {c.viewLarger}
          </span>
        )}
      </span>
      {open && <ImagePreview src={open} alt={img.alt ?? ""} onClose={() => setOpen(null)} />}
    </>
  );
}
