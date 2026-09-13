import type { ReactNode } from "react";
import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { Band } from "../Band";
import { Rich } from "../Rich";
import { Mat, printFrame } from "../home/Mat";
import { Button } from "../ui/Button";
import { LogoMark } from "../ui/Logo";
import { PixelMark } from "../ui/PixelMark";
import { ComparisonIntro } from "../vs/ComparisonTable";
import { GITHUB_URL } from "../content";
import { heroTop } from "../styles";
import { TmMark } from "./TmMark";
import { KanbanHeroDiagram, TaskMasterHeroDiagram } from "./TmDiagrams";
import { compareRows, kanbanWinOrder, taskMasterWinOrder } from "./vs-task-master-content";
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";
import type { SharedCopy } from "@/i18n/shared/types";
import { localeHref, type Locale } from "@/lib/i18n";

const prose = "text-[1.05rem] leading-relaxed text-muted";
const eyebrow = "font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep";

export function TmHeading({ eyebrow: label, title }: { eyebrow: string; title: string }) {
  return <div className="mb-6 max-w-3xl">
    <p className={eyebrow}>{label}</p>
    <h2 className="mt-3 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h2>
  </div>;
}

function Brand({ ours, children }: { ours?: boolean; children: ReactNode }) {
  return <div className="flex items-center gap-3 font-semibold">
    <span aria-hidden="true">{ours ? <LogoMark size="xs" /> : <TmMark className="h-5 w-5" />}</span>{children}
  </div>;
}

export function TmHero({ c }: { c: VsTaskMasterCopy["hero"] }) {
  return <section className={heroTop}>
    <div className="mx-auto max-w-3xl text-center">
      <p className={eyebrow}>{c.badge}</p>
      <h1 className="mt-5 text-balance text-[2.75rem] font-bold leading-[1.1] tracking-tight sm:text-6xl"><Rich>{c.title}</Rich></h1>
      <p className={`mt-7 ${prose}`}><Rich>{c.lead}</Rich></p>
    </div>
    <Mat wash="emberLilac" className="mt-12 p-4 sm:mt-16 sm:p-8 lg:p-10">
      <div className={`${printFrame} grid bg-elev md:grid-cols-2`}>
        {[true, false].map((ours) => {
          const side = ours ? c.ours : c.theirs;
          return <div key={side.name} className="min-w-0 p-6 first:border-b first:border-ink/10 sm:p-8 md:first:border-b-0 md:first:border-r">
            <Brand ours={ours}>{side.name}</Brand>
            <div className="my-6">{ours ? <KanbanHeroDiagram c={c} /> : <TaskMasterHeroDiagram c={c} />}</div>
            <p className="text-sm leading-relaxed text-muted">{side.body}</p>
          </div>;
        })}
      </div>
    </Mat>
  </section>;
}

export function TmOverview({ c }: { c: VsTaskMasterCopy["summary"] }) {
  return <section className="mt-24 grid gap-8 lg:mt-32 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
    <TmHeading {...c.heading} />
    <div className={`space-y-6 ${prose}`}>
      <p><Rich>{c.lead}</Rich></p>
      <p className="border-l-2 border-accent pl-6 text-ink"><Rich>{c.panel}</Rich></p>
      <p className="text-sm leading-relaxed"><Rich>{c.note}</Rich></p>
    </div>
  </section>;
}

export function TmWorkflow({ c }: { c: VsTaskMasterCopy["start"] }) {
  return <section className="mt-24 lg:mt-32">
    <TmHeading {...c.heading} />
    <p className={`max-w-3xl ${prose}`}>{c.lead}</p>
    <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
      {[true, false].map((ours) => {
        const side = ours ? c.ours : c.theirs;
        return <div key={side.label} className="border-t border-ink/15 pt-6">
          <Brand ours={ours}>{side.label}</Brand>
          <h3 className="mt-6 text-2xl font-semibold tracking-tight">{side.title}</h3>
          <ol className="mt-6 space-y-6">
            {side.steps.map((step, i) => <li key={step} className="flex gap-4">
              <span aria-hidden="true" className="pt-1 font-mono text-xs text-accent-deep">0{i + 1}</span>
              <p className="min-w-0 break-words leading-relaxed text-muted"><Rich>{step}</Rich></p>
            </li>)}
          </ol>
        </div>;
      })}
    </div>
    <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted"><Rich>{c.note}</Rich></p>
  </section>;
}

