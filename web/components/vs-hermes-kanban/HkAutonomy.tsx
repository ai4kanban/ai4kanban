import type { ReactNode } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiX } from "react-icons/fi";
import { autonomyStops } from "./vs-hermes-content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelInset, panelStatic } from "../styles";
import { LogoMark } from "@/components/ui/Logo";
import type {
  VsHermesCopy,
  VsHermesStopKey,
} from "@/i18n/vs-hermes-kanban/types";

// The autonomy spectrum: three stops from "you plan everything" (a traditional
// board) to "agent plans everything" (Hermes's "drop a one-liner, walk away").
// The autonomy amounts (no / semi / full) are tick labels on the track itself;
// each card leads with the product — logo + name — over one sentence, with the
// coined term for the approach as its eyebrow.

const STOP_TAG: Record<VsHermesStopKey, ReactNode> = {
  traditional: "📋",
  kanban: <LogoMark size="xs" />,
  hermes: <HermesMark className="h-5 w-5" />,
};

// Eyebrow (the coined term) → logo + product name → one sentence.
//
// Ours is the stop in the middle, and the neutral ramp is what says so: it sits
// on the paper and the two beside it sink to the wash. It used to ask for an
// accent outline and an accent-colored shadow, which is the one thing no block
// on this site does — every outline is ink, and a hard shadow is the block's own
// weight rather than a glow.
function StopCard({
  stopKey,
  copy,
  ours,
}: {
  stopKey: VsHermesStopKey;
  copy: VsHermesCopy["autonomy"]["stops"][VsHermesStopKey];
  ours?: boolean;
}) {
  return (
    <div className={`${ours ? panelStatic : panelInset} p-5`}>
      <p
        className={`font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
          ours ? "text-accent-deep" : "text-muted"
        }`}
      >
        {copy.term}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {STOP_TAG[stopKey]}
        </span>
        <h3 className="text-lg font-semibold text-ink">{copy.heading}</h3>
      </div>
      <p className="mt-2.5 text-sm text-muted">
        <Rich code={ours ? "paper" : "wash"}>{copy.detail}</Rich>
      </p>
    </div>
  );
}

export function HkAutonomy({
  c,
  num = "05",
}: {
  c: VsHermesCopy["autonomy"];
  num?: string;
}) {
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      {/* Desktop: a slider-style gradient bar — dim on the left, full accent on
          the right, so the color itself encodes rising autonomy. Each stop is a
          bg-ringed knob with its autonomy amount as a tick label below. */}
      <div className="mt-8 hidden sm:block">
        <div className="mb-2 flex items-center justify-between font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <span>{c.scaleLeft}</span>
          <span className="text-accent-deep">{c.scaleMiddle}</span>
          <span>{c.scaleRight}</span>
        </div>
        <div className="relative mb-14 h-2.5">
          <div className="absolute inset-0 rounded-full border-2 border-border bg-gradient-to-r from-elev via-accent/40 to-accent" />
          {autonomyStops.map((s) => (
            <span key={s.key} aria-hidden="true">
              <span
                className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg ${
                  s.ours ? "bg-accent-deep ring-2 ring-accent-deep" : "bg-muted"
                }`}
                style={{ left: s.left }}
              />
              <span
                className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent-deep" : "text-muted"
                }`}
                style={{ left: s.left }}
              >
                {c.stops[s.key].level}
              </span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {autonomyStops.map((s) => (
            <StopCard
              key={s.key}
              stopKey={s.key}
              copy={c.stops[s.key]}
              ours={s.ours}
            />
          ))}
        </div>
      </div>

      {/* Phone: the same spectrum turned vertical — a gradient rail down the
          left, each card as a stop with its autonomy amount as a tick label. */}
      <div className="relative mt-8 pl-4 sm:hidden">
        <span
          className="absolute bottom-1 left-0 top-1 w-1 rounded-full bg-gradient-to-b from-elev via-accent/40 to-accent"
          aria-hidden="true"
        />
        <p className="flex items-center gap-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          {c.scaleLeft}
          <FiArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        </p>
        <div className="mt-3 space-y-4">
          {autonomyStops.map((s) => (
            <div key={s.key}>
              <p
                className={`mb-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent-deep" : "text-muted"
                }`}
              >
                {c.stops[s.key].level}
              </p>
              <StopCard stopKey={s.key} copy={c.stops[s.key]} ours={s.ours} />
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <FiArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          {c.scaleRight}
        </p>
      </div>

      {/* The whole argument for the middle, as one glanceable contrast. */}
      <div className={`${panelStatic} mt-6 overflow-hidden`}>
        <div className="border-b-2 border-border bg-code px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-ink">
          {c.worstCaseLabel}
        </div>
        <div className="grid divide-y-2 divide-border sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
          {/* Same ramp as the comparison table: the losing half sinks to the
              wash, so the half that answers is the brighter one. */}
          <div className="flex items-start gap-2.5 bg-code px-4 py-3.5">
            <FiX className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden="true" />
            <p className="text-sm text-muted">
              <Rich code="wash">{c.worstCaseTheirs}</Rich>
            </p>
          </div>
          <div className="flex items-start gap-2.5 px-4 py-3.5">
            <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
            <p className="text-sm text-muted">
              <Rich>{c.worstCaseOurs}</Rich>
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
