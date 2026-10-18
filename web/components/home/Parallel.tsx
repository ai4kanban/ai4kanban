import { SectionTitle } from "./SectionTitle";
import { HeroShots } from "./HeroShots";
import { Mat, printFrame } from "./Mat";
import { ShotTaskGraph } from "../shots/ShotTaskGraph";
import { ShotSessions } from "../shots/ShotSessions";
import type { HomeCopy } from "@/i18n/home/types";

// The Board / Card deck, then the task graph and the running sessions side by side. A
// phone keeps only the sessions: the deck and the graph are unreadable at that width.
export function Parallel({ c }: { c: HomeCopy["parallel"] }) {
  return (
    <section className="mt-16">
      <SectionTitle title={c.title} />
      {c.body.map((p) => (
        <p key={p} data-reveal data-delay="1" className="mt-4 max-w-3xl text-[1.05rem] leading-relaxed text-muted">
          {p}
        </p>
      ))}
      <Mat wash="mintSky" data-reveal className="mt-12 hidden p-4 sm:block sm:p-8 lg:p-10">
        <HeroShots c={c.shots} />
      </Mat>
      <div className="mt-10 grid gap-6 sm:mt-6 lg:grid-cols-2">
        <Mat wash="skyLilac" data-reveal className="hidden p-3 sm:block sm:p-6">
          <div aria-hidden className={printFrame}>
            <ShotTaskGraph />
          </div>
        </Mat>
        <Mat wash="emberMint" data-reveal data-delay="1" className="p-3 sm:p-6">
          <div aria-hidden className={printFrame}>
            <ShotSessions />
          </div>
        </Mat>
      </div>
    </section>
  );
}
