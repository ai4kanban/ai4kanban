"use client";

// The one way this app asks "are you sure?" — a panel that hangs off the control that was
// pressed, rather than a dialog that takes the screen. Title, consequence, two buttons.
// Esc or a click outside dismisses it and gives the anchor its focus back.

import { useEffect, useId, useRef } from "react";
import { useCopy } from "@/i18n/use-copy";
import { useOverRail } from "@/lib/over-rail";
import { Button } from "./button";

export function ConfirmationPopover({
  open,
  anchorRef,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy,
  align = "left",
  confirm = "quiet",
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  title: string;
  description: React.ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  /** Which edge it hangs from. A control at the right edge of a panel has to open
   *  leftwards: 320px past the page's right edge is horizontal scroll on the whole app. */
  align?: "left" | "right";
  /** How much the confirm weighs. `filled` for a move worth seeing before it is pressed. */
  confirm?: "quiet" | "filled";
  onDismiss: () => void;
  /** Left out when there is nothing to confirm — the popover is then the answer itself,
   *  and Cancel is the only way on. */
  onConfirm?: () => void;
}) {
  const c = useCopy().card.delivery;
  const titleId = useId();
  const descriptionId = useId();
  const safeRef = useRef<HTMLButtonElement>(null);

  // Over the chat rail while it is open, so Esc dismisses the confirmation and leaves a
  // reply alone (#267).
  useOverRail(open);

  useEffect(() => {
    if (!open) return;
    safeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onDismiss();
      requestAnimationFrame(() => anchorRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchorRef, onDismiss, open]);

  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`nb-panel-sm absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+8px)] z-40 w-[min(320px,calc(100vw-32px))] bg-nb-paper p-3 text-left`}
    >
      <p id={titleId} className="text-[13px] font-[700] text-nb-ink">{title}</p>
      <p id={descriptionId} className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">{description}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button ref={safeRef} variant="ghost" size="xs" onClick={onDismiss}>
          {cancelLabel}
        </Button>
        {onConfirm && (
          <Button
            variant={confirm === "filled" ? "accent" : "ghost"}
            size="xs"
            disabled={busy}
            style={
              confirm === "filled"
                ? undefined
                : { color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }
            }
            onClick={onConfirm}
          >
            {busy ? c.working : confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
