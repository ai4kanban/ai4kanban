"use client";

// ---- commenting on a draft, and submitting the batch (#458) -----------------
//
// A read-through of a draft finds several things at once. Sending each the moment it is
// found costs a rewrite of the whole file per remark, each one unaware of the rest — so a
// comment is SAVED on its passage, and the whole batch goes to one polish.
//
// Three pieces, all of them the marketing card page's:
//
//   • LeaveComment — the box that floats up while a passage is selected.
//   • useCommentMarks — the wash and the number each commented line carries, put back after
//     every one of OverType's own renders.
//   • DraftComments — the list under the editor, and Submit.
//
// The QUOTE is the anchor, not the offsets: a comment records where its passage sat, and it
// is re-found from there, so an edit elsewhere in the draft leaves it in place. One whose
// passage is gone keeps its words, loses its marks, and still goes to the polish.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiEdit3, FiMessageSquare, FiTrash2 } from "react-icons/fi";
import type { OverTypeInstance } from "overtype";
import { useCopy } from "@/i18n/use-copy";
import type { DraftPassage } from "@/lib/screen";
import type { DraftComment } from "@/lib/types";
import { Button } from "./button";
import { HAIRLINE, PULSE_DOT } from "./chrome";

/** The class a commented line wears. Its look is in `app/globals.css`, which is also where
 *  the reason it has to be written there rather than here is. */
const MARK = "a4k-commented";

// ---- where a comment sits now ----------------------------------------------

/** The offsets a comment's passage occupies in the draft as it now reads, or null when the
 *  passage is no longer in it. The search starts where the passage sat and takes whichever
 *  copy of the quote is nearer, so an edit above a comment does not move it. */
export function anchorOf(text: string, comment: DraftComment): { from: number; to: number } | null {
  const { quote, from } = comment;
  if (!quote) return null;
  if (text.startsWith(quote, from)) return { from, to: from + quote.length };
  const after = text.indexOf(quote, from);
  const before = text.lastIndexOf(quote, from);
  if (after < 0 && before < 0) return null;
  const at = after < 0 ? before : before < 0 ? after : after - from <= from - before ? after : before;
  return { from: at, to: at + quote.length };
}

