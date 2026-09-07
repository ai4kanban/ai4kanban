"use client";

// ---- what the marketing editor says about saving (#479) ---------------------
//
// Saving has no button, so the only thing that can report it is the page. It reports it
// where the work is — on the caret's own line, at the editor's right edge — rather than in
// a corner: a line of small grey type beside the file name is not read while typing.
//
// Five states, and only two of them wait for an answer. Unsaved, saving and saved come and
// go on their own; a save that FAILED and a file that changed under held words both stop the
// idle save, and both stay until the user says what to do.
//
// The same two answers are offered a second time under whichever control was pressed, since
// a move that has to write first — a tab, a rewrite, a submit — otherwise looks dead.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheck, FiRepeat } from "react-icons/fi";
import type { OverTypeInstance } from "overtype";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "./button";
import { PULSE_DOT } from "./chrome";
import { caretRect } from "./DraftComments";

/** What the editor has to say about this tab's file, if anything. */
export type SaveState = "none" | "unsaved" | "saving" | "saved" | "failed" | "changed";

/** How far the chip stands off the editor's right edge, and how close the caret may come
 *  before the chip drops a line to keep out of its way. */
const EDGE = 10;
const CLEAR = 12;

// ---- the chip on the caret's line -------------------------------------------

/**
 * The save state, drawn on the caret's own line.
 *
 * `tick` is bumped by whatever the caller knows moves the caret and the state does not —
 * typing, a re-read, the editor arriving. Selection and scroll are watched here.
 */
export function SaveMark({
  editor,
  host,
  state,
  tick,
  onRetry,
  onKeepMine,
  onTakeFile,
}: {
  editor: OverTypeInstance;
  /** The element OverType was mounted into — what the chip is positioned within. */
  host: React.RefObject<HTMLDivElement | null>;
  state: SaveState;
  tick: number;
  /** Write what is held again, after a save that failed. */
  onRetry: () => void;
  /** The two answers to a file that changed under words the editor still holds. */
  onKeepMine: () => void;
  onTakeFile: () => void;
}) {
  const chip = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [top, setTop] = useState<number | null>(null);
  const [moved, setMoved] = useState(0);

  // The caret moves without the draft changing, and the draft scrolls without either.
  useEffect(() => {
    const bump = () => setMoved((n) => n + 1);
    const box = editor.textarea;
    document.addEventListener("selectionchange", bump);
    box.addEventListener("scroll", bump);
    window.addEventListener("resize", bump);
    return () => {
      document.removeEventListener("selectionchange", bump);
      box.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
    };
  }, [editor]);

  useLayoutEffect(() => {
    setWidth(chip.current?.getBoundingClientRect().width ?? 0);
  }, [state]);

  useLayoutEffect(() => {
    const frame = host.current;
    if (!frame || state === "none") return setTop(null);
    const rect = caretRect(editor.preview, editor.getValue(), editor.textarea.selectionStart);
    const box = frame.getBoundingClientRect();
    if (!rect) return setTop(null);
    const line = rect.height || 24;
    let at = rect.top - box.top;
    // The caret is within the chip's width of the right edge, so the chip steps out of its
    // way: the next line down, or — on the last one — the line above.
    if (rect.right > box.right - width - EDGE - CLEAR) {
      at = at + 2 * line <= box.height ? at + line : at - line;
    }
    setTop(Math.min(Math.max(at, 0), Math.max(box.height - line, 0)));
  }, [editor, host, state, tick, moved, width]);

  if (state === "none") return null;
  return (
    <span
      className="absolute z-20 flex"
      style={{ right: EDGE, top: top ?? 0, visibility: top === null ? "hidden" : undefined }}
    >
      <span ref={chip} className="relative block">
        <Chip state={state} onRetry={onRetry} />
        {state === "changed" && <ChangedAnswers onKeepMine={onKeepMine} onTakeFile={onTakeFile} />}
      </span>
    </span>
  );
}

/** One chip per state. Failed carries its own retry: the failure is reported here, so this
 *  is where it is answered. */
