"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";
import { panelStatic } from "../styles";
import { ShotCardQuestions } from "../shots/ShotCardQuestions";
import { ShotCardReady } from "../shots/ShotCardReady";
import { ShotDecisions } from "../shots/ShotDecisions";
import { ShotSessions } from "../shots/ShotSessions";
import type { HomeCopy } from "@/i18n/types";

// Keep work moving — the four steps as a scrollytelling column: the title, the
// lead and the who-does-what panel start level with the first card, ride up with
// the page until they sit in the middle of the screen, then hold there while the
// steps scroll past.
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

// One artwork per step, used as the mat the shot is mounted on. Only the mat is
// a panel — the title and body sit bare on the page above it, so there's no card
// edge boxing a light mat in and no text over the artwork. Each step gets its
// own texture so the four read as a set without repeating.
//
// `art` is a drawing from components/shots/, not a capture: this column is
// ~464px wide, and a real 840px screenshot of the card page lands here at
// ~0.55×, which puts its body text at 8px. The drawings size their type as a
// share of their container, so they stay legible at whatever width the mat has —
// see the header comment in components/shots/nb.tsx. The first three draw a
// board screen; step 04's memory files have no UI, so that one draws the file.
// Ordered so the blooms swap diagonals card to card and the strongest lands last.
const CDN = "https://cdn.ai4kanban.dev";
const SHOTS: { mat: string; art: ReactNode }[] = [
  { mat: `${CDN}/bloom-1.jpg`, art: <ShotCardReady /> },
  { mat: `${CDN}/bloom-2.jpg`, art: <ShotCardQuestions /> },
  { mat: `${CDN}/bloom-3.jpg`, art: <ShotSessions /> },
  { mat: `${CDN}/bloom-4.jpg`, art: <ShotDecisions /> },
];

// Backs the mat so a failed image load leaves a pale blue field rather than a
// dark hole. Keyed to the site's one accent, `--color-accent` #58a6ff, lightened
// until text and a screenshot both sit on it comfortably.
const MAT = "#dfe9f7";

// The shot sits on the mat the way a print sits on a mount: a soft shadow, so
// it reads as laid on top rather than cut out of it. The shadow is the page's
// own near-black at low alpha — `border-border` is built to be seen against
// #0d1117 and disappears on a light mat. No edge line: the drawings carry their
// own ink-framed panels, and a second outline around those read as a frame in a
// frame.
const printFrame =
  "rounded-md shadow-[0_6px_18px_-6px_rgba(13,17,23,0.5)]";

export function Loop({ c }: { c: HomeCopy["loop"] }) {
  const { ref, top } = useCenteredStickyTop();
  return (
    <section id="loop" className="mt-28 scroll-mt-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-14">
        {/* `top` is ignored below lg, where the column isn't sticky at all. */}
        <div ref={ref} style={{ top }} className="lg:sticky lg:self-start">
          <SectionTitle num="02" title={c.title} />
          <p className="text-[1.05rem] leading-relaxed text-muted">{c.lead}</p>

          {/* Who does what — the point of the section, so it sits with the title. */}
          <div className={`${panelStatic} mt-8 divide-y-2 divide-border bg-code`}>
            <div className="px-5 py-4">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                {c.split.agentLabel}
              </span>
              <p className="mt-2 text-[0.95rem] text-ink">{c.split.agentBody}</p>
            </div>
            <div className="px-5 py-4">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-growth">
                {c.split.youLabel}
              </span>
              <p className="mt-2 text-[0.95rem] text-ink">{c.split.youBody}</p>
            </div>
          </div>
        </div>

        {/* The rail: a hairline behind the numbers ties the four steps together. */}
        <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-[1.6rem] before:top-6 before:w-px before:bg-border before:content-['']">
          {c.steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-5">
              <span className="z-10 flex h-13 w-13 shrink-0 items-center justify-center rounded-full border-2 border-border bg-code font-mono text-sm font-bold text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="pb-4 pt-2.5">
                  <h3 className="text-lg font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
                <div
                  className={`${panelStatic} overflow-hidden bg-cover bg-center p-6`}
                  style={{
                    backgroundColor: MAT,
                    backgroundImage: `url(${SHOTS[i].mat})`,
                  }}
                >
                  {/* The drawing is decoration, not content — the step's title
                      and body above it already say everything it shows, so it
                      carries no label of its own for a screen reader to read
                      out twice. */}
                  <div aria-hidden className={`overflow-hidden ${printFrame}`}>
                    {SHOTS[i].art}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
