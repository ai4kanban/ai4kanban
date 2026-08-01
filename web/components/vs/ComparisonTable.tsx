import { Fragment } from "react";
import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { Rich } from "../Rich";
import { panelStatic } from "../styles";

// The side-by-side matrix, shared by all comparison pages. A green check
// marks the side that wins a row and a red cross the side that doesn't — read at
// a glance, no legend needed. A dash on both sides is a deliberate trade-off:
// neither is worse, it comes down to what you need.

export type CellState = "win" | "lose" | "neutral";

/** Which side a row goes to, from the page's point of view. */
export type Winner = "ours" | "theirs" | "neutral";

export type ComparisonRow = {
  key: string;
  winner: Winner;
  dimension: string;
  ours: string;
  theirs: string;
};

function Icon({ state }: { state: CellState }) {
  if (state === "win")
    return <FiCheck className="h-4 w-4 shrink-0 text-growth" aria-hidden="true" />;
  if (state === "lose")
    return <FiX className="h-4 w-4 shrink-0 text-[#f85149]/70" aria-hidden="true" />;
  return <FiMinus className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />;
}

// One half of a row. A win is tinted with ink text; a loss is muted; a neutral
// trade-off is un-tinted but stays readable.
function Cell({
  label,
  text,
  state,
}: {
  label: string;
  text: string;
  state: CellState;
}) {
  return (
    <div className={`px-4 py-3.5 ${state === "win" ? "bg-accent/[0.07]" : ""}`}>
      <span className="mb-1 block font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="flex items-start gap-2">
        <Icon state={state} />
        <p className={`text-sm ${state === "lose" ? "text-muted" : "text-ink"}`}>
          {text}
        </p>
      </div>
    </div>
  );
}

function states(winner: Winner): { ours: CellState; theirs: CellState } {
  if (winner === "neutral") return { ours: "neutral", theirs: "neutral" };
  if (winner === "ours") return { ours: "win", theirs: "lose" };
  return { ours: "lose", theirs: "win" };
}

export function ComparisonTable({
  rows,
  ourLabel,
  theirLabel,
}: {
  rows: ComparisonRow[];
  ourLabel: string;
  theirLabel: string;
}) {
  return (
    <div className="mt-6 space-y-3">
      {rows.map((r) => {
        const s = states(r.winner);
        return (
          <div key={r.key} className={`${panelStatic} overflow-hidden`}>
            <div className="border-b-2 border-border bg-code px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              {r.dimension}
            </div>
            <div className="grid divide-y-2 divide-border sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
              <Cell label={ourLabel} text={r.ours} state={s.ours} />
              <Cell label={theirLabel} text={r.theirs} state={s.theirs} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The "head to head" intro paragraph. Its copy carries a `{check}` placeholder
 * where the green tick belongs — a token rather than a fixed position, because
 * the word order around it moves from language to language.
 */
export function ComparisonIntro({ children }: { children: string }) {
  return (
    <p className="text-ink">
      {children.split("{check}").map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <FiCheck
              className="inline-block h-4 w-4 shrink-0 align-text-bottom text-growth"
              aria-label="check"
            />
          )}
          <Rich>{part}</Rich>
        </Fragment>
      ))}
    </p>
  );
}