/** Which source line an offset falls on, counting from zero. */
function lineAt(text: string, at: number): number {
  let line = 0;
  for (let i = 0; i < at && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/** The preview's elements, one entry per SOURCE line. OverType draws a block per line,
 *  except that consecutive list lines collapse into one `<ul>`/`<ol>` and a fenced block's
 *  body into one `<pre>` — which is repeated here, so the count never drifts past one. */
function lineElements(preview: HTMLElement): HTMLElement[] {
  const lines: HTMLElement[] = [];
  for (const node of Array.from(preview.children)) {
    const el = node as HTMLElement;
    if (el.tagName === "UL" || el.tagName === "OL") {
      for (const item of Array.from(el.children)) lines.push(item as HTMLElement);
    } else if (el.tagName === "PRE") {
      const rows = (el.textContent ?? "").split("\n").length;
      for (let i = 0; i < rows; i++) lines.push(el);
    } else {
      lines.push(el);
    }
  }
  return lines;
}

/** Draw the marks: every line a comment's passage touches carries the wash, and the line it
 *  starts on carries its number. Written from scratch each time — the preview's HTML is
 *  replaced wholesale on every render, so there is never a mark to edit in place. */
function markPreview(preview: HTMLElement, text: string, comments: DraftComment[]): void {
  for (const el of Array.from(preview.querySelectorAll<HTMLElement>(`.${MARK}`))) {
    el.classList.remove(MARK);
    el.removeAttribute("data-comment");
  }
  if (!comments.length) return;
  const lines = lineElements(preview);
  comments.forEach((comment, i) => {
    const at = anchorOf(text, comment);
    if (!at) return;
    const first = lineAt(text, at.from);
    const last = lineAt(text, Math.max(at.from, at.to - 1));
    for (let n = first; n <= last; n++) {
      const el = lines[n];
      if (!el) continue;
      el.classList.add(MARK);
      // Two comments on one line: the first one's number stands, and the second is read off
      // the list. Stacking numbers in an 18px box would say less than one of them does.
      if (n === first && !el.hasAttribute("data-comment")) el.setAttribute("data-comment", String(i + 1));
    }
  });
}

/**
 * Keep the marks on the editor's preview. Answers the callback OverType's `onRender` should
 * call — hold it in a ref, since the instance is built once and its options never see a
 * later render's values.
 *
 * It repaints on its own whenever the batch changes, which is the case `onRender` misses: a
 * comment left or deleted changes nothing in the draft, so nothing re-renders.
 */
export function useCommentMarks(editor: OverTypeInstance | null, comments: DraftComment[]): () => void {
  const held = useRef(comments);
  held.current = comments;
  const paint = useCallback(() => {
    if (editor) markPreview(editor.preview, editor.getValue(), held.current);
  }, [editor]);
  useEffect(() => paint(), [paint, comments]);
  return paint;
}

// ---- leaving one ------------------------------------------------------------

/**
 * The box that floats up while a passage is selected: what should change here, and Comment.
 *
 * It stands at the foot of the editor rather than beside the selection: a textarea gives no
 * coordinates for a range, and every way of guessing them is wrong on a wrapped line. The
 * offsets are the textarea's own `selectionStart`/`selectionEnd` — which, because OverType
 * edits the file itself, ARE offsets into the file.
 */
export function LeaveComment({
  editor,
  onLeave,
}: {
  editor: OverTypeInstance;
  onLeave: (passage: DraftPassage) => void;
}) {
  const c = useCopy().card.marketing;
  const [picked, setPicked] = useState<{ from: number; to: number; text: string } | null>(null);
  const [words, setWords] = useState("");
  // Typing in the input takes focus off the textarea, which is itself a selection change —
  // so what was selected is read while the editor still holds it, and kept here.
  const box = editor.textarea;
  useEffect(() => {
    const check = () => {
      if (document.activeElement !== box) return;
      const { selectionStart: from, selectionEnd: to, value } = box;
      setPicked(from === to ? null : { from, to, text: value.slice(from, to) });
    };
    document.addEventListener("selectionchange", check);
    return () => document.removeEventListener("selectionchange", check);
  }, [box]);

  if (!picked) return null;
  const leave = () => {
    if (!words.trim()) return;
    onLeave({ quote: picked.text, from: picked.from, to: picked.to, words: words.trim() });
    setWords("");
    setPicked(null);
  };
  return (
    <div className="absolute inset-x-0 bottom-9 flex justify-center px-8">
      <div className="flex w-full max-w-[420px] items-center gap-1.5 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1.5 shadow-[3px_3px_0_0_var(--color-nb-ink)]">
        <input
          autoFocus
          value={words}
          placeholder={c.comment.placeholder}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") leave();
            if (e.key === "Escape") setPicked(null);
          }}
          className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none"
        />
        <Button size="xs" disabled={!words.trim()} onClick={leave}>
          <FiMessageSquare className="text-[12px]" aria-hidden />
          {c.comment.leave}
        </Button>
      </div>
    </div>
  );
}

// ---- the batch --------------------------------------------------------------

/** The comments on this draft, and the one thing to do with them. It is drawn only where
 *  there is at least one: an empty band under every draft would be a permanent reminder of
 *  a feature instead of a place things are. */
