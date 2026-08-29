"use client";

// A card's open questions — read here, and decided here.
//
// The panel IS the control. At rest it is the block it has always been; hovered or
// focused it takes the double offset shadow that says a block can be clicked; clicked,
// every question the user owns turns into a tick list with Resolve under it. Clicking
// away puts it back, with whatever was ticked or typed kept as a draft.
//
// No dialog: the decision is made against the question, on the card it is about, rather
// than in a copy of the list floating over it.

import { useEffect, useRef } from "react";
import { FiCheckCircle, FiCheckSquare, FiCircle, FiSquare } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useDraftList, useDraftPicks } from "@/lib/draft";
import {
  FREE_TEXT_CHOICE,
  freeTextPick,
  hasOptions,
  parseQuestion,
  type CardQuestion,
} from "@/lib/questions";
import { answerNotes, type Card, type CloudEventAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { AgentReq } from "./agent-shared";
import { Button } from "./button";
import { QuestionTagBadge } from "./chips";

// The free-text box behind "Something else" — the dialog's input at the panel's scale.
const INPUT =
  "w-full resize-y rounded-[10px] border border-nb-ink/25 bg-nb-paper px-2.5 py-2 text-[13px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

export function OpenQuestions({
  card,
  open,
  onOpen,
  onClose,
  canDecide,
  disabledWhy,
  onRun,
}: {
  card: Card;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** False while a run or a delivery holds the card: the panel stays a plain read. */
  canDecide: boolean;
  /** Why it does, said on hover — the same sentence the held buttons carry. */
  disabledWhy?: string;
  onRun: (req: AgentReq, label: string) => void;
}) {
  const c = useCopy().card.questions;
  const box = useRef<HTMLDivElement>(null);

  // Answers are indexed over the user-owned questions ALONE — the same list, in the same
  // order, that a Cloud event carries (cli's snapshot.ts), so `cloudAnswers` lines up with
  // it entry for entry. The panel still draws every question; `slot` puts each answerable
  // row back in its place in that list.
  const mine = card.questions.filter((q) => parseQuestion(q.text).tag === "user");
  const slot = new Map<CardQuestion, number>(mine.map((q, i) => [q, i]));

  // Kept as a draft per card, so clicking away — or closing the page — loses nothing.
  // Cleared once a run has taken them.
  const [answers, setAnswer, clearAnswers] = useDraftList(`resolve:${card.id}`, mine.length);
  // An untouched question opens on the agent's recommendation, so a whole card of options
  // questions is one click to confirm.
  const [picks, setPick, clearPicks] = useDraftPicks(
    `resolve-picks:${card.id}`,
    mine.map((q) => (hasOptions(q) ? (q.recommend ?? []) : [])),
  );

  // Clicking away is how the panel closes — there is no Cancel, because nothing is lost.
  // Esc does the same for the keyboard.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose]);

  // Opening from the toolbar has to bring the panel on screen; opening by clicking it
  // must not move the page under the click. `nearest` is exactly that rule.
  useEffect(() => {
    if (open) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  if (card.questions.length === 0) return null;

  // Typing is a choice too: "Something else" is the last row of the tick list, and ticking
  // it opens the box. So a multi-select question can take two of the choices AND a word of
  // the user's own. Only the box behind an unticked "Something else" is dropped.
  const tick = (i: number, q: CardQuestion, n: number) => {
    const current = picks[i] ?? [];
    setPick(
      i,
      q.mode === "multi"
        ? current.includes(n)
          ? current.filter((x) => x !== n)
          : [...current, n].sort((a, b) => a - b)
        : current.includes(n)
          ? [] // clicking the ticked option again unticks it — back to unanswered
          : [n],
    );
  };

  const hasAnswer = mine.some((q, i) => {
    if (!hasOptions(q)) return Boolean(answers[i]?.trim());
    const selected = (picks[i] ?? []).some((n) => n <= (q.options ?? []).length);
    const typed = (picks[i] ?? []).includes(freeTextPick(q)) && Boolean(answers[i]?.trim());
    return selected || typed;
  });

  // Resolve alone, or resolve and keep going into implement in the same session. The
  // prompt (see buildPrompt) tells the agent to only implement when nothing genuine is
  // left for the user to decide.
  const submit = (andImplement: boolean) => {
    const notes = composeAnswers(mine, answers, picks);
    const cloudAnswers = composeCloudAnswers(mine, answers, picks);
    clearAnswers();
    clearPicks();
    onClose();
    onRun(
      {
        action: "resolve",
        id: card.id,
        title: card.title,
        notes,
        andImplement: andImplement || undefined,
        cloudRevision: card.revision,
        cloudAnswers,
      },
      `${andImplement ? "Resolve & implement" : "Resolve"} #${card.id}`,
    );
  };

  const live = canDecide && mine.length > 0;
  return (
    <div
      ref={box}
      data-open={open && live ? "" : undefined}
      title={!live ? disabledWhy : undefined}
      // The one section with something to decide in it, so it takes the ember — thinned to
      // a section ground, because a full `-soft` band this tall shouts over the answer.
      className={cn("nb-section group bg-nb-accent-wash p-3.5", live && "nb-decide", live && !open && "cursor-pointer")}
      onClick={live && !open ? onOpen : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="nb-tag">
          <span style={{ color: "var(--color-nb-accent)" }}>?</span> {c.heading}
        </div>
        {/* The affordance in words, and the keyboard's way in: the panel's shadow says a
            block can be clicked, but only a real button can be tabbed to. It arrives with
            that shadow — on hover, or on focus — so a panel nobody is pointing at is the
            clean read it has always been. */}
        {live && !open && (
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto cursor-pointer rounded-[8px] border border-nb-accent-deep/40 px-2 py-[3px] text-[10.5px] font-[700] uppercase tracking-[0.04em] opacity-0 transition-opacity hover:bg-nb-accent-soft focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ color: "var(--color-nb-accent-deep)" }}
          >
            {c.decide}
          </button>
        )}
      </div>
      {/* The marker leads the question inline rather than sitting in its own column:
          questions here run several lines, and a marker column holds that width open for
          all of them — a blank gutter beside every line but the first. Inline, the text
          wraps back under the marker. */}
      <ul className="flex flex-col gap-2.5 text-[13px] leading-[19px]">
        {card.questions.map((q, k) => {
          const { tag, text } = parseQuestion(q.text);
          const i = slot.get(q);
          const label = (
            <>
              <QuestionTagBadge tag={tag} />
              {text}
            </>
          );
          // Closed, or a question that is not the user's to answer — it stays a read.
          if (!open || !live || i === undefined) {
            return (
              <li key={k}>
                {label}
                {hasOptions(q) && <QuestionOptions question={q} />}
              </li>
            );
          }
          const options = hasOptions(q);
          // The box belongs to the "Something else" tick, so it only shows when that one
          // is on. A question with no choices at all is all box.
          const typing = !options || (picks[i] ?? []).includes(freeTextPick(q));
          return (
            <li key={k} className="flex flex-col gap-1.5">
              <span className="block font-[700]">{label}</span>
              {options && (
                <OptionPicker question={q} picked={picks[i] ?? []} onTick={(n) => tick(i, q, n)} />
              )}
              {typing && (
                <textarea
                  className={INPUT}
                  rows={2}
                  placeholder={options ? c.optionsPlaceholder : c.answerPlaceholder}
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswer(i, e.target.value)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {open && live && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-nb-ink/10 pt-3">
          <p className="text-[11.5px] leading-snug text-nb-ink-soft">{c.staysOpen}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!hasAnswer}
            onClick={() => submit(false)}
          >
            {c.resolve}
          </Button>
          <Button size="sm" disabled={!hasAnswer} onClick={() => submit(true)}>
            {c.andImplement}
          </Button>
        </div>
      )}
    </div>
  );
}

// The choices on an options question, read-only — the same list the panel hands the user
// once it is open, "Something else" included, so the options can be read without touching
// anything. The recommended ones wear a filled marker and say so in words; the marker's
// SHAPE says how many may be picked (round = one, square = as many as you like), matching
// the tick list it turns into.
function QuestionOptions({ question }: { question: CardQuestion }) {
  const c = useCopy().card.questions;
  const many = question.mode === "multi";
  const On = many ? FiCheckSquare : FiCheckCircle;
  const Off = many ? FiSquare : FiCircle;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {[...(question.options ?? []), FREE_TEXT_CHOICE].map((option, k) => {
        const recommended = (question.recommend ?? []).includes(k + 1);
        const Icon = recommended ? On : Off;
        return (
          <li
            key={k}
            className="flex items-baseline gap-1.5 text-[12.5px] leading-[18px]"
            style={{ color: recommended ? "var(--color-nb-accent-deep)" : undefined }}
          >
            <Icon aria-hidden className="relative top-[2px] shrink-0" style={{ width: 12, height: 12 }} />
            <span>
              {option}
              {recommended && (
                <span className="ml-1.5 text-[10.5px] font-[700] uppercase tracking-[0.04em]">
                  {c.recommended}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// The same list, live. Rows are buttons, not native radios/checkboxes, for one reason: a
// ticked option can be clicked again to untick it — a native radio can't — and leaving
// everything unticked is a real answer here ("I have no view; you research it").
//
// The last row is "Something else", the free-text choice every options question gets. It
// ticks like the rest; what it opens is the box under the list.
function OptionPicker({
  question,
  picked,
  onTick,
}: {
  question: CardQuestion;
  picked: number[];
  onTick: (n: number) => void;
}) {
  const c = useCopy().card.questions;
  const many = question.mode === "multi";
  const On = many ? FiCheckSquare : FiCheckCircle;
  const Off = many ? FiSquare : FiCircle;
  return (
    <div role={many ? "group" : "radiogroup"} aria-label={parseQuestion(question.text).text} className="flex flex-col gap-1">
      {[...(question.options ?? []), FREE_TEXT_CHOICE].map((option, k) => {
        const n = k + 1;
        const on = picked.includes(n);
        const Icon = on ? On : Off;
        return (
          <button
            key={k}
            type="button"
            role={many ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onTick(n)}
            className="flex cursor-pointer items-start gap-2 rounded-[10px] bg-nb-paper/60 px-2.5 py-1.5 text-left text-[12.5px] leading-[18px] transition-colors hover:bg-nb-accent-soft"
            style={{
              background: on ? "var(--color-nb-accent-soft)" : undefined,
              color: on ? "var(--color-nb-accent-deep)" : undefined,
              fontWeight: on ? 700 : 400,
            }}
          >
            <Icon aria-hidden className="relative top-[2px] shrink-0" style={{ width: 13, height: 13 }} />
            <span>
              {option}
              {(question.recommend ?? []).includes(n) && (
                <span className="ml-1.5 text-[10.5px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">
                  {c.recommended}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Pair the questions the user answered with their answers into a note block the agent can
// fold into the card. A question answered by ticking sends the option lines themselves, so
// the agent reads a choice rather than interpreting prose. Ticks and words can arrive
// together — "Something else" is one of the ticks. Unanswered questions stay open.
function composeAnswers(
  questions: CardQuestion[],
  answers: string[],
  picks: number[][],
): string | undefined {
  return answerNotes(
    questions.map((q, i) => {
      const options = hasOptions(q);
      // Words count only when the box was open: an unticked "Something else" leaves its
      // draft behind, and that draft is not an answer the user gave.
      const typing = !options || (picks[i] ?? []).includes(freeTextPick(q));
      return {
        question: parseQuestion(q.text).text,
        picked: options
          ? (picks[i] ?? []).map((n) => (q.options ?? [])[n - 1]).filter((o): o is string => !!o)
          : [],
        typed: typing ? (answers[i]?.trim() ?? "") : "",
      };
    }),
  );
}

/**
 * The same answers again, as the shape a Cloud event carries (#319) — one entry per
 * question, in the card's own order, blanks included. What #318's server reads them back
 * through is `answeredFromEvent`, and both ends compose their sentence with `answerNotes`.
 *
 * The board's own rule holds here too: a ticked option OR the user's own words, never both.
 * A real tick wins, because "Something else" is itself a tick and the box behind it is only
 * an answer when that tick is on.
 */
function composeCloudAnswers(
  questions: CardQuestion[],
  answers: string[],
  picks: number[][],
): CloudEventAnswer[] {
  return questions.map((q, i) => {
    const options = hasOptions(q);
    const real = options ? (picks[i] ?? []).filter((n) => n <= (q.options ?? []).length) : [];
    if (real.length > 0) return { picked: real, text: "" };
    const typed = !options || (picks[i] ?? []).includes(freeTextPick(q))
      ? (answers[i]?.trim() ?? "")
      : "";
    return { picked: [], text: typed };
  });
}
