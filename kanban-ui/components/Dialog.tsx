"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useOverRail } from "@/lib/over-rail";

// A small modal on the neo-brutalism scrim. Esc closes; clicking the backdrop
// closes; the panel itself doesn't.
//
// The scrim is `position: fixed`, so it must render at the document root to
// cover the viewport. We portal it to <body>: a `backdrop-filter`/`transform`
// ancestor (e.g. the sticky, blurred header) would otherwise become the
// containing block for the fixed scrim and trap it inside that header's
// stacking context — the board would then paint over the modal.
export function Dialog({
  title,
  onClose,
  children,
  width = 520,
  height,
  flush = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  // A fixed height, e.g. "90vh". The panel keeps it whatever the content —
  // short content leaves room, long content scrolls — so the dialog doesn't
  // resize as its panes change. Left out, the panel sizes to its content.
  height?: number | string;
  // The child owns the body: no padding, no scroll — for a layout with panes of
  // its own, like Configuration's sidebar. The child scrolls its own panes.
  flush?: boolean;
}) {
  const c = useCopy().shared;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The chat rail wants Esc too (#267). A dialog is over it while it is up, so the key
  // closes the dialog and leaves the reply alone.
  useOverRail();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={onClose}>
      <div
        className="nb-panel flex flex-col"
        style={{ width, maxWidth: "100%", height, maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* A hairline, not an ink rule: the panel's own frame already says where
            the dialog is, and a second full-strength line under the title reads
            as a second block. Every dialog's title bar is this one. */}
        <div className="flex shrink-0 items-center justify-between border-b border-nb-ink/12 px-5 py-3">
          <h2 className="text-[15px] font-[800] tracking-[-0.02em]">{title}</h2>
          <button
            onClick={onClose}
            aria-label={c.close}
            className="-mr-1 grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10"
          >
            <FiX className="h-[18px] w-[18px]" />
          </button>
        </div>
        {flush ? (
          // Clipped to the panel's rounded corners: a pane with its own
          // background (Configuration's wash sidebar) would otherwise paint
          // square over the bottom corners.
          // flex-1 fills a fixed `height`; with a content-sized panel it's inert.
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-b-[14px] max-sm:flex-col">
            {children}
          </div>
        ) : (
          <div className="overflow-y-auto p-5">{children}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
