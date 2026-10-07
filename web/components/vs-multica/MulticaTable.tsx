import { FiCheck, FiMinus } from "react-icons/fi";
import type { Winner } from "../vs/ComparisonTable";

// One open table: a column head once, hairlines between rows. The stronger side
// takes a green check; the other a dash, since on every row it can be
// configured rather than missing.

export type MulticaRow = {
  key: string;
  winner: Exclude<Winner, "neutral">;
  dimension: string;
  ours: string;
  oursTip?: string;
  theirs: string;
};

function Cell({
  label,
  text,
  tip,
  win,
}: {
  label: string;
  text: string;
  tip?: string;
  win: boolean;
}) {
  return (
    <div className="py-4 sm:px-4">
      <span className="mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted sm:hidden">
        {label}
      </span>
      <div className="flex items-start gap-2">
        {win ? (
          <FiCheck className="h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
        ) : (
          <FiMinus className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        )}
        <p className={`text-sm ${win ? "text-ink" : "text-muted"}`}>
          {text}
          {tip && <span className="mt-1 block text-xs text-muted">{tip}</span>}
        </p>
      </div>
    </div>
  );
}

const GRID = "sm:grid sm:grid-cols-[11rem_1fr_1fr]";
const RULE = "border-[color-mix(in_srgb,var(--color-ink)_12%,transparent)]";

export function MulticaTable({
  rows,
  ourLabel,
  theirLabel,
}: {
  rows: MulticaRow[];
  ourLabel: string;
  theirLabel: string;
}) {
  return (
    <div className="mt-8">
      <div
        className={`hidden border-b-2 border-border pb-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] ${GRID}`}
      >
        <span />
        <span className="px-4 text-accent-deep">{ourLabel}</span>
        <span className="px-4 text-muted">{theirLabel}</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className={`border-b ${RULE} ${GRID}`}>
          <div className="pt-4 text-sm font-semibold text-ink sm:py-4">{r.dimension}</div>
          <Cell label={ourLabel} text={r.ours} tip={r.oursTip} win={r.winner === "ours"} />
          <Cell label={theirLabel} text={r.theirs} win={r.winner === "theirs"} />
        </div>
      ))}
    </div>
  );
}
