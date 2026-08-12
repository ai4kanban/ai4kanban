"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { ShotCardQuestions } from "../shots/ShotCardQuestions";
import { ShotCardReady } from "../shots/ShotCardReady";
import { ShotDecisions } from "../shots/ShotDecisions";
import { ShotSessions } from "../shots/ShotSessions";
import { CDN } from "@/lib/site";
import type { HomeCopy } from "@/i18n/home/types";

// Keep work moving — the four steps as a scrollytelling column: the title and
// the lead start level with the first card, ride up with the page until they sit
// in the middle of the screen, then hold there while the steps scroll past.
//
// That resting point is `(viewport - column height) / 2`, which CSS can't work
// out on its own, so the column measures itself and feeds the number to
// `position: sticky` as `top`. No scroll listener — the browser still does the
// pinning; the measurement only reruns when the column or the window resizes.

// Never pin higher than this, so a column taller than the viewport still clears
// the fixed header instead of hiding its title behind it.
const MIN_TOP = 112;

function useCenteredStickyTop() {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(MIN_TOP);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setTop(Math.max(MIN_TOP, (window.innerHeight - el.offsetHeight) / 2));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, top };
}

// One artwork per step, used as the mat the shot is mounted on. Nothing here is
// a panel: the title and body sit bare on the page above the mat, and the mat
// carries no outline and no hard shadow either. It is a picture, and an ink
// frame around a watercolour is a frame around a frame — four of them down the
// column turned a scroll through the steps into a scroll past four boxes. What
// holds the mat together instead is its own bleed to the edge, and the soft
// shadow the print casts onto it. Each step gets its own texture so the four
// read as a set without repeating.
//
// `art` is a drawing from components/shots/, not a capture: this column is
// ~464px wide, and a real 840px screenshot of the card page lands here at
// ~0.55×, which puts its body text at 8px. The drawings size their type as a
// share of their container, so they stay legible at whatever width the mat has —
// see the header comment in components/shots/nb.tsx. The first three draw a
// board screen; step 04's memory files have no UI, so that one draws the file.
// Ordered so the blooms swap diagonals card to card and the strongest lands last.
const SHOTS: { mat: string; art: ReactNode }[] = [
  { mat: `${CDN}/bloom-1.jpg`, art: <ShotCardReady /> },
  { mat: `${CDN}/bloom-2.jpg`, art: <ShotCardQuestions /> },
  { mat: `${CDN}/bloom-3.jpg`, art: <ShotSessions /> },
  { mat: `${CDN}/bloom-4.jpg`, art: <ShotDecisions /> },
];

export function Loop({ c }: { c: HomeCopy["loop"] }) {
  const { ref, top } = useCenteredStickyTop();
  return (
    <section id="loop" className="mt-28 scroll-mt-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-14">
        {/* `top` is ignored below lg, where the column isn't sticky at all. */}
        <div ref={ref} style={{ top }} className="lg:sticky lg:self-start">
          <SectionTitle num="02" title={c.title} />
          <p
            data-reveal
            data-delay="1"
            className="text-[1.05rem] leading-relaxed text-muted"
          >
            {c.lead}
          </p>
        </div>

        {/* The rail: one hairline behind the numbers ties the four steps
            together. Full-strength ink, like every other line the site draws —
            it is a rule, not a block's border, so the framed/bare rule in
            §3 of design.md has nothing to say about it, and there is no
            half-strength ink anywhere in the theme to reach for instead. At 1px
            it is delicate enough without being diluted. */}
        <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-[1.6rem] before:top-6 before:w-px before:bg-border before:content-['']">
          {/* The number and the step's words are indented off the rail; the mat
              is only indented from `sm` up. On a phone that indent plus the
              mat's own padding spent a third of the viewport on white space, and
              the drawing inside — which sizes its type to its container — shrank
              with it. Below `sm` the mat runs the full column instead, and the
              rail still reads because the numbers above it are on it. */}
          {/* The one section where the reveal is the section: the title holds
              in the middle of the screen and the steps come up past it one at
              a time, which is the order the loop runs in. Each step arrives
              whole — number, words and shot together — because a step is one
              thing. */}
          {c.steps.map((step, i) => (
            <li key={step.title} data-reveal className="relative">
              <div className="flex gap-4 sm:gap-5">
                {/* Borderless, like everything else in the section. The disc
                    is only there to break the rail behind the number — it is
                    opaque, so it does that at any strength — and the number
                    itself is the marker: mono, bold, and the one blue in the
                    column. Ringed in ink it was the last neo-brutalist block
                    left here, four hard circles down a page of soft edges. */}
                <span className="z-10 flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-code font-mono text-sm font-bold text-accent-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 pb-4 pt-2.5">
                  <h3 className="text-lg font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </div>
              <Mat src={SHOTS[i].mat} className="p-3 sm:ml-[4.5rem] sm:p-6">
                {/* The drawing is decoration, not content — the step's title
                    and body above it already say everything it shows, so it
                    carries no label of its own for a screen reader to read
                    out twice. */}
                <div aria-hidden className={printFrame}>
                  {SHOTS[i].art}
                </div>
              </Mat>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
