import type { ReactNode } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { autonomyStops } from "./vs-hermes-content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";
import type { VsHermesCopy, VsHermesStopKey } from "@/i18n/types";

// The autonomy spectrum: three stops from "you plan everything" (a traditional
// board) to "agent plans everything" (Hermes's "drop a one-liner, walk away").
// The autonomy amounts (no / semi / full) are tick labels on the track itself;
// each card leads with the product — logo + name — over one sentence, with the
// coined term for the approach as its eyebrow.

const STOP_TAG: Record<VsHermesStopKey, ReactNode> = {
  traditional: "📋",
  kanban: "🗂️",
  hermes: <HermesMark className="h-5 w-5" />,
};

// Eyebrow (the coined term) → logo + product name → one sentence.
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
    <div
      className={
        ours
          ? "rounded-lg border-2 border-accent/60 bg-elev p-5 shadow-[4px_4px_0_0_var(--color-accent)]"
          : `${panelStatic} p-5`
      }
    >
      <p
        className={`font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
          ours ? "text-accent" : "text-muted"
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
        <Rich code="plain">{copy.detail}</Rich>
      </p>
    </div>
  );
}

export function HkAutonomy({ c }: { c: VsHermesCopy["autonomy"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="05" {...c.heading} />
      <p className="text-ink">
        <Rich code="plain">{c.lead}</Rich>
      </p>

      {/* Desktop: a slider-style gradient bar — dim on the left, full accent on
          the right, so the color itself encodes rising autonomy. Each stop is a
          bg-ringed knob with its autonomy amount as a tick label below. */}
      <div className="mt-8 hidden sm:block">
        <div className="mb-2 flex items-center justify-between font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <span>{c.scaleLeft}</span>
          <span className="text-accent">{c.scaleMiddle}</span>
          <span>{c.scaleRight}</span>
        </div>
        <div className="relative mb-14 h-2.5">
          <div className="absolute inset-0 rounded-full border border-border bg-gradient-to-r from-elev via-accent/30 to-accent/90" />
          {autonomyStops.map((s) => (
            <span key={s.key} aria-hidden="true">
              <span
                className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg ${
                  s.ours ? "bg-accent ring-2 ring-accent" : "bg-muted"
                }`}
                style={{ left: s.left }}
              />
              <span
                className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent" : "text-muted"
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
          className="absolute bottom-1 left-0 top-1 w-1 rounded-full bg-gradient-to-b from-elev via-accent/30 to-accent/90"
          aria-hidden="true"
        />
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          {c.scaleLeft} ↓
        </p>
        <div className="mt-3 space-y-4">
          {autonomyStops.map((s) => (
            <div key={s.key}>
              <p
                className={`mb-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent" : "text-muted"
                }`}
              >
                {c.stops[s.key].level}
              </p>
              <StopCard stopKey={s.key} copy={c.stops[s.key]} ours={s.ours} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-right font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          ↑ {c.scaleRight}
        </p>
      </div>

      {/* The whole argument for the middle, as one glanceable contrast. */}
      <div className={`${panelStatic} mt-6 overflow-hidden`}>
        <div className="border-b-2 border-border bg-code px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-ink">
          {c.worstCaseLabel}
        </div>
        <div className="grid divide-y-2 divide-border sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
          <div className="flex items-start gap-2.5 px-4 py-3.5">
            <FiX className="mt-0.5 h-4 w-4 shrink-0 text-[#f85149]/70" aria-hidden="true" />
            <p className="text-sm text-muted">
              <Rich>{c.worstCaseTheirs}</Rich>
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-accent/[0.07] px-4 py-3.5">
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
