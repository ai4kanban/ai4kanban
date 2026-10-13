import type { ReactNode } from "react";
import { FiArrowRight, FiCheck, FiInfo, FiMinus } from "react-icons/fi";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { framed, hairline, heroTop, panelStatic } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { HeroBackdrop } from "@/components/vs/HeroBackdrop";
import { DraftsOurs, MemoryStacked, ParallelOurs } from "@/components/vs/HeroVisuals";
import { PlannotatorMark } from "@/components/vs-plannotator/PlannotatorMark";
import { getCopy } from "@/i18n";
import type { VsPlannotatorCopy, VsPlannotatorRowKey } from "@/i18n/vs-plannotator/types";
import { localePath, type Locale } from "@/lib/i18n";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

export const PATH = "/vs-plannotator";

const PLANNOTATOR_URL = "https://plannotator.ai";
const README_URL = "https://github.com/backnotprop/plannotator";

// Which side has each row built in, in table order.
const ROWS: { key: VsPlannotatorRowKey; theirs: boolean; ours: boolean }[] = [
  { key: "plans", theirs: true, ours: true },
  { key: "html", theirs: true, ours: true },
  { key: "images", theirs: false, ours: true },
  { key: "planDiff", theirs: true, ours: false },
  { key: "askAi", theirs: true, ours: true },
  { key: "codeDiff", theirs: true, ours: true },
  { key: "aiReview", theirs: true, ours: false },
  { key: "prs", theirs: true, ours: false },
  { key: "share", theirs: true, ours: false },
  { key: "board", theirs: false, ours: true },
  { key: "agents", theirs: false, ours: true },
  { key: "memory", theirs: false, ours: true },
  { key: "followUps", theirs: false, ours: true },
];

const RULE = "border-[color-mix(in_srgb,var(--color-ink)_12%,transparent)]";
const TINT = "bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-elev))]";

// Numbered eyebrow + H2, as SectionHeading; the mark leads the title it names.
function Heading({ num, mark, title }: { num: string; mark?: ReactNode; title: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          {num}
        </span>
      </div>
      <h2 className="mt-3 flex items-start gap-3 text-3xl font-bold tracking-tight">
        {mark && <span className="mt-1 flex shrink-0">{mark}</span>}
        {title}
      </h2>
    </div>
  );
}

const Supported = ({ text }: { text: string }) => (
  <span className="flex items-start gap-2 text-sm text-ink">
    <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
    {text}
  </span>
);

// A check (with its note, if any) where it is built in, a dash where it is not.
function Mark({ has, note, c }: { has: boolean; note?: string; c: VsPlannotatorCopy["compare"] }) {
  if (!has)
    return (
      <FiMinus
        className="h-5 w-5 shrink-0 text-[color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
        aria-label={c.no}
      />
    );
  return (
    <span className="flex items-start gap-2 text-sm">
      <FiCheck className="h-5 w-5 shrink-0 text-growth" strokeWidth={3} aria-label={c.yes} />
      {note && <span className="text-muted">{note}</span>}
    </span>
  );
}

