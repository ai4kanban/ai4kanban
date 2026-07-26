import type { ReactNode } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";

// The autonomy spectrum: three stops from "you plan everything" (a traditional
// board) to "agent plans everything" (Hermes's "drop a one-liner, walk away").
// The autonomy amounts (no / semi / full) are tick labels on the track itself;
// each card leads with the product — logo + name — over one sentence, with the
// coined term for the approach as its eyebrow.

const STOPS: {
  left: string;
  level: string;
  term: string;
  tag: ReactNode;
  heading: string;
  detail: ReactNode;
  ours?: boolean;
}[] = [
  {
    left: "16.67%",
    level: "No autonomy",
    term: "Human-driven",
    tag: "📋",
    heading: "Traditional kanban",
    detail:
      "You think of every task and break it down — Trello or Jira just records it.",
  },
  {
    left: "50%",
    level: "Semi autonomy",
    term: "Agent-assisted",
    tag: "🗂️",
    heading: "AI4Kanban",
    detail: (
      <>
        Each <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">refine</code>{" "}
        digs into the missing pieces and fills in requirements. You review
        before anything is built.
      </>
    ),
    ours: true,
  },
  {
    left: "83.33%",
    level: "Full autonomy",
    term: "Fire-and-forget",
    tag: <HermesMark className="h-5 w-5" />,
    heading: "Hermes Kanban",
    detail: (
      <>
        One line in, a task tree out — decomposed and worked unattended until
        done. Claude Code&apos;s{" "}
        <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">/goal</code>{" "}
        makes the same bet.
      </>
    ),
  },
];

// Eyebrow (the coined term) → logo + product name → one sentence.
function StopCard({ term, tag, heading, detail, ours }: (typeof STOPS)[number]) {
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
        {term}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {tag}
        </span>
        <h3 className="text-lg font-semibold text-ink">{heading}</h3>
      </div>
      <p className="mt-2.5 text-sm text-muted">{detail}</p>
    </div>
  );
}

export function HkAutonomy() {
  return (
    <section className="mt-24">
      <SectionHeading num="05" eyebrow="Autonomy level" title="How much autonomy does the agent get?" />
      <p className="text-ink">
        Hermes Kanban promises{" "}
        <span className="font-semibold">&ldquo;drop a one-liner, walk away&rdquo;</span>{" "}
        — full autonomy. ai4kanban is{" "}
        <span className="font-semibold">agent-assisted</span>, and it starts
        earlier than plan mode: you save a half-formed idea to the board,{" "}
        <code className="rounded bg-code px-1 py-0.5 text-[0.9em]">refine</code>{" "}
        turns it into concrete requirements, and you approve before any code is
        written.
      </p>

      {/* Desktop: a slider-style gradient bar — dim on the left, full accent on
          the right, so the color itself encodes rising autonomy. Each stop is a
          bg-ringed knob with its autonomy amount as a tick label below. */}
      <div className="mt-8 hidden sm:block">
        <div className="mb-2 flex items-center justify-between font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <span>You plan everything</span>
          <span className="text-accent">Agent plans, you approve</span>
          <span>Agent plans everything</span>
        </div>
        <div className="relative mb-14 h-2.5">
          <div className="absolute inset-0 rounded-full border border-border bg-gradient-to-r from-elev via-accent/30 to-accent/90" />
          {STOPS.map((s) => (
            <span key={s.left} aria-hidden="true">
              <span
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg ${
                  s.ours
                    ? "h-4 w-4 bg-accent ring-2 ring-accent"
                    : "h-4 w-4 bg-muted"
                }`}
                style={{ left: s.left }}
              />
              <span
                className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent" : "text-muted"
                }`}
                style={{ left: s.left }}
              >
                {s.level}
              </span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {STOPS.map((s) => (
            <StopCard key={s.heading} {...s} />
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
          You plan everything ↓
        </p>
        <div className="mt-3 space-y-4">
          {STOPS.map((s) => (
            <div key={s.heading}>
              <p
                className={`mb-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${
                  s.ours ? "text-accent" : "text-muted"
                }`}
              >
                {s.level}
              </p>
              <StopCard {...s} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-right font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
          ↑ Agent plans everything
        </p>
      </div>

      {/* The whole argument for the middle, as one glanceable contrast. */}
      <div className={`${panelStatic} mt-6 overflow-hidden`}>
        <div className="border-b-2 border-border bg-code px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-ink">
          Worst case, per level
        </div>
        <div className="grid divide-y-2 divide-border sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
          <div className="flex items-start gap-2.5 px-4 py-3.5">
            <FiX className="mt-0.5 h-4 w-4 shrink-0 text-[#f85149]/70" aria-hidden="true" />
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Fire-and-forget:</span>{" "}
              a small early misunderstanding grows into a whole tree of wrong
              tasks — built, tokens spent.
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-accent/[0.07] px-4 py-3.5">
            <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Agent-assisted:</span>{" "}
              a wrong Markdown card — caught when you review it, before
              anything is built.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-muted">
        One refine fills in missing steps, splits side ideas into their own
        cards, ticks off todos that already landed, and leaves the taste calls
        to you as questions. When none are left, the card flips to{" "}
        <span className="font-medium text-ink">ready</span> — read it, then
        build it.
      </p>
    </section>
  );
}
