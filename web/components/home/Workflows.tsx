import { FiArrowRight, FiPlay } from "react-icons/fi";
import { Button } from "../ui/Button";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import type { WashName } from "./washes";
import type { HomeCopy } from "@/i18n/home/types";
import { localePath, type Locale } from "@/lib/i18n";
import { workflowPath } from "@/lib/workflows";

// One card per workflow: its draft, drawn by the board's own components on /demo/drafts/<kind>
// and framed here, with the workflow's name under it. Two columns from `sm`. On a phone the
// section pins under the header and the scroll slides the row left, one card at a time with the
// next one's edge showing; after the sixth the page scrolls on. Without scroll-driven animations,
// or with reduced motion, the cards stack.
const PREVIEWS = ["coding", "blog", "video", "slides", "carousel", "clone"] as const;
const WASHES: WashName[] = ["peachEmber", "skyLilac", "emberMint", "mintSky", "emberLilac", "emberPeach"];

const PIN_CSS = `
.wf-bar{display:none}
@keyframes wf-slide{to{transform:translateX(calc(-100% + 100vw - 3rem))}}
@keyframes wf-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@supports (animation-timeline: view()){@media (max-width:639px) and (prefers-reduced-motion:no-preference){
.wf-pin{height:300svh;view-timeline:--wf block}
.wf-stick{position:sticky;top:4rem;height:calc(100svh - 4rem);margin-inline:-1.5rem;padding-inline:1.5rem;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
.wf-track{flex-direction:row;gap:1rem;width:max-content;animation:wf-slide linear both;animation-timeline:--wf;animation-range:contain 8% contain 92%}
.wf-track>li{width:86vw}
.wf-bar{display:block}
.wf-bar>span{animation:wf-fill linear both;animation-timeline:--wf;animation-range:contain 8% contain 92%}
}}`;

export function Workflows({ c, locale }: { c: HomeCopy["workflows"]; locale: Locale }) {
  return (
    <section id="workflows" className="mt-28 scroll-mt-24">
      <style>{PIN_CSS}</style>
      <div className="wf-pin">
        <div className="wf-stick">
          <SectionTitle title={c.title} />
          <p data-reveal data-delay="1" className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
            {c.lead}
          </p>
          <ul className="wf-track mt-8 flex flex-col gap-10 sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:gap-x-10 lg:gap-y-14">
            {c.items.map((w, i) => (
              <li key={PREVIEWS[i]} data-reveal className="shrink-0">
                <Mat wash={WASHES[i]!} className="p-3 sm:p-5">
                  <div role="img" aria-label={w.image} className={printFrame}>
                    <iframe
                      src={`/demo/drafts/${PREVIEWS[i]}`}
                      title={w.image}
                      loading="lazy"
                      tabIndex={-1}
                      aria-hidden
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
        </div>
      </div>

      <div className="mt-8 flex flex-col items-start gap-4 sm:mt-12 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
        <Button href="/demo" variant="secondary">
          <FiPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
          {c.links.demo}
        </Button>
        {[
          { href: localePath(locale, workflowPath("coding")), label: c.links.coding },
          { href: "/docs/agents", label: c.links.all },
        ].map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-accent-deep hover:underline"
          >
            {l.label}
            <FiArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
