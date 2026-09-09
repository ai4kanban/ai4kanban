import type { ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { ShotCardQuestions } from "../shots/ShotCardQuestions";
import { ShotApprovalEvent } from "../shots/ShotApprovalEvent";
import { ShotSessions } from "../shots/ShotSessions";
import { ShotSpecAgents } from "../shots/ShotSpecAgents";
import { ShotTaskGraph } from "../shots/ShotTaskGraph";
import { ShotAgentTeam } from "../shots/ShotAgentTeam";
import type { WashName } from "./washes";
import type { HomeCopy } from "@/i18n/home/types";

// Alternate the copy and illustration, with a distinct wash for each step.
const SHOTS: { mat: WashName; art: ReactNode }[] = [
  { mat: "mintSky", art: <ShotTaskGraph /> },
  { mat: "peachEmber", art: <ShotCardQuestions /> },
  { mat: "skyLilac", art: <ShotSessions /> },
  { mat: "emberMint", art: <ShotSpecAgents /> },
  { mat: "peachEmber", art: <ShotApprovalEvent /> },
  { mat: "mintSky", art: <ShotAgentTeam /> },
];

// The two sides of the zigzag. Explicit column starts rather than `order`, so
// the words stay ahead of the picture in the DOM on every row — that is the
// reading order, and below `lg` it is the stacking order too. The words hug the
// seam on both sides: ragged edge out, flush edge against the picture.
//
// The mat stays inside the column at every width. It used to break out 8rem on
// its outer side because half of `max-w-5xl` left the drawing too small to read;
// the page column is `max-w-6xl` now, so the width comes from the column itself
// and the section has no exception in it.
const SHOT_RIGHT = {
  words: "lg:col-start-1",
  shot: "lg:col-start-2",
};
const SHOT_LEFT = {
  words: "lg:col-start-2 lg:text-right",
  shot: "lg:col-start-1",
};

export function Loop({ c }: { c: HomeCopy["loop"] }) {
  return (
    <section id="loop" className="mt-28 scroll-mt-24">
      <SectionTitle num="01" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      {/* Each step arrives whole — words and shot together — because a step is
          one thing, and the steps come up in the order the loop runs. They
          carry no step number: the reading order already makes the sequence
          clear. */}
      <ol className="mt-12 space-y-14 lg:mt-16 lg:space-y-20">
        {c.steps.map((step, i) => {
          const side = i % 2 === 0 ? SHOT_LEFT : SHOT_RIGHT;
          return (
            <li
              key={step.title}
              data-reveal
              className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10"
            >
              <div className={`${side.words} lg:row-start-1`}>
                {/* The step title carries the row: half a row of white space
                    beside a full-height picture needs a real heading, not one
                    a notch above its own body text. */}
                <h3 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
                  {step.title}
                </h3>
                <p className="mt-4 text-[1.05rem] leading-[1.75] text-muted sm:text-[1.1rem]">
                  {step.body}
                </p>
              </div>

              <Mat
                wash={SHOTS[i].mat}
                className={`${side.shot} p-3 sm:p-6 lg:row-start-1`}
              >
                {/* The drawing is decoration, not content — the step's title
                    and body beside it already say everything it shows, so it
                    carries no label of its own for a screen reader to read
                    out twice. */}
                <div aria-hidden className={printFrame}>
                  {SHOTS[i].art}
                </div>
              </Mat>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
