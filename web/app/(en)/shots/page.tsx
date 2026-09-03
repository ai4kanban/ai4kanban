import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mat, printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import { ShotApprovalEvent } from "@/components/shots/ShotApprovalEvent";
import { ShotCardQuestions } from "@/components/shots/ShotCardQuestions";
import { ShotSessions } from "@/components/shots/ShotSessions";
import { ShotSpecAgents } from "@/components/shots/ShotSpecAgents";
import { ShotTaskGraph } from "@/components/shots/ShotTaskGraph";

// A render-only page: the five loop drawings, each on its own mat at a fixed
// size, one per `data-shot` box. `scripts/capture-shots.mjs` loads this page and
// clips one screenshot per box for the README and social posts. The landing
// page shows the first three of them (components/home/Steps.tsx) at the same
// mats; the other two are README-only. Kept out of search: it's an asset
// source, not content.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The capture geometry, in CSS px. The mat is `WIDTH - 2 * PAD` wide and every
// shot crops to 3∶2, so all five come out the same size and tile evenly in a
// README grid. Captured at 2x, so these are half the pixel dimensions.
const WIDTH = 1160;
const PAD = 40;

const SHOTS: { slug: string; mat: WashName; art: ReactNode }[] = [
  { slug: "task-graph", mat: "mintSky", art: <ShotTaskGraph /> },
  { slug: "clarify", mat: "peachEmber", art: <ShotCardQuestions /> },
  { slug: "execute", mat: "skyLilac", art: <ShotSessions /> },
  { slug: "spec-agents", mat: "emberMint", art: <ShotSpecAgents /> },
  { slug: "approval", mat: "peachEmber", art: <ShotApprovalEvent /> },
];

export default function Shots() {
  return (
    <div className="bg-bg">
      {SHOTS.map((shot) => (
        <div
          key={shot.slug}
          data-shot={shot.slug}
          style={{ width: WIDTH, padding: PAD, background: "var(--color-bg)" }}
        >
          <Mat wash={shot.mat} className="p-6">
            <div aria-hidden className={printFrame}>
              {shot.art}
            </div>
          </Mat>
        </div>
      ))}
    </div>
  );
}
