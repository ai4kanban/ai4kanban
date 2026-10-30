// Copied from legacy kanban-ui/components/image-preview.tsx: one picture, whole, over
// everything else (#530, #979), and the dialog a full-size preview opens in. Trimmed: the
// right-click copy menu, the rail and swipe-back hooks.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMaximize2, FiX } from "react-icons/fi";
import { useCopy } from "../i18n";

/** Fitted to the window and never past the picture's own pixels. */
export function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <PreviewDialog label={alt} onClose={onClose}>
      <span onClick={(e) => e.stopPropagation()} className="relative flex min-w-0 max-w-full">
        <img
          src={src}
          alt={alt}
          className="max-h-[calc(100dvh-80px)] max-w-full rounded-[10px] object-contain shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
        />
      </span>
    </PreviewDialog>
  );
}

/** The round see-through button over a preview: its ✕, a slide deck's ‹ › (#1880). */
export const SCRIM_BUTTON =
  "grid size-10 cursor-pointer place-items-center rounded-full bg-nb-ink/60 text-white backdrop-blur-sm transition-colors hover:bg-nb-ink/80";

/** The dialog a preview opens in. Every way out — Esc, the ✕, the scrim — closes only this:
 *  Esc is taken in the capture phase and stopped, and so are ←/→ when `onStep` pages it.
 *  Focus goes back to whatever opened it. */
export function PreviewDialog({
  label,
  onClose,
  onStep,
  children,
}: {
  label: string;
  onClose: () => void;
  onStep?: (by: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const c = useCopy().shared;
  const close = useRef<HTMLButtonElement>(null);

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
      } else if (onStep && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.stopPropagation();
        e.preventDefault();
        onStep(e.key === "ArrowLeft" ? -1 : 1);
      } else if (e.key === "Tab") {
        const all = [...(close.current?.parentElement?.querySelectorAll<HTMLElement>("button, a[href], video[controls], [tabindex]") ?? [])].filter(
          (el) => el.getClientRects().length > 0,
        );
        const at = all.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        all[at < 0 ? 0 : (at + (e.shiftKey ? -1 : 1) + all.length) % all.length]?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, onStep]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label || undefined}
      className="nb-scrim"
      style={{ alignItems: "center", zIndex: 60 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button ref={close} type="button" aria-label={c.close} onClick={onClose} className={`absolute right-4 top-4 ${SCRIM_BUTTON}`}>
        <FiX size={20} aria-hidden />
      </button>
      {children}
    </div>,
    document.body,
  );
}

/** A picture that opens in ImagePreview to a click, Enter or Space — once it has loaded, so a
 *  broken one never opens a blank preview. `hint` adds the corner "View larger" on hover and
 *  focus. `onOpen` opens the caller's own preview instead. */
export function ExpandableImage({
  className,
  hint,
  onOpen,
  onLoad,
  onError,
  ...img
}: React.ComponentProps<"img"> & { hint?: boolean; onOpen?: () => void }) {
  const c = useCopy().shared;
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const src = typeof img.src === "string" ? img.src : undefined;
  const expand = () => (onOpen ? onOpen() : setOpen(ref.current?.currentSrc || src || null));

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
          expand();
        }}
        onKeyDown={(e) => {
          if (!ready || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          expand();
        }}
        className={`group relative max-w-full ${className ?? "inline-block align-bottom"} ${ready ? "cursor-zoom-in rounded-[6px] nb-focus" : ""}`}
      >
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
          <span className={`${CORNER} opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}>
            <FiMaximize2 size={12} aria-hidden />
            {c.viewLarger}
          </span>
        )}
      </span>
      {open && <ImagePreview src={open} alt={img.alt ?? ""} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The tag in a picture's top right corner. */
export const CORNER =
  "pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-[6px] bg-nb-paper px-2 py-1 text-[11.5px] font-[700] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)]";
