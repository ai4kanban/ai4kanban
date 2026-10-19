import { SectionTitle } from "./SectionTitle";
import { BridgeScene } from "./BridgeScene";
import type { HomeCopy } from "@/i18n/home/types";

// How it works: words on the left, the bridge scene on the right; on a phone the scene follows
// the words.
export function Handoff({ c }: { c: HomeCopy["handoff"] }) {
  return (
    <section className="mt-28 grid items-center gap-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
      <div>
        <SectionTitle title={c.title} />
        {c.body.map((p) => (
          <p key={p} data-reveal data-delay="1" className="mt-4 text-[1.05rem] leading-[1.75] text-muted">
            {p}
          </p>
        ))}
      </div>
      <div data-reveal>
        <BridgeScene c={c.scene} />
      </div>
    </section>
  );
}
