import type { ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { ShotCardQuestions } from "../shots/ShotCardQuestions";
import { ShotSessions } from "../shots/ShotSessions";
import { ShotTaskGraph } from "../shots/ShotTaskGraph";
import type { WashName } from "./washes";
import type { HomeCopy } from "@/i18n/home/types";

// The product in three chronological steps — describe the outcome, settle the
// plan and the decisions it needs, then execute — as a zigzag: shot and words
// swap sides row after row.
//
// Three rows, not the five this section used to run. Two of the five were
// capabilities rather than steps, which is what turned a sequence into a
// product tour; the drawings for them are still captured on `/shots/` for the
// README.
//
// Words and shot split the row evenly, so the zigzag has one seam running down
// the middle of the section for every row to alternate across. An uneven split
// gave the picture more room, but it also moved the seam every row and left the
// words in a column too narrow for the sentence they carry. There is no rail
// and no sticky title: the alternation is what ties the rows together.

// One artwork per step, used as the mat the shot is mounted on. Nothing here is
// a panel: the title and body sit bare on the page beside the mat, and the mat
// carries no outline and no hard shadow either. It is a picture, and an ink
// frame around a watercolour is a frame around a frame. What holds the mat
// together instead is its own bleed to the edge, and the soft shadow the print
// casts onto it. Each step gets its own texture so the shots read as a set
// without repeating.
const SHOTS: { mat: WashName; art: ReactNode }[] = [
  { mat: "mintSky", art: <ShotTaskGraph /> },
  { mat: "peachEmber", art: <ShotCardQuestions /> },
  { mat: "skyLilac", art: <ShotSessions /> },
];

// The two sides of the zigzag. Explicit column starts rather than `order`, so
// the words stay ahead of the picture in the DOM on every row — that is the
// reading order, and below `lg` it is the stacking order too. The words hug the
// seam on both sides: ragged edge out, flush edge against the picture.
const SHOT_RIGHT = {
  words: "lg:col-start-1",
  shot: "lg:col-start-2",
};
const SHOT_LEFT = {
  words: "lg:col-start-2 lg:text-right",
  shot: "lg:col-start-1",
};

export function Steps({ c }: { c: HomeCopy["steps"] }) {
  return (
    <section id="loop" className="mt-28 scroll-mt-24">
      <SectionTitle num="01" title={c.title} />

      {/* Each step arrives whole — words and shot together — because a step is
          one thing, and they come up in the order they happen. The step numbers
          are on the hero's sequence; here the reading order carries it. */}
      <ol className="mt-10 space-y-14 lg:mt-14 lg:space-y-20">
        {c.items.map((step, i) => {
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
