import { FiArrowRight, FiPlay } from "react-icons/fi";
import { Button } from "../ui/Button";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { DraftFrame } from "./DraftFrame";
import type { WashName } from "./washes";
import type { HomeCopy } from "@/i18n/home/types";

// One card per workflow: its draft, drawn by the board's own components on /demo/drafts/<kind>
// and framed here, with the workflow's name under it. The title and lede scroll past; then the
// cards, progress bar and links pin under the header and the scroll slides the row left, the
// next card's edge showing and the row bleeding to the screen edges. A phone shows one card that
// shrinks to fit the screen; wider screens about one and a half. After the sixth the page
// scrolls on. Without scroll-driven animations, or with reduced motion, the cards stack in one
// column on a phone and two from `sm`.
const PREVIEWS = ["coding", "blog", "video", "slides", "carousel", "clone"] as const;
const WASHES: WashName[] = ["peachEmber", "skyLilac", "emberMint", "mintSky", "emberLilac", "emberPeach"];

const PIN_CSS = `
.wf-bar{display:none}
@keyframes wf-slide{to{transform:translateX(calc(-100% + min(100vw,72rem) - 3rem))}}
@keyframes wf-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@supports (animation-timeline: view()){@media (prefers-reduced-motion:no-preference){
body{overflow-x:clip}
.wf-pin{height:300svh;view-timeline:--wf block}
.wf-stick{position:sticky;top:4rem;height:calc(100svh - 4rem);margin-inline:calc(50% - 50vw);padding:1rem calc(50vw - 50%) 2.5rem;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
.wf-stick>*{flex-shrink:0}
.wf-track{display:flex;flex-shrink:1;min-height:0;margin-top:0;flex-direction:row;gap:1rem;width:max-content;animation:wf-slide linear both;animation-timeline:--wf;animation-range:contain 8% contain 92%}
.wf-track>li{width:86vw;display:flex;flex-direction:column}
.wf-track h3{margin-top:.75rem}
.wf-bar{display:block;margin-top:1rem}
.wf-bar>span{animation:wf-fill linear both;animation-timeline:--wf;animation-range:contain 8% contain 92%}
.wf-links{flex-direction:row;flex-wrap:wrap;align-items:center;gap:.75rem 1.25rem;margin-top:1rem}
@media (max-width:639px){
.wf-mat{flex:1;min-height:0}
.wf-mat>div:last-child,.wf-mat [role=img],.wf-mat iframe{height:100%}
}
@media (min-width:640px){
.wf-pin{height:240svh}
.wf-track{gap:2.5rem}
.wf-track>li{width:min(40rem,58vw,(100svh - 19rem)*1.6)}
.wf-bar{margin-top:1.5rem}
.wf-links{margin-top:1.5rem;gap:.75rem 1.5rem}
}
}}`;

export function Workflows({ c }: { c: HomeCopy["workflows"] }) {
  return (
    <section id="workflows" className="mt-28 scroll-mt-24">
      <style>{PIN_CSS}</style>
      <SectionTitle title={c.title} />
      <p data-reveal data-delay="1" className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>
      <div className="wf-pin">
        <div className="wf-stick">
          <ul className="wf-track mt-8 flex flex-col gap-10 sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:gap-x-10 lg:gap-y-14">
            {c.items.map((w, i) => (
              <li key={PREVIEWS[i]} data-reveal className="shrink-0">
                <Mat wash={WASHES[i]!} className="wf-mat p-3 sm:p-5">
                  <div role="img" aria-label={w.image} className={printFrame}>
                    <DraftFrame
                      src={`/demo/drafts/${PREVIEWS[i]}`}
                      title={w.image}
                      className="pointer-events-none block aspect-[5/7] w-full bg-[#fbfaf7] sm:aspect-[16/10]"
                    />
                  </div>
                </Mat>
                <h3 className="mt-4 text-[1.05rem] font-semibold text-ink">{w.label}</h3>
              </li>
            ))}
          </ul>
          <div className="wf-bar mt-6 h-0.5 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full origin-left bg-accent-deep" />
          </div>
          <div className="wf-links mt-8 flex flex-col items-start gap-4 sm:mt-12 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <Button href="/demo" variant="secondary">
              <FiPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
              {c.links.demo}
            </Button>
            <a
              href="/docs/agents"
              className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-accent-deep hover:underline"
            >
              {c.links.all}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
