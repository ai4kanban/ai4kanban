import { SectionTitle } from "./SectionTitle";
import { DraftKind } from "./DraftKind";
import { Mat, printFrame } from "./Mat";
import { DraftCopy, DraftIll, DraftScript, DraftUi, type Lang } from "./DraftCards";
import { framed, panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

const DRAFTS = [DraftUi, DraftCopy, DraftScript, DraftIll];
const ROW = 6.5; // rem: one row's height plus the gap, so the highlight lands on each row.
const TOP = "5rem"; // where the stage pins, clear of the header.
const RUN = "150vh"; // scroll spent while pinned.
const SLOT = 28; // rem: one picture's window; the strip of pictures slides by it.

// The stage's view timeline counts from its top meeting the viewport's bottom, so the pinned
// stretch starts once its top reaches TOP and lasts RUN.
const RANGE = `cover calc(100vh - ${TOP}) cover calc(100vh + ${RUN} - ${TOP})`;
const last = DRAFTS.length - 1;
// Each kind holds around its own stop; the highlight and the strip glide between stops.
const hold = (i: number) => [Math.max(0, (i * 100) / last - 9), Math.min(100, (i * 100) / last + 9)];
const glide = (name: string, step: number) =>
  `@keyframes ${name}{${DRAFTS.map((_, i) => hold(i).map((p) => `${p}%{transform:translateY(${i * step}rem)}`).join("")).join("")}}` +
  `#drafts [data-${name}]{animation:${name} linear both;animation-timeline:--drafts;animation-range:${RANGE}}`;

// The pinned stage needs scroll-driven animations; without them every width gets the stacked
// layout, where each kind is followed by its picture.
const STAGE_CSS =
  `#drafts-stage{display:none}` +
  `@supports (animation-timeline: view()){@media (min-width:64rem){` +
  `#drafts-stack{display:none}#drafts-stage{display:block;view-timeline:--drafts}` +
  glide("glide", ROW) +
  glide("strip", -SLOT) +
  `}}`;

function Picture({ i, locale }: { i: number; locale: Lang }) {
  const Draft = DRAFTS[i];
  return (
    <Mat wash="peachEmber" className="p-3 sm:p-6">
      <div aria-hidden className={printFrame}>
        <Draft locale={locale} />
      </div>
    </Mat>
  );
}

// On a wide screen the title, the list and the picture pin while the page scrolls; the
// scroll only glides the highlight down the list and the pictures along with it.
export function Drafts({ c, locale }: { c: HomeCopy["drafts"]; locale: Lang }) {
  const intro = (
    <>
      <SectionTitle title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">{c.lead}</p>
    </>
  );
  return (
    <section id="drafts" className="mt-28 scroll-mt-24">
      <style>{STAGE_CSS}</style>

      <div id="drafts-stack">
        {intro}
        <div className="mt-10 space-y-12">
          {c.kinds.map((k, i) => (
            <div key={k.label} data-reveal>
              <h3 className="text-lg font-semibold text-ink">{k.label}</h3>
              <p className="mb-4 mt-1 text-[0.95rem] leading-relaxed text-muted">{k.body}</p>
              <Picture i={i} locale={locale} />
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-3xl text-sm leading-relaxed text-muted">{c.closing}</p>
      </div>

      <div id="drafts-stage">
        <div className="sticky" style={{ top: TOP }}>
          {intro}
          <div className="mt-8 grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-10">
            <div>
              <ul className="relative">
                <li
                  data-glide
                  className={`absolute inset-x-0 top-0 ${panelStatic} ${framed}`}
                  style={{ height: `${ROW - 0.5}rem` }}
                />
                {c.kinds.map((k, i) => (
                  <DraftKind key={k.label} stop={i / last} style={{ height: `${ROW - 0.5}rem`, marginBottom: "0.5rem" }}>
                    <span className="text-lg font-semibold text-ink">{k.label}</span>
                    <span className="mt-1 text-[0.95rem] leading-relaxed text-muted">{k.body}</span>
                  </DraftKind>
                ))}
              </ul>
              <p className="mt-6 px-5 text-sm leading-relaxed text-muted">{c.closing}</p>
            </div>
            <div
              className="overflow-hidden"
              style={{
                height: `${SLOT}rem`,
                maskImage: "linear-gradient(transparent, #000 6%, #000 94%, transparent)",
              }}
            >
              <div data-strip>
                {DRAFTS.map((_, i) => (
                  <div key={i} className="flex flex-col justify-center" style={{ height: `${SLOT}rem` }}>
                    <Picture i={i} locale={locale} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ height: RUN }} />
      </div>
    </section>
  );
}
