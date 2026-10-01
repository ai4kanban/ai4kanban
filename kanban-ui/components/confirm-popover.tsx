"use client";

// The one way this app asks "are you sure?" — a panel that hangs off the control that was
// pressed, rather than a dialog that takes the screen. Title, consequence, two buttons.
// Esc or a click outside dismisses it; Esc and Cancel give the anchor its focus back.

import { useId, useRef } from "react";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "./button";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

type Measurable = { getBoundingClientRect(): DOMRect };

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
  /** Which edge of the anchor it lines up with. */
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
  // The control that opened it. Esc and Cancel hand the focus back before the caller closes:
  // a control drawn only while its row is hovered or focused is gone a moment later.
  const opener = useRef<HTMLElement | null>(null);
  const handBack = () => opener.current?.focus();

  return (
    <Popover open={open} onOpenChange={(next) => !next && onDismiss()}>
      <PopoverAnchor virtualRef={anchorRef as React.RefObject<Measurable>} />
      <PopoverContent
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        side="bottom"
        sideOffset={8}
        align={align === "right" ? "end" : "start"}
        className="a4k-nodrag w-[min(320px,calc(100vw-32px))] rounded-[13px] p-3 text-left"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const anchor = anchorRef.current;
          const active = document.activeElement;
          opener.current =
            active instanceof HTMLElement && anchor?.contains(active)
              ? active
              : (anchor?.querySelector<HTMLElement>("button") ?? null);
          safeRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={handBack}
        // Radix knows no trigger here: a press on the anchor is the caller's to answer.
        onInteractOutside={(event) => {
          if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        <p id={titleId} className="text-[13px] font-[700] text-nb-ink">{title}</p>
        <p id={descriptionId} className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">{description}</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            ref={safeRef}
            variant="ghost"
            size="xs"
            onClick={() => {
              handBack();
              onDismiss();
            }}
          >
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
      </PopoverContent>
    </Popover>
  );
}