export function DraftComments({
  comments,
  polishing,
  disabled,
  onEdit,
  onDrop,
  onSubmit,
}: {
  comments: DraftComment[];
  /** A polish on this draft is running — the batch it is working through, not one to add to. */
  polishing: boolean;
  /** Something else is writing this card, or a move of this block is in flight. */
  disabled: boolean;
  onEdit: (commentId: string, words: string) => void;
  onDrop: (commentId: string) => void;
  onSubmit: () => void;
}) {
  const c = useCopy().card.marketing;
  if (!comments.length) return null;
  return (
    <div className="shrink-0 bg-nb-wash px-5 pb-4 pt-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="flex items-center gap-2 pb-2.5">
        <span className="text-[12px] font-[800]">{c.comment.heading}</span>
        <Count n={comments.length} />
        <span className="ml-auto flex items-center gap-2.5">
          {polishing ? (
            <span
              className="flex items-center gap-1.5 text-[12.5px] font-[700]"
              style={{ color: "var(--color-nb-accent-deep)" }}
            >
              <span className={PULSE_DOT} aria-hidden />
              {c.comment.polishing(comments.length)}
            </span>
          ) : (
            <>
              <span className="text-[11.5px] text-nb-ink-soft">{c.comment.hint}</span>
              <Button size="xs" disabled={disabled} onClick={onSubmit}>
                <FiMessageSquare className="text-[12px]" aria-hidden />
                {c.comment.submit(comments.length)}
              </Button>
            </>
          )}
        </span>
      </div>
      {/* Capped, because a long read-through is exactly when this band would otherwise eat
          the draft it is about. */}
      <div className="flex max-h-[34vh] flex-col gap-1.5 overflow-y-auto">
        {comments.map((comment, i) => (
          <Row
            key={comment.id}
            n={i + 1}
            comment={comment}
            locked={polishing || disabled}
            onEdit={(words) => onEdit(comment.id, words)}
            onDrop={() => onDrop(comment.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** How many are waiting — the same chip the line marks wear, so the number in the margin and
 *  the number here read as the same thing. */
function Count({ n }: { n: number }) {
  return (
    <span
      className="flex h-[18px] items-center rounded-[6px] px-1.5 font-mono text-[11px] font-[800]"
      style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
    >
      {n}
    </span>
  );
}

/** One comment: its number, the passage it is on, and what it asks for. The passage is
 *  quoted rather than pointed at — the mark in the margin says where, and the line here says
 *  which, for a comment whose passage has since been rewritten away. */
function Row({
  n,
  comment,
  locked,
  onEdit,
  onDrop,
}: {
  n: number;
  comment: DraftComment;
  locked: boolean;
  onEdit: (words: string) => void;
  onDrop: () => void;
}) {
  const c = useCopy().card.marketing;
  const [editing, setEditing] = useState(false);
  const [words, setWords] = useState(comment.words);
  useEffect(() => {
    if (!editing) setWords(comment.words);
  }, [comment.words, editing]);

  const save = () => {
    const said = words.trim();
    setEditing(false);
    if (said && said !== comment.words) onEdit(said);
  };

  return (
    <div className={`flex items-center gap-3 rounded-[10px] bg-nb-paper px-3 py-2.5 ${locked ? "opacity-70" : ""}`}>
      <span
        className="grid size-[18px] shrink-0 place-items-center rounded-[5px] font-mono text-[10.5px] font-[800]"
        style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
      >
        {n}
      </span>
      <span
        className="w-[320px] max-w-[40%] shrink-0 truncate pl-2.5 font-mono text-[11.5px] text-nb-ink-soft"
        style={{ borderLeft: "2px solid var(--color-nb-accent-soft)" }}
        title={comment.quote}
      >
        {comment.quote}
      </span>
      {editing ? (
        <input
          autoFocus
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-[7px] border border-nb-ink/25 bg-nb-paper px-2 py-1 text-[12.5px] text-nb-ink focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12.5px]" title={comment.words}>
          {comment.words}
        </span>
      )}
      {!locked && (
        <span className="flex shrink-0 items-center gap-0.5">
          {editing ? (
            <Quiet label={c.comment.save} onClick={save}>
              <FiCheck className="text-[13px]" aria-hidden />
            </Quiet>
          ) : (
            <Quiet label={c.comment.edit} onClick={() => setEditing(true)}>
              <FiEdit3 className="text-[13px]" aria-hidden />
            </Quiet>
          )}
          <Quiet label={c.comment.drop} onClick={onDrop}>
            <FiTrash2 className="text-[13px]" aria-hidden />
          </Quiet>
        </span>
      )}
    </div>
  );
}

/** A row's own controls: no frame until the pointer is on them, so a list of six comments
 *  reads as six sentences rather than as twelve buttons. */
function Quiet({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // These sit beside an input that saves on blur, and a press that blurred it would run
      // that save and re-render the row out from under its own click. Taking the press keeps
      // the focus where it is; the click is what acts, so a keyboard still reaches them.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-[26px] cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
    >
      {children}
    </button>
  );
}
