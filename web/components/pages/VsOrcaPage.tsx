import type { ReactNode } from "react";
import { FiArrowRight, FiCheck, FiInfo, FiMinus } from "react-icons/fi";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { framed, hairline, heroTop, panelStatic } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { HeroBackdrop } from "@/components/vs/HeroBackdrop";
import { DraftsOurs, MemoryStacked } from "@/components/vs/HeroVisuals";
import { CodexMark } from "@/components/vs-orca/CodexMark";
import { OrcaMark } from "@/components/vs-orca/OrcaMark";
import { getCopy } from "@/i18n";
import type { VsOrcaCopy, VsOrcaRowKey, VsOrcaSourceKey } from "@/i18n/vs-orca/types";
import { localePath, type Locale } from "@/lib/i18n";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

export const PATH = "/vs-orca";

const ORCA_URL = "https://onorca.dev/";
const ORCA_FEATURES_URL = "https://github.com/stablyai/orca";

const SOURCES: Record<VsOrcaSourceKey, string> = {
  worktrees: "https://learn.chatgpt.com/docs/environments/git-worktrees",
  review: "https://learn.chatgpt.com/docs/code-review",
  browser: "https://learn.chatgpt.com/docs/browser",
  remote: "https://learn.chatgpt.com/docs/remote-connections",
  orcaFeatures: ORCA_FEATURES_URL,
};