function Chip({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const t = useCopy();
  const c = t.card.marketing.save;
  if (state === "failed") {
    return (
      <span className={`${BAND} bg-nb-peach-soft pl-2 pr-1 text-nb-peach-ink`}>
        <FiAlertCircle className="text-[12px]" aria-hidden />
        {c.failed}
        <button
          type="button"
          onClick={onRetry}
          className="ml-0.5 flex h-[18px] cursor-pointer items-center gap-1 rounded-[6px] border-[1.2px] border-current bg-nb-paper px-1.5 text-[11px] font-[700]"
        >
          <FiRepeat className="text-[10px]" aria-hidden />
          {c.retry}
        </button>
      </span>
    );
  }
  if (state === "changed") {
    return (
      <span className={`${BAND} bg-nb-peach-soft px-2 text-nb-peach-ink`}>
        <FiAlertCircle className="text-[12px]" aria-hidden />
        {c.changed}
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className={`${BAND} px-2`} style={{ background: "var(--color-nb-accent-wash)", color: "var(--color-nb-accent-deep)" }}>
        <span className={PULSE_DOT} aria-hidden />
        {t.shared.saving}
      </span>
    );
  }
  if (state === "unsaved") {
    return (
      <span className={`${BAND} bg-nb-wash px-2 text-nb-ink-soft`}>
        <span
          aria-hidden
          className="block size-[6px] shrink-0 rounded-full"
          style={{ boxShadow: "inset 0 0 0 1.5px currentColor" }}
        />
        {c.unsaved}
      </span>
    );
  }
  return (
    <span className={`${BAND} px-2`} style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}>
      <FiCheck className="text-[11px]" aria-hidden />
      {c.saved}
    </span>
  );
}

const BAND = "flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[7px] text-[11px] font-[700]";

/** A rewrite landed under words the editor is still holding. Both versions are offered and
 *  neither is picked here: whichever the page took, the other one would be gone. */
function ChangedAnswers({ onKeepMine, onTakeFile }: { onKeepMine: () => void; onTakeFile: () => void }) {
  const c = useCopy().card.marketing.save;
  return (
    <Pop label={c.changedTitle}>
      <p className="flex items-center gap-1.5 text-[13px] font-[700] text-nb-ink">
        <FiAlertCircle className="shrink-0 text-[13px] text-nb-peach-ink" aria-hidden />
        {c.changedTitle}
      </p>
      <p className="mt-1 text-[12px] leading-[1.6] text-nb-ink-soft">{c.changedBody}</p>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onTakeFile}>
          {c.takeFile}
        </Button>
        <Button variant="ghost" size="xs" onClick={onKeepMine}>
          {c.keepMine}
        </Button>
      </div>
    </Pop>
  );
}

// ---- and under whichever control was pressed --------------------------------

/**
 * Why a move that had to write first did not happen, said under the control that was
 * pressed. Both refusals are answerable from here, so the press leads somewhere rather than
 * looking dead.
 */
export function SaveRefused({
  kind,
  draft,
  align = "left",
  side = "down",
  onCancel,
  onRetry,
  onKeepMine,
  onTakeFile,
}: {
  kind: "failed" | "changed";
  /** Which draft is holding the words — the tab pressed may be another one. */
  draft: string;
  align?: "left" | "right";
  /** Which way it opens. The comment band is at the foot of the window, so its own refusal
   *  hangs upward — downward it would be off the bottom of the screen. */
  side?: "up" | "down";
  onCancel: () => void;
  onRetry: () => void;
  onKeepMine: () => void;
  onTakeFile: () => void;
}) {
  const t = useCopy();
  const c = t.card.marketing.save;
  const changed = kind === "changed";
  const title = changed ? c.changedTitle : c.refusedTitle(draft);
  return (
    <Pop label={title} align={align} side={side}>
      <p className="flex items-center gap-1.5 text-[13px] font-[700] text-nb-ink">
        <FiAlertCircle className="shrink-0 text-[13px] text-nb-peach-ink" aria-hidden />
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-[1.6] text-nb-ink-soft">
        {changed ? c.changedBody : c.refusedBody}
      </p>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        {changed ? (
          <>
            <Button variant="ghost" size="xs" onClick={onTakeFile}>
              {c.takeFile}
            </Button>
            <Button variant="ghost" size="xs" onClick={onKeepMine}>
              {c.keepMine}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="xs" onClick={onCancel}>
              {t.shared.cancel}
            </Button>
            <Button size="xs" onClick={onRetry}>
              <FiRepeat className="text-[12px]" aria-hidden />
              {c.retrySave}
            </Button>
          </>
        )}
      </div>
    </Pop>
  );
}

/** The panel both of the above hang in — a dialog, because it asks something and holds the
 *  only way to answer it. */
function Pop({
  label,
  align = "right",
  side = "down",
  children,
}: {
  label: string;
  align?: "left" | "right";
  side?: "up" | "down";
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-label={label}
      className={`nb-panel-sm absolute z-30 w-[320px] bg-nb-paper p-3 ${
        side === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
      }`}
      style={align === "left" ? { left: 0 } : { right: 0 }}
    >
      {children}
    </div>
  );
}