// Plannotator vs. AI4Kanban, row by row. Our column carries the tint.
function CompareTable({ c }: { c: VsPlannotatorCopy["compare"] }) {
  const COLS = "sm:grid-cols-[1fr_13rem_13rem]";
  const cell = (body: ReactNode, label: string, cls: string) => (
    <div className={`flex flex-col gap-1.5 px-4 py-3 sm:justify-center sm:py-4 ${cls}`}>
      <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted sm:hidden">
        {label}
      </span>
      {body}
    </div>
  );
  const row = (key: string, label: string, theirs: ReactNode, ours: ReactNode, first: boolean) => (
    <div key={key} className={`sm:grid ${COLS} ${first ? "" : `border-t ${RULE}`}`}>
      <div className="px-4 pt-4 text-sm font-semibold text-ink sm:py-4 sm:pl-5">{label}</div>
      <div className="grid grid-cols-2 sm:contents">
        {cell(theirs, "Plannotator", "")}
        {cell(ours, "AI4Kanban", TINT)}
      </div>
    </div>
  );
  const text = (s: string) => <span className="text-sm text-ink">{s}</span>;
  return (
    <>
      <div className={`${panelStatic} ${framed} mt-8 overflow-hidden`}>
        <div className={`hidden border-b-2 border-border sm:grid ${COLS}`}>
          <span className="px-5 py-4 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
            {c.head}
          </span>
          <span className="flex items-center gap-2 px-4 py-4 text-base font-bold text-ink">
            <PlannotatorMark className="h-5 w-5" />
            Plannotator
          </span>
          <span className={`flex items-center gap-2 px-4 py-4 text-base font-bold text-ink ${TINT}`}>
            <LogoMark size="xs" />
            AI4Kanban
          </span>
        </div>
        {row("how", c.how.label, text(c.how.theirs), text(c.how.ours), true)}
        {ROWS.map(({ key, theirs, ours }) => {
          const r = c.rows[key];
          return row(
            key,
            r.label,
            <Mark has={theirs} note={r.theirs} c={c} />,
            <Mark has={ours} note={r.ours} c={c} />,
            false,
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">{c.note}</p>
    </>
  );
}

function Feature({ art, title, body }: { art: ReactNode; title: string; body: string }) {
  return (
    <div className={`grid items-center gap-2 rounded-xl ${TINT} p-5 sm:grid-cols-[17rem_1fr] sm:gap-8 sm:p-6`}>
      {art}
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

function Choice({ mark, name, body }: { mark: ReactNode; name: string; body: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        {mark}
        <h3 className="text-lg font-bold tracking-tight text-ink">{name}</h3>
      </div>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-ink">{body}</p>
    </>
  );
}

export function VsPlannotatorPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsPlannotator;
  const rivalId = `${pageUrl(PATH)}#plannotator`;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-10-13",
      dateModified: "2026-10-13",
      about: [{ "@id": APP_ID }, { "@id": rivalId }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: rivalId, name: "Plannotator", url: PLANNOTATOR_URL }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale={locale} />
      <main className="mx-auto max-w-4xl text-pretty px-6">
        <section className={heroTop}>
          <div className="relative isolate py-16 text-center sm:py-20">
            <HeroBackdrop />
            <p className="mb-5 inline-block rounded-full border-2 border-border bg-accent-deep px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-elev">
              {t.hero.badge}
            </p>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              {t.hero.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{t.hero.lead}</p>
          </div>

          <div className={`border-y py-5 ${hairline}`}>
            <div className="flex items-center justify-center gap-2">
              <LogoMark size="xs" />
              <PlannotatorMark className="h-5 w-5" />
              <h2 className="ml-1 text-lg font-bold tracking-tight text-ink">{t.both.title}</h2>
            </div>
            <ul className="mt-4 grid grid-cols-1 justify-items-start gap-y-2 pl-4 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-8 sm:pl-0">
              {t.both.items.map((item) => (
                <li key={item}>
                  <Supported text={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="01" mark={<PlannotatorMark className="h-7 w-7" />} title={t.theirs.title} />
          <p className="text-[1.05rem] leading-relaxed text-ink">{t.theirs.intro}</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {t.theirs.more.map((m) => (
              <div key={m.title} className={`rounded-xl border p-5 ${hairline}`}>
                <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                <p className="mt-2 text-sm text-muted">{m.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[PLANNOTATOR_URL, README_URL].map((href, i) => (
              <a key={href} href={href} className="inline-flex items-center gap-1 text-ink underline underline-offset-4">
                {t.theirs.links[i]}
                <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </p>
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="02" mark={<LogoMark size="sm" />} title={t.ours.title} />
          <p className="text-[1.05rem] leading-relaxed text-ink">{t.ours.lead}</p>
          <div className="mt-10 space-y-5">
            <Feature
              art={<DraftsOurs c={t.ours.drafts.art} />}
              title={t.ours.drafts.title}
              body={t.ours.drafts.body}
            />
            <Feature
              art={<ParallelOurs c={t.ours.parallel.art} />}
              title={t.ours.parallel.title}
              body={t.ours.parallel.body}
            />
            <Feature
              art={<MemoryStacked c={t.ours.memory.art} />}
              title={t.ours.memory.title}
              body={t.ours.memory.body}
            />
          </div>
          <p className="mt-8 flex items-center gap-2 text-[1.05rem] text-ink">
            {t.ours.custom}
            {/* The Pro note shows on hover or focus only. */}
            <span className="group relative inline-flex">
              <button
                type="button"
                aria-label={t.ours.tipLabel}
                aria-describedby="pro-tip"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:text-ink"
              >
                <FiInfo className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                id="pro-tip"
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-elev opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
              >
                {t.ours.tip}
              </span>
            </span>
          </p>
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="03" title={t.compare.title} />
          <CompareTable c={t.compare} />
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="04" title={t.decision.title} />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className={`rounded-xl border bg-elev p-6 ${hairline}`}>
              <Choice
                mark={<PlannotatorMark className="h-7 w-7" />}
                name={t.decision.theirs.name}
                body={t.decision.theirs.body}
              />
            </div>
            <div className={`${panelStatic} ${framed} p-6`}>
              <Choice mark={<LogoMark size="sm" />} name={t.decision.ours.name} body={t.decision.ours.body} />
            </div>
          </div>
        </section>

        <section
          className={`${panelStatic} ${framed} mt-20 flex flex-col gap-6 p-6 sm:mt-24 sm:flex-row sm:items-center sm:justify-between sm:p-10`}
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.start.title}</h2>
            </div>
            <p className="mt-3 text-lg text-muted">{t.start.body}</p>
          </div>
          <div className="shrink-0">
            <Button href={localePath(locale, "/download")} variant="primary">
              {t.start.cta}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
