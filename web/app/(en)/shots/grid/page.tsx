import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mat, printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import { ShotAgentTeam } from "@/components/shots/ShotAgentTeam";
import { ShotApprovalEvent } from "@/components/shots/ShotApprovalEvent";
import { ShotCardQuestions } from "@/components/shots/ShotCardQuestions";
import { ShotSessions } from "@/components/shots/ShotSessions";
import { ShotSpecAgents } from "@/components/shots/ShotSpecAgents";
import { ShotTaskGraph } from "@/components/shots/ShotTaskGraph";
import en from "@/i18n/home/en";

// The six loop drawings as one figure, 2 across — the README's "at a glance"
// image. `scripts/capture-shots.mjs <base> /shots/grid/` clips the single
// `data-shot` box. Same set and order as components/home/Loop.tsx; the titles
// are the steps' own, so the figure and the page never drift.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The capture geometry, in CSS px. A cell is half the width the Loop hands a
// shot, and the drawings are sized off their container, so they hold their
// proportions here without any scaling.
const PAD = 20;
const GAP = 16;
const CELL = 450;

const SHOTS: { mat: WashName; art: ReactNode }[] = [
  { mat: "mintSky", art: <ShotTaskGraph /> },
  { mat: "peachEmber", art: <ShotCardQuestions /> },
  { mat: "skyLilac", art: <ShotSessions /> },
  { mat: "emberMint", art: <ShotSpecAgents /> },
  { mat: "peachEmber", art: <ShotApprovalEvent /> },
  { mat: "mintSky", art: <ShotAgentTeam /> },
];

export default function ShotGrid() {
  return (
    <div
      data-shot="grid"
      style={{
        width: PAD * 2 + CELL * 2 + GAP,
        padding: PAD,
        background: "var(--color-bg)",
        display: "grid",
        gridTemplateColumns: `repeat(2, ${CELL}px)`,
        columnGap: GAP,
        rowGap: 36,
      }}
    >
      {SHOTS.map((shot, i) => (
        <div key={en.loop.steps[i].title}>
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 19,
              lineHeight: 1.25,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
            }}
          >
            {en.loop.steps[i].title}
          </h3>
          <Mat wash={shot.mat} className="p-3">
            <div aria-hidden className={printFrame}>
              {shot.art}
            </div>
          </Mat>
        </div>
      ))}
    </div>
  );
}
