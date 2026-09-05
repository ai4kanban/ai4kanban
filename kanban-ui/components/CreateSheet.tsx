"use client";

// The screen Create task opens (#426) — a full-screen sheet over the board, in the shape a
// fresh agent chat opens in: a centred headline, a one-line slogan, the message box under
// them, and nothing else.
//
// It is an action, not a place: it lays over the board and hands it back on Esc or the ✕,
// rather than becoming a tab the header would have to carry at every width.
//
// The box is the chat rail's own (components/composer.tsx), so Enter sends and Shift-Enter
// starts a line here exactly as it does there. What the rail keeps is the rail's: the walk
// back through what it has sent, its Stop, and the Esc that ends a reply — here Esc closes
// the sheet and the reply the rail is writing behind it carries on.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiPlus, FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { MessageBox } from "./composer";

export function CreateSheet({
  release,
  onClose,
  onSend,
}: {
  /** The version the board is showing (#104), which a card written here ships in. */
  release: string | null;
  onClose: () => void;
  /** Start the run. The sheet closes itself first, so this never has to. */
  onSend: (description: string) => void;
}) {
  const c = useCopy().board.create.sheet;
  const close = useCopy().shared.close;
  // The same draft key the dialog used, so text typed and not sent is kept the way it
  // always was — and a draft written before this screen existed is still here.
  const [text, setText, clearDraft] = useDraft("create");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // While the sheet is up it is the layer Esc answers, and the rail is not (#267).
  useOverRail();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const send = () => {
    const description = text.trim();
    if (!description) return;
    clearDraft();
    onSend(description);
  };

  return createPortal(
    // No `data-a4k-overlay` here, unlike a dialog: the window's top strip is a drag region
    // (app/globals.css) and the sheet is drawn under it, so the traffic lights and the drag
    // still answer. Only the ✕ takes its press back out of the strip.
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-nb-paper">
      <div className="flex h-[43px] shrink-0 items-center justify-end px-3 max-md:h-14 max-md:px-2">
        <button
          onClick={onClose}
          aria-label={close}
          className="a4k-nodrag grid size-7 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10 max-md:size-11"
        >
          <FiX className="h-[18px] w-[18px] max-md:h-5 max-md:w-5" />
        </button>
      </div>

      {/* Centred, then lifted by the foot padding: optically centred sits a little above
          the middle, and the box is what the eye should land on. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10 max-md:pb-14">
        <div className="flex w-full max-w-[600px] flex-col items-center">
          <h1 className="text-center text-[27px] font-[800] leading-[1.2] tracking-[-0.025em] max-md:text-[21px]">
            {c.headline}
          </h1>
          <p className="mt-2 text-center text-[13.5px] text-nb-ink-soft max-md:text-[12.5px]">
            {c.slogan}
          </p>
          <div className="mt-6 w-full max-md:mt-5">
            <MessageBox
              value={text}
              onChange={setText}
              onSend={send}
              canSend={!!text.trim()}
              autoFocus
              placeholder={c.placeholder}
              label={c.placeholder}
              sendLabel={c.send}
              // The mode row. One chip for now — it says what sending does; #427 adds
              // Discuss and #428 adds Build now, and the row grows to the right so the
              // box, the button and the headline never move.
              foot={
                <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-nb-accent-soft px-2.5 py-[5px] text-[12px] font-[700] uppercase leading-none tracking-[0.04em] text-nb-accent-deep">
                  <FiPlus className="text-[12px]" aria-hidden />
                  {c.addTask}
                </span>
              }
              hint={
                // The keys on the left and, where the board is showing one, the release
                // the new card ships in opposite them. A board on no release says nothing
                // there rather than saying so.
                <span className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5">
                  <span>{c.keys}</span>
                  {release && <span className="shrink-0">{c.shipsIn(release)}</span>}
                </span>
              }
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
