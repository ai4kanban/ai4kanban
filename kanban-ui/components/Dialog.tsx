"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { usePhone } from "@/lib/media";
import { useOverRail } from "@/lib/over-rail";

// A small modal on the neo-brutalism scrim. Esc closes; clicking the backdrop
// closes; the panel itself doesn't.
//
// The scrim is `position: fixed`, so it must render at the document root to
// cover the viewport. We portal it to <body>: a `backdrop-filter`/`transform`
// ancestor (e.g. the sticky, blurred header) would otherwise become the
// containing block for the fixed scrim and trap it inside that header's
// stacking context — the board would then paint over the modal.
//
// At phone width there is no scrim and no panel (#357): a dialog is a page pushed over
// what opened it. A 520px card floating on a darkened 375px screen is a card the width of
// the screen with a border drawn just inside its edges, which is a page pretending not to
// be one — and the ring of scrim left around it is the only way out, which is not a way
// out a thumb can find. So the panel takes the screen, its title bar carries the ✕ that
// cancels, and its buttons pin to the foot (DialogButtons in agent-shared.tsx).
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
  const phone = usePhone();
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

  // The title bar is the same one either way — a hairline, not an ink rule: the panel's
  // own frame already says where the dialog is, and a second full-strength line under the
  // title reads as a second block. On a phone the ✕ is also the whole of Cancel, so it is
  // given a thumb's target.
  const head = (
    <div
      className={`flex shrink-0 items-center justify-between border-b border-nb-ink/12 ${
        phone ? "px-4 py-2" : "px-5 py-3"
      }`}
    >
      <h2 className="min-w-0 truncate text-[15px] font-[800] tracking-[-0.02em]">{title}</h2>
      <button
        onClick={onClose}
        aria-label={c.close}
        className={`-mr-1 grid cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10 ${
          phone ? "size-11" : "size-7"
        }`}
      >
        <FiX className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  if (phone) {
    return createPortal(
      // `data-a4k-overlay` so the app's title bar lets the top of this page take clicks
      // (app/globals.css) — a drag region swallows a press rather than passing it on.
      <div data-a4k-overlay className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col bg-nb-paper">
        {head}
        {flush ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : (
          // `flex flex-col` so a foot marked `mt-auto` (DialogButtons) drops to the bottom
          // of a short page; on a long one `mt-auto` is inert and its own `sticky` holds it.
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
        )}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="nb-scrim" style={{ alignItems: "center" }} onClick={onClose}>
      <div
        className="nb-panel flex flex-col"
        style={{ width, maxWidth: "100%", height, maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {head}
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