export function TmComparison({ c }: { c: VsTaskMasterCopy["comparison"] }) {
  return <section className="mt-24 lg:mt-32">
    <TmHeading {...c.heading} />
    <div className="max-w-3xl leading-relaxed"><ComparisonIntro>{c.lead}</ComparisonIntro></div>
    <div className="mt-10">
      <div aria-hidden="true" className="hidden grid-cols-[1fr_2fr_2fr] gap-8 rounded-lg bg-band px-6 py-5 md:grid">
        <span /><Brand ours>{c.ourLabel}</Brand><Brand>{c.theirLabel}</Brand>
      </div>
      {compareRows.map(({ key, edge }) => {
        const row = c.rows[key];
        return <section key={key} className="grid gap-5 border-b border-ink/15 py-7 md:grid-cols-[1fr_2fr_2fr] md:gap-8 md:px-6">
          <h3 className="font-semibold leading-snug">{row.dimension}</h3>
          {(["kanban", "taskMaster"] as const).map((side) => <div key={side} className="min-w-0">
            <p className="mb-2 text-xs font-semibold text-muted md:sr-only">{side === "kanban" ? c.ourLabel : c.theirLabel}</p>
            <div className="flex items-start gap-3">
              <span className="mt-1 shrink-0">{edge === side ? <FiCheck className="h-4 w-4 text-growth" aria-label="✓" /> : edge === "neutral" ? <FiMinus className="h-4 w-4 text-muted" aria-label="—" /> : <FiX className="h-4 w-4 text-muted" aria-label="×" />}</span>
              <p className="min-w-0 break-words text-sm leading-relaxed text-muted"><Rich>{row[side]}</Rich></p>
            </div>
          </div>)}
        </section>;
      })}
    </div>
  </section>;
}

export function TmTradeoffs({ c }: { c: VsTaskMasterCopy["wins"] }) {
  const sides = [
    { ours: true, title: c.oursHeading, items: kanbanWinOrder.map((key) => c.ours[key]) },
    { ours: false, title: c.theirsHeading, items: taskMasterWinOrder.map((key) => c.theirs[key]) },
  ];
  return <section className="mt-24 lg:mt-32">
    <TmHeading {...c.heading} />
    <p className={`max-w-3xl ${prose}`}>{c.lead}</p>
    <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
      {sides.map((side) => <div key={side.title}>
        <Brand ours={side.ours}>{side.title}</Brand>
        <ul className="mt-6 space-y-7 border-t border-ink/15 pt-7">
          {side.items.map((item) => <li key={item.title}>
            <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-muted"><Rich>{item.body}</Rich></p>
          </li>)}
        </ul>
      </div>)}
    </div>
  </section>;
}

export function TmDecision({ c, shared, locale }: { c: VsTaskMasterCopy["decision"]; shared: SharedCopy; locale: Locale }) {
  return <Band flush><section>
    <PixelMark className="mb-6" />
    <TmHeading {...c.heading} />
    <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
      {[{ heading: c.oursHeading, items: c.ours }, { heading: c.theirsHeading, items: c.theirs }].map((side) => <div key={side.heading}>
        <h3 className="text-xl font-semibold tracking-tight">{side.heading}</h3>
        <ul className="mt-5 list-disc space-y-3 pl-5 text-muted marker:text-accent-deep">
          {side.items.map((item) => <li key={item} className="pl-1 leading-relaxed">{item}</li>)}
        </ul>
      </div>)}
    </div>
    <div className="mt-12 max-w-3xl border-t border-ink/15 pt-10">
      <p className="text-xl leading-relaxed tracking-tight"><Rich>{c.verdict}</Rich></p>
      <p className="mt-5 text-sm leading-relaxed text-muted">{c.note}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Button href={localeHref(locale, "/download")} variant="primary">{shared.cta.install}</Button>
        <Button href={GITHUB_URL}>{shared.cta.github}</Button>
      </div>
    </div>
  </section></Band>;
}
