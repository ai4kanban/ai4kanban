import { Button } from "./Button";
import { GITHUB_URL } from "../content";
import { HeroShots } from "./HeroShots";
import type { HomeCopy } from "@/i18n/types";

export function Hero({ c }: { c: HomeCopy["hero"] }) {
  return (
    <section className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
      <div>
        {/* `text-balance` keeps the break off the middle of a word — Chinese and
            Japanese wrap anywhere, so an unbalanced line splits 规|划 down the
            middle. */}
        <h1 className="text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]">
          {c.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">{c.lead}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button href="#install" variant="primary">
            {c.ctaInstall}
          </Button>
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      <HeroShots c={c.shots} />
    </section>
  );
}
