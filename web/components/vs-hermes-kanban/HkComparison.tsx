import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { compareRows, type HkEdge } from "./vs-hermes-content";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

// A green check for the side that wins a row, a red cross for the side that
// doesn't — read at a glance, no legend needed.
function CheckIcon() {
  return (
    <FiCheck className="h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
  );
}

function XIcon() {
  return (
    <FiX className="h-4 w-4 shrink-0 text-[#f85149]/70" aria-hidden="true" />
  );
}

// A dash for a "neutral" row — neither side is worse, it's a deliberate
// trade-off that comes down to what you need.
function DashIcon() {
  return <FiMinus className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />;
}

type CellState = "win" | "lose" | "neutral";

// One half of a comparison row. A win is tinted with ink text; a loss is muted;
// a neutral trade-off is un-tinted but stays readable. The check / cross / dash
// says which without a label.
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
        {state === "win" && <CheckIcon />}
        {state === "lose" && <XIcon />}
        {state === "neutral" && <DashIcon />}
        <p className={`text-sm ${state === "lose" ? "text-muted" : "text-ink"}`}>
          {text}
        </p>
      </div>
    </div>
  );
}

// Map the row's winner to each side's cell state.
function states(edge: HkEdge): { kanban: CellState; hermes: CellState } {
  if (edge === "neutral") return { kanban: "neutral", hermes: "neutral" };
  if (edge === "kanban") return { kanban: "win", hermes: "lose" };
  return { kanban: "lose", hermes: "win" };
}

function Row({
  dimension,
  kanban,
  hermes,
  edge,
}: {
  dimension: string;
  kanban: string;
  hermes: string;
  edge: HkEdge;
}) {
  const s = states(edge);
  return (
    <div className={`${panelStatic} overflow-hidden`}>
      <div className="border-b-2 border-border bg-code px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-ink">
        {dimension}
      </div>
      <div className="grid divide-y-2 divide-border sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
        <Cell label="AI4Kanban" text={kanban} state={s.kanban} />
        <Cell label="Hermes Kanban" text={hermes} state={s.hermes} />
      </div>
    </div>
  );
}

export function HkComparison() {
  return (
    <section className="mt-24">
      <SectionHeading num="03" eyebrow="Head to head" title="AI4Kanban vs. Hermes Kanban" />
      <p className="text-ink">
        A{" "}
        <FiCheck
          className="inline-block h-4 w-4 shrink-0 align-text-bottom text-growth"
          aria-label="check"
        />{" "}
        is a clear win; a <span className="font-medium">dash</span> is a
        trade-off. The skill wins on simplicity and portability, Hermes on the
        durable shared queue and scale — the rest is a draw.
      </p>

      <div className="mt-6 space-y-3">
        {compareRows.map((r) => (
          <Row key={r.dimension} {...r} />
        ))}
      </div>
    </section>
  );
}
