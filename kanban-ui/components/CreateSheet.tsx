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
//
// The mode row under the box says what sending does. **Add task** writes the card, and is
// what the screen always opens on. **Build now** (#428) sends the sentence straight to a
// build with no card at all — it skips every step the board exists for, so it names them in
// a guard off Send and starts nothing until that is confirmed.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiPlus, FiX, FiZap } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { MessageBox } from "./composer";
import { ConfirmationPopover } from "./confirm-popover";

/** What sending does. `card` writes one and refines it; `build` writes none (#428). */
export type CreateMode = "card" | "build";

export function CreateSheet({
  release,
  onClose,
  onSend,
}: {
  /** The version the board is showing (#104), which a card written here ships in. */
  release: string | null;
  onClose: () => void;
  /** Start the run, and say whether it started. A refusal — uncommitted changes, another
   *  build already working in this checkout, a workspace out of reach — leaves the sheet up
   *  with the sentence still in the box, so it can be sent again once the reason is fixed. */
  onSend: (description: string, mode: CreateMode) => Promise<{ ok: boolean; error?: string }>;
}) {
  const c = useCopy().board.create.sheet;
  const startFailed = useCopy().board.create.startFailed;
  const close = useCopy().shared.close;
  // The same draft key the dialog used, so text typed and not sent is kept the way it
  // always was — and a draft written before this screen existed is still here.
  const [text, setText, clearDraft] = useDraft("create");
  const [mounted, setMounted] = useState(false);
  // Never the mode the screen opens on: a build with no card is the deliberate one.
  const [mode, setMode] = useState<CreateMode>("card");
  const [guarding, setGuarding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  useEffect(() => setMounted(true), []);

  // While the sheet is up it is the layer Esc answers, and the rail is not (#267). The
  // guard takes it back off the sheet while it is open, so Esc dismisses the guard first.
  useOverRail();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guarding) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guarding]);

  if (!mounted) return null;

  const send = async (picked: CreateMode) => {
    const description = text.trim();
    if (!description || sending) return;
    setGuarding(false);
    setError(null);
    setSending(true);
    const res = await onSend(description, picked);
    setSending(false);
    // Only a run that actually started takes the sentence with it. A refusal keeps the
    // sheet and the words exactly as they were, and says why under the box.
    if (res.ok) clearDraft();
    else setError(res.error ?? startFailed);
  };

  // Send in Build now opens the guard rather than starting anything. Switching back to
  // Add task closes it: the guard belongs to the mode, not to the press.
  const pressSend = () => {
    if (!text.trim()) return;
    if (mode === "build") setGuarding(true);
    else void send("card");
  };

  const pick = (picked: CreateMode) => {
    setMode(picked);
    setGuarding(false);
    setError(null);
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
              onSend={pressSend}
              canSend={!!text.trim() && !sending}
              autoFocus
              placeholder={c.placeholder}
              label={c.placeholder}
              sendLabel={c.send}
              sendRef={sendRef}
              // The guard hangs off Send — this app's one way to ask "are you sure?". It
              // lists what Build now skips rather than arguing for it.
              guard={
                <ConfirmationPopover
                  open={guarding}
                  anchorRef={sendRef}
                  align="right"
                  title={c.guard.title}
                  description={
                    <span className="flex flex-col gap-1">
                      {c.guard.skips.map((line) => (
                        <span key={line} className="flex items-start gap-1.5">
                          <FiX
                            className="mt-[3px] shrink-0 text-[11px] text-nb-peach-ink"
                            aria-hidden
                          />
                          <span>{line}</span>
                        </span>
                      ))}
                    </span>
                  }
                  cancelLabel={c.guard.cancel}
                  confirmLabel={c.guard.confirm}
                  // Confirming closes the guard and leaves the box's own Send disabled
                  // while the run starts, so there is nothing here to sit busy.
                  busy={false}
                  onDismiss={() => setGuarding(false)}
                  onConfirm={() => void send("build")}
                />
              }
              // The mode row: one chip per thing sending can do, the picked one filled.
              // #427 adds Discuss, and the row grows to the right so the box, the button
              // and the headline never move.
              foot={
                <span role="radiogroup" aria-label={c.modes} className="flex items-center gap-1">
                  <Mode
                    on={mode === "card"}
                    icon={<FiPlus className="text-[12px]" aria-hidden />}
                    label={c.addTask}
                    onPick={() => pick("card")}
                  />
                  <Mode
                    on={mode === "build"}
                    icon={<FiZap className="text-[12px]" aria-hidden />}
                    label={c.buildNow}
                    onPick={() => pick("build")}
                  />
                </span>
              }
              hint={
                // The keys on the left and, opposite them, what this mode leaves behind:
                // the release a new card ships in, or — in Build now — that there is no
                // card at all. A board on no release says nothing there rather than saying
                // so.
                <span className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5">
                  <span>{c.keys}</span>
                  {mode === "build" ? (
                    <span className="shrink-0 text-nb-peach-ink">{c.builds}</span>
                  ) : (
                    release && <span className="shrink-0">{c.shipsIn(release)}</span>
                  )}
                </span>
              }
            />
            {/* A start that was refused, said where the press was rather than behind the
                sheet. The sentence is still in the box above it. */}
            {error && (
              <p className="nb-panel-sm mt-2.5 bg-nb-peach-soft p-2.5 text-[12px] leading-relaxed text-nb-peach-ink">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// One chip in the mode row. The picked one is filled and the rest are quiet text: the row
// has to read as one control with one answer, not as a line of buttons.
function Mode({
  on,
  icon,
  label,
  onPick,
}: {
  on: boolean;
  icon: React.ReactNode;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 py-[5px] text-[12px] font-[700] uppercase leading-none tracking-[0.04em] transition-colors ${
        on
          ? "bg-nb-accent-soft text-nb-accent-deep"
          : "text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
