"use client";

// The message box (#272), shared by the chat rail and the Create sheet (#426): what is
// typed, the row under it that says what sending does, and the button that sends it.
// One box with one set of rules — Enter starts a line, the button sends — so there is
// never a second box with rules of its own.
//
// What each owner adds is what sits on the foot row and which keys it takes back. The
// rail's Stop, its walk back through what it has sent, and the Esc that ends a reply are
// the rail's alone: the sheet starts a run and leaves, so it has none of them.

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { FiSend, FiSquare } from "react-icons/fi";
import { Button } from "./button";

/** How tall the box grows with what is typed, and what it opens at. */
const MAX_ROWS = 8;
const MIN_ROWS = 3;

/** What the rest of the window keeps whatever is typed — the top row, the rail's head, the
 *  hint line, and a few lines of the conversation above the box. */
const KEEP_PX = 260;

export function MessageBox({
  value,
  onChange,
  onSend,
  canSend,
  placeholder,
  label,
  sendLabel,
  hint,
  foot,
  guard,
  sendRef,
  stop,
  disabled = false,
  autoFocus = false,
  onArrow,
  escEndsReply = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** The corner button comes to nothing until this is true. */
  canSend: boolean;
  placeholder: string;
  /** What the box is called when it is read out. */
  label: string;
  sendLabel: string;
  /** The one short line under the box: the thing that matters right then, or nothing. */
  hint?: React.ReactNode;
  /** The foot row, left of the corner button — the rail's agent pick, the sheet's mode row. */
  foot?: React.ReactNode;
  /** A confirmation hung off the corner button — the sheet's Build now guard (#428). It is
   *  drawn inside the button's own positioned box, so it opens where the press was. */
  guard?: React.ReactNode;
  /** That box, for whatever draws the guard: it is the anchor an outside click is measured
   *  against, and where focus goes back to. */
  sendRef?: React.Ref<HTMLSpanElement>;
  /** The corner is Stop instead of Send, and pressing it ends the reply this server owns. */
  stop?: { label: string; onStop: () => void };
  /** Shut for good — no agent that can answer, or one already held with another. */
  disabled?: boolean;
  autoFocus?: boolean;
  /** Up/Down where the owner wants them — the rail walks back through what it has sent.
   *  Return true to keep the caret from moving. */
  onArrow?: (up: boolean) => boolean;
  /** The rail's own box: the one text box Esc is not taken in, because there it ends the
   *  reply instead (lib/chat-rail.ts). */
  escEndsReply?: boolean;
}) {
  const box = useGrow(value);
  return (
    <>
      <div className="rounded-[12px] bg-nb-paper p-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]">
        <textarea
          ref={box}
          data-chat-box={escEndsReply ? "" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            const arrow = e.key === "ArrowUp" || e.key === "ArrowDown";
            if (arrow && onArrow?.(e.key === "ArrowUp")) e.preventDefault();
          }}
          rows={MIN_ROWS}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={label}
          className="w-full resize-none bg-transparent px-2.5 pb-2 pt-1 text-[13px] leading-[1.5] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none disabled:opacity-60"
        />
        {/* One rung, 28px tall end to end: what the owner puts on the left, the corner
            button on the right, and no gap of its own in between — the foot decides what
            sits where by pushing its own last piece over. */}
        <div className="flex h-7 items-center gap-1.5">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">{foot}</span>
          {/* One button in this corner, not two: on a reply this server owns it IS Stop,
              and everywhere else it is a Send. */}
          <span ref={sendRef} className="relative flex shrink-0">
            <Button
              size="xs"
              disabled={stop ? false : !canSend}
              onClick={() => (stop ? stop.onStop() : onSend())}
              aria-label={stop ? stop.label : sendLabel}
            >
              {stop ? (
                <FiSquare className="text-[13px]" aria-hidden />
              ) : (
                <FiSend className="text-[13px]" aria-hidden />
              )}
              <span className="sr-only">{stop ? stop.label : sendLabel}</span>
            </Button>
            {guard}
          </span>
        </div>
      </div>
      {/* Lined up with the box's own inner margin, so the hint reads as a foot note under
          the control rather than a stray line under the page. */}
      {hint ? <div className="mt-1.5 px-1.5 text-[11px] text-nb-ink-soft">{hint}</div> : null}
    </>
  );
}

/** Grow the box with what is typed, and scroll past the ceiling rather than pushing the
 *  conversation off the screen. */
function useGrow(text: string) {
  const box = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 20;
    const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    // Eight rows where the window has room for them, fewer where it hasn't, never under
    // the three the box has always opened at.
    const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.floor((window.innerHeight - KEEP_PX) / line)));
    const ceiling = rows * line + pad;
    el.style.height = "auto";
    const wanted = el.scrollHeight;
    el.style.height = `${Math.min(wanted, ceiling)}px`;
    el.style.overflowY = wanted > ceiling ? "auto" : "hidden";
  }, []);

  useLayoutEffect(fit, [text, fit]);

  // The rail dragged wider takes the same words in fewer lines, and a shorter window brings
  // the ceiling down. Width only from the box itself: its own height is what `fit` changes.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let wide = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === wide) return;
      wide = el.clientWidth;
      fit();
    });
    watch.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return box;
}