// Which side has each row built in; AI4Kanban's rows first.
const ROWS: { key: VsOrcaRowKey; ours: boolean; theirs: boolean }[] = [
  { key: "planning", ours: true, theirs: false },
  { key: "team", ours: true, theirs: false },
  { key: "drafts", ours: true, theirs: false },
  { key: "memory", ours: true, theirs: false },
  { key: "tools", ours: false, theirs: true },
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

// The overlap with Codex: a footnote-sized aside, not a comparison of its own.
function CodexNote({ c }: { c: VsOrcaCopy["codex"] }) {
  const sources = Object.keys(SOURCES) as VsOrcaSourceKey[];
  return (
    <aside className={`mt-8 grid gap-5 rounded-xl border p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 ${hairline}`}>
      <div>
        <div className="flex items-center gap-2">
          <CodexMark className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
        </div>
        <p className="mt-2 text-sm text-muted">
          {c.lead} {c.agents}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {sources.map((key, i) => (
            <span key={key}>
              {i > 0 && " · "}
              <a href={SOURCES[key]} className="text-muted underline underline-offset-4">
                {c.sources[key]}
              </a>
            </span>
          ))}
        </p>
      </div>
      <ul className={`space-y-1.5 border-t pt-4 sm:border-l sm:border-t-0 sm:py-1 sm:pl-8 sm:pt-1 ${hairline}`}>
        {c.items.map((x) => (
          <li key={x}>
            <Supported text={x} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

// AI4Kanban vs. Orca on what differs: a check where it is built in, a dash
// where it is not. Our column carries the tint.
function CompareTable({ c }: { c: VsOrcaCopy["compare"] }) {
  const COLS = "sm:grid-cols-[1fr_9rem_9rem]";
  const mark = (v: boolean, label: string, cls: string) => (
    <div className={`flex items-center gap-2 px-4 py-3 sm:justify-center sm:py-4 ${cls}`}>
      <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted sm:hidden">
        {label}
      </span>
      {v ? (
        <FiCheck className="h-5 w-5 text-growth" strokeWidth={3} aria-label={c.yes} />
      ) : (
        <FiMinus className="h-5 w-5 text-[color-mix(in_srgb,var(--color-ink)_25%,transparent)]" aria-label={c.no} />
      )}
    </div>
  );
  return (
    <div className={`${panelStatic} ${framed} mt-8 overflow-hidden`}>
      <div className={`hidden border-b-2 border-border sm:grid ${COLS}`}>
        <span />
        <span className={`flex items-center justify-center gap-2 px-4 py-4 text-base font-bold text-ink ${TINT}`}>
          <LogoMark size="xs" />
          AI4Kanban
        </span>
        <span className="flex items-center justify-center gap-2 px-4 py-4 text-base font-bold text-ink">
          <OrcaMark className="h-5 w-5" />
          Orca
        </span>
      </div>
      {ROWS.map(({ key, ours, theirs }, i) => (
        <div key={key} className={`sm:grid ${COLS} ${i > 0 ? `border-t ${RULE}` : ""}`}>
          <div className="px-4 pt-4 text-sm font-semibold text-ink sm:py-4 sm:pl-5">{c.rows[key]}</div>
          <div className="grid grid-cols-2 sm:contents">
            {mark(ours, "AI4Kanban", TINT)}
            {mark(theirs, "Orca", "")}
          </div>
        </div>
      ))}
    </div>
  );
}

// One way of working: who it is, then what you want if it suits you.
function Choice({ mark, name, ifYou, points }: { mark: ReactNode; name: string; ifYou: string; points: string[] }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        {mark}
        <h3 className="text-lg font-bold tracking-tight text-ink">{name}</h3>
      </div>
      <p className="mt-4 text-sm text-muted">{ifYou}</p>
      <ul className="mt-2 space-y-2">
        {points.map((x) => (
          <li key={x}>
            <Supported text={x} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feature({ art, title, body }: { art: ReactNode; title: string; body: string }) {
  return (
    <div className={`rounded-xl ${TINT} p-5 sm:p-6`}>
      {art}
      <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function VsOrcaPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsOrca;
  const rivalId = `${pageUrl(PATH)}#orca`;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-10-10",
      dateModified: "2026-10-10",
      about: [{ "@id": APP_ID }, { "@id": rivalId }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: rivalId, name: "Orca", url: ORCA_URL }),
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
              <OrcaMark className="h-5 w-5" />
              <h2 className="ml-1 text-lg font-bold tracking-tight text-ink">{t.both.title}</h2>
            </div>
            <ul className="mt-4 grid grid-cols-2 justify-items-center gap-x-6 gap-y-2 sm:flex sm:justify-center sm:gap-10">
              {t.both.items.map((item) => (
                <li key={item}>
                  <Supported text={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="01" mark={<OrcaMark className="h-7 w-7" />} title={t.orca.title} />
          <div className="space-y-4 text-[1.05rem] leading-relaxed text-ink">
            <p>
              {t.orca.intro}{" "}
              <a href={ORCA_URL} className="text-ink underline underline-offset-4">
                {t.orca.introLink}
              </a>
              {t.orca.introEnd}
            </p>
            {t.orca.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <CodexNote c={t.codex} />
        </section>

        <section className="mt-20 sm:mt-24">
          <Heading num="02" mark={<LogoMark size="sm" />} title={t.ours.title} />
          <p className="text-[1.05rem] leading-relaxed text-ink">{t.ours.lead}</p>
          <CompareTable c={t.compare} />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Feature
              art={<DraftsOurs c={t.ours.drafts.art} />}
              title={t.ours.drafts.title}
              body={t.ours.drafts.body}
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
          <Heading num="03" title={t.decision.title} />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className={`flex flex-col rounded-xl border bg-elev p-6 ${hairline}`}>
              <Choice
                mark={<OrcaMark className="h-7 w-7" />}
                name={t.decision.theirs.name}
                ifYou={t.decision.ifYou}
                points={t.decision.theirs.points}
              />
              <div className={`mt-auto border-t pt-4 ${hairline}`}>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
                  {t.decision.theirs.onlyLabel}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {t.decision.theirs.only.map((x) => (
                    <li key={x} className="rounded-md bg-code px-2 py-0.5 text-xs text-ink">
                      {x}
                    </li>
                  ))}
                </ul>
                <a
                  href={ORCA_FEATURES_URL}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-ink underline underline-offset-4"
                >
                  {t.decision.theirs.link}
                  <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={`${panelStatic} ${framed} flex flex-col p-6`}>
              <Choice
                mark={<LogoMark size="sm" />}
                name={t.decision.ours.name}
                ifYou={t.decision.ifYou}
                points={t.decision.ours.points}
              />
              <div className={`mt-auto border-t pt-4 ${hairline}`}>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-accent-deep">
                  {t.decision.ours.goalLabel}
                </p>
                <p className="mt-1.5 text-lg font-semibold leading-snug text-ink">{t.decision.ours.goal}</p>
              </div>
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
