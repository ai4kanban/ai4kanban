// The card's open questions, docked above the AI chat's message box (#2101): one question at a
// time on a cool grey ground, numbered choices (checkboxes when several apply), 跳过 and the
// pager on the bottom row; the last question's 下一题 becomes 提交, which sends every answer at
// once. No "something else" row: typing is the chat. Folds into one line.

import { useEffect } from "react";
import { FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiChevronUp } from "react-icons/fi";
import type { Copy } from "../i18n";
import type { CardQuestion } from "../lib/card-info";
import { cn } from "../lib/utils";
import { Button } from "./button";

type QCopy = Copy["questions"];

/** Where the panel is and what is picked, kept by the page so closing the chat loses nothing.
 *  Picks are keyed by question text; an unpicked question starts on its recommendation. */
export type Answers = { at: number; folded: boolean; picks: Record<string, number[]> };
export const NO_ANSWERS: Answers = { at: 0, folded: false, picks: {} };

const pickedOf = (a: Answers, q: CardQuestion) => a.picks[q.text] ?? q.recommend;

/** Starts the discussion attached to the answers; the comments rail cuts it off. */
export const DISCUSSION = "\n\n<!-- discussion -->\n";

/** The decision's text: each question and its answer, then the asker's recent chat. */
export function answerText(
  c: QCopy,
  questions: CardQuestion[],
  a: Answers,
  discussion: { role: "user" | "agent"; body: string }[],
): string {
  const answers = questions
    .map((q) => {
      const picked = pickedOf(a, q);
      return `${q.text}\n→ ${picked.length ? picked.map((k) => q.options[k]).join(c.sep) : c.skipped}`;
    })
    .join("\n\n");
  if (!discussion.length) return answers;
  const lines = discussion.map((m) => `${m.role === "user" ? c.me : "AI"}: ${m.body.length > 1200 ? `${m.body.slice(0, 1200)}…` : m.body}`);
  return `${answers}${DISCUSSION}${c.discussion}\n\n${lines.join("\n\n")}`;
}

const PAGER =
  "inline-flex h-7 cursor-pointer items-center gap-0.5 rounded-[8px] px-2 text-[12px] font-[600] text-nb-ink hover:bg-nb-paper/70 disabled:cursor-default disabled:text-nb-ink-soft/50 disabled:hover:bg-transparent";

export function QuestionPanel({
  c,
  questions,
  answers,
  onChange,
  busy,
  phone,
  onSubmit,
}: {
  c: QCopy;
  questions: CardQuestion[];
  answers: Answers;
  onChange: (next: Answers) => void;
  busy?: boolean;
  phone?: boolean;
  onSubmit: () => void;
}) {
  const at = Math.min(answers.at, questions.length - 1);
  const q = questions[at]!;
  const last = at === questions.length - 1;
  const picked = pickedOf(answers, q);
  const set = (patch: Partial<Answers>) => onChange({ ...answers, at, ...patch });
  const go = (n: number) => set({ at: Math.max(0, Math.min(questions.length - 1, n)) });
  const choose = (k: number) => {
    const next = q.multi ? (picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].sort()) : [k];
    set({ picks: { ...answers.picks, [q.text]: next }, ...(!q.multi && !last ? { at: at + 1 } : {}) });
  };
  const skip = () => set({ picks: { ...answers.picks, [q.text]: [] }, ...(!last ? { at: at + 1 } : {}) });

  // A choice's number picks it, outside the message box.
  useEffect(() => {
    if (answers.folded) return;
    const onKey = (e: KeyboardEvent) => {
      if (busy || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable], [role=dialog], [role=menu]")) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > q.options.length) return;
      e.preventDefault();
      choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (answers.folded)
    return (
      <button
        type="button"
        onClick={() => set({ folded: false })}
        className="nb-section mb-1.5 flex h-9 w-full cursor-pointer items-center gap-2 bg-[#eef0f3] pl-3.5 pr-2 text-left text-[13px] font-[700] text-nb-ink hover:brightness-[0.98]"
      >
        <span className="min-w-0 flex-1 truncate">{c.pending(questions.length)}</span>
        <FiChevronUp className="shrink-0 text-[15px] text-nb-ink-soft" aria-hidden />
      </button>
    );

  return (
    <section aria-label={c.heading} aria-busy={busy || undefined} className="nb-section mb-1.5 flex flex-col bg-[#eef0f3]">
      <div className="flex items-start gap-2 pl-3.5 pr-2 pt-3">
        <h2 className="min-w-0 flex-1 pt-[3px] text-[14px] font-[700] leading-[20px] text-nb-ink">{q.text}</h2>
        <button
          type="button"
          onClick={() => set({ folded: true })}
          aria-label={c.collapse}
          title={c.collapse}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-paper/70"
        >
          <FiChevronDown className="text-[15px]" aria-hidden />
        </button>
      </div>
      <ol className={cn("mt-1.5 flex flex-col overflow-y-auto px-2", phone ? "max-h-[148px]" : "max-h-[168px]", busy && "pointer-events-none opacity-60")}>
        {q.options.map((option, k) => (
          <Row key={k} n={k + 1} multi={q.multi} on={picked.includes(k)} note={q.recommend.includes(k) ? c.recommended : undefined} onPick={() => choose(k)}>
            {option}
          </Row>
        ))}
      </ol>
      <div className="mt-1 flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={skip} disabled={busy} className={cn(PAGER, "text-nb-ink-soft")}>
          {c.skip}
        </button>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" disabled={at === 0} onClick={() => go(at - 1)} className={PAGER}>
            <FiChevronLeft className="text-[14px]" aria-hidden />
            {c.prev}
          </button>
          <span className="min-w-[40px] text-center text-[12px] font-[600] tabular-nums text-nb-ink-soft">
            {at + 1} / {questions.length}
          </span>
          {last ? (
            <Button size="xs" className="ml-1" disabled={busy} onClick={onSubmit}>
              {c.submit}
            </Button>
          ) : (
            <button type="button" onClick={() => go(at + 1)} className={PAGER}>
              {c.next}
              <FiChevronRight className="text-[14px]" aria-hidden />
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function Row({ n, multi, on, note, onPick, children }: { n: number; multi: boolean; on: boolean; note?: string; onPick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        role={multi ? "checkbox" : "radio"}
        aria-checked={on}
        onClick={onPick}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-1.5 py-1 text-left text-[13px] leading-[20px] text-nb-ink hover:bg-nb-paper/70 focus-visible:bg-nb-paper/70 max-md:py-1.5",
          on && "bg-nb-paper font-[600]",
        )}
      >
        {multi ? (
          <span
            aria-hidden
            className={cn("inline-flex size-[16px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px]", on ? "border-nb-ink bg-nb-ink text-nb-paper" : "border-nb-ink/30 bg-nb-paper")}
            style={{ margin: "0 1px" }}
          >
            {on && <FiCheck className="text-[11px]" strokeWidth={3} />}
          </span>
        ) : (
          <kbd className={cn("inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] font-sans text-[10.5px] font-[600]", on ? "bg-nb-ink text-nb-paper" : "bg-nb-paper text-nb-ink-soft")}>{n}</kbd>
        )}
        <span className="min-w-0 flex-1">{children}</span>
        {note && <span className="shrink-0 rounded-full bg-nb-accent-soft px-2 py-0.5 text-[11px] font-[700] leading-[16px] text-nb-accent-deep">{note}</span>}
        {on && !multi && <FiCheck className="shrink-0 text-[13px] text-nb-ink" aria-hidden />}
      </button>
    </li>
  );
}
