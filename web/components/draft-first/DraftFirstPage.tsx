import { FiDownload } from "react-icons/fi";
import { Band } from "@/components/Band";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { AGENT_LOGOS } from "@/components/home/agentLogos";
import { printFrame } from "@/components/home/Mat";
import { Reveal } from "@/components/home/Reveal";
import { SectionTitle } from "@/components/home/SectionTitle";
import { washGround } from "@/components/home/washes";
import { column, hairline, panelStatic } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { getCopy } from "@/i18n";
import draftFirst from "@/i18n/draft-first";
import { localePath, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { jsonLd, webPage } from "@/lib/schema";
import { CDN } from "@/lib/site";
import { BOARD_H, BOARD_W, BoardMoment } from "./BoardMoments";
import { CopyButton } from "./CopyButton";
import { KIND_H, KIND_W, KINDS } from "./DraftKinds";
import { Fit } from "./Fit";
import { Lockup } from "./Lockup";
import { MOMENT_H, MOMENT_W, MOMENTS } from "./ReviewMoments";

export const PATH = "/draft-first";

const COMMAND = "npx draft-first install";
const REPO = "https://github.com/ai4kanban/draft-first";

// Between a figure's term and its line.
const COLON: Record<Locale, string> = { en: ": ", es: ": ", fr: "\u00a0: ", zh: "：", ja: "：" };

const OG = {
  url: `${CDN}/draft-first/og-v1.jpg`,
  width: 2400,
  height: 1260,
  alt: "draft-first — see the draft, then build.",
};

export function draftFirstMetadata(locale: Locale) {
  return pageMetadata({ locale, path: PATH, ...draftFirst[locale].meta, image: OG });
}

// The hero recording, Chinese for the Chinese page and English everywhere else, like
// the review page itself. 1340×705: the review page's width, cut to the hero's frame.
const VIDEO_W = 1340;
const VIDEO_H = 705;
const video = (locale: Locale, ext: string) => `${CDN}/draft-first/hero-${locale === "zh" ? "zh" : "en"}-v1.${ext}`;

// /draft-first (#1635): the landing page of the draft-first skill (ai4kanban/draft-first).
// AI4Kanban is named in the body only from section 5 on.
export function DraftFirstPage({ locale }: { locale: Locale }) {
  const site = getCopy(locale);
  const c = draftFirst[locale];
  const lang = locale === "zh" ? "zh" : "en";
  const schema = jsonLd(webPage(PATH, c.meta.title, c.schema, { locale }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={site} locale={locale} />
      {/* This page keeps its grounds neutral: no warm band or code tone. */}
      <main style={{ ["--color-band" as string]: "#f5f5f5", ["--color-code" as string]: "#f2f2f2" }}>
        <div className={column}>
          {/* 1. Hero */}
          <section className="mt-10 lg:mt-14">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <Lockup size={20} />
              <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[3.5rem]">
                {c.hero.title[0]}
                <br />
                {c.hero.title[1]}
              </h1>
              <p className="mt-5 max-w-[600px] text-balance text-lg leading-relaxed text-muted">{c.hero.lead}</p>
              <div className="mt-8 inline-flex h-12 max-w-full items-center gap-2 whitespace-nowrap rounded-[11px] border-2 border-border bg-elev pl-3.5 pr-1.5 font-mono text-[0.9rem] leading-none shadow-[3px_3px_0_0_var(--color-ink)] sm:gap-3 sm:pl-4 sm:text-[1rem]">
                <span className="text-accent" aria-hidden="true">
                  $
                </span>
                <code>{COMMAND}</code>
                <CopyButton
                  text={COMMAND}
                  labels={site.shared.code}
                  className="ml-1 h-9 rounded-[8px] bg-accent px-3 text-[0.8rem] font-bold text-white transition-colors hover:bg-accent-deep"
                />
              </div>
              <p className="mt-3 text-[0.8rem] text-muted">
                {c.hero.update} ·{" "}
                <a href={REPO} className="text-ink underline underline-offset-2">
                  GitHub
                </a>
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:gap-x-5">
                <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  {c.hero.worksWith}
                </span>
                {AGENT_LOGOS.map((l) => (
                  // eslint-disable-next-line @next/next/no-img-element -- an SVG mark
                  <img
                    key={l.alt}
                    src={l.src}
                    alt={l.alt}
                    title={l.alt}
                    className="h-5 w-5 opacity-60 sm:h-[22px] sm:w-[22px]"
                    style={{ filter: "grayscale(1) brightness(0.3)" }}
                  />
                ))}
              </div>
            </div>
            <div
              className="relative mx-auto mt-8 overflow-hidden rounded-xl px-4 py-5 sm:mt-10 sm:px-16 sm:py-14"
              style={{ backgroundColor: "#fafafa", backgroundImage: washGround("emberLilac") }}
            >
              {/* A phone keeps the 4:3 middle: the review column, at a size its words can be read. */}
              <div className={`relative aspect-[4/3] bg-white sm:aspect-[1340/705] ${printFrame}`}>
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={video(locale, "webp")}
                  width={VIDEO_W}
                  height={VIDEO_H}
                  aria-label={c.hero.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <source src={video(locale, "webm")} type="video/webm" />
                  <source src={video(locale, "mp4")} type="video/mp4" />
                </video>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-white/0 to-white" />
              </div>
            </div>
          </section>

          {/* 2. Which parts get a draft */}
          <section className="mt-24 lg:mt-28">
            <SectionTitle num="01" title={c.drafts.title} />
            <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">{c.drafts.lead}</p>
            <div className="mt-10 grid gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10">
              {c.drafts.kinds.map(([label, body], i) => {
                const Kind = KINDS[i];
                return (
                  <figure key={label}>
                    <div className={`${printFrame} bg-band`}>
                      <Fit w={KIND_W} h={KIND_H}>
                        <Kind lang={lang} />
                      </Fit>
                    </div>
                    <figcaption className="mt-3 text-[0.95rem] leading-snug">
                      <span className="font-semibold text-ink">{label}</span>
                      <span className="text-muted">
                        {COLON[locale]}
                        {body}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <p className="mt-8 text-[0.95rem] text-muted">{c.drafts.more}</p>
            <p className="mt-3 text-[1.05rem] font-semibold text-ink">{c.drafts.closing}</p>
          </section>

          {/* 3. Review, then build */}
          <section className="mt-24 lg:mt-28">
            <SectionTitle num="02" title={c.review.title} />
            <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {c.review.actions.map(([term, body], i) => {
                const Moment = MOMENTS[i];
                return (
                  <figure key={term}>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <Fit w={MOMENT_W} h={MOMENT_H}>
                        <Moment lang={lang} />
                      </Fit>
                    </div>
                    <figcaption className="mt-3">
                      <span className="block font-semibold">{term}</span>
                      <span className="mt-0.5 block text-[0.95rem] leading-snug text-muted">{body}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <p className="mt-8 max-w-3xl text-[0.9rem] leading-relaxed text-muted">{c.review.export}</p>
            <p className="mt-3 max-w-3xl text-[0.9rem] leading-relaxed text-muted">
              {c.review.workflow[0]}
              <a href="/blog/draft-first-development" className="text-ink underline underline-offset-2">
                {c.review.workflow[1]}
              </a>
              {c.review.workflow[2]}
            </p>
          </section>

          {/* 4. Adding a drafting agent */}
          <section className="mt-24 grid grid-cols-1 items-center gap-10 lg:mt-28 lg:grid-cols-[5fr_6fr] lg:gap-14">
            <div>
              <SectionTitle num="03" title={c.helpers.title} />
              <p className="text-pretty text-[1.05rem] leading-relaxed text-muted">
                <Paths text={c.helpers.lead} />
              </p>
            </div>
            <figure>
              <figcaption className="mb-3 text-[0.85rem] font-semibold text-muted">{c.helpers.example}</figcaption>
              <div className="overflow-hidden rounded-xl bg-code shadow-[4px_4px_0_0_var(--color-ink)]">
                <div className={`flex items-center gap-2 border-b px-4 py-2.5 font-mono text-[0.8rem] text-muted ${hairline}`}>
                  <span className="truncate [direction:rtl]">
                    <span className="[direction:ltr] [unicode-bidi:embed]">{c.helpers.file}</span>
                  </span>
                  <CopyButton
                    text={`---\ndescription: ${c.helpers.description}\n---\n\n${c.helpers.body}\n`}
                    labels={site.shared.code}
                    className="ml-auto shrink-0 rounded-md px-2 py-1 text-[0.75rem] font-semibold text-ink hover:bg-elev"
                  />
                </div>
                <pre className="whitespace-pre-wrap px-4 py-4 font-mono text-[0.85rem] leading-relaxed text-ink">
                  <span className="text-muted">---</span>
                  {"\n"}
                  <span className="text-accent-deep">description:</span> {c.helpers.description}
                  {"\n"}
                  <span className="text-muted">---</span>
                  {"\n\n"}
                  {c.helpers.body}
                </pre>
              </div>
            </figure>
          </section>
        </div>

        {/* 5. The upgrade: the first place AI4Kanban is named in the page body. */}
        <Band>
          <section>
            <SectionTitle num="04" title={c.upgrade.title} brand={<LogoMark size="cap" />} />
            <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">{c.upgrade.lead}</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {c.upgrade.cards.map(([title, body], i) => (
                <article key={title} className={`${panelStatic} overflow-hidden`}>
                  <Fit w={BOARD_W} h={BOARD_H}>
                    <BoardMoment kind={i} lang={lang} />
                  </Fit>
                  <div className="p-5">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1.5 text-pretty text-[0.95rem] leading-relaxed text-muted">{body}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button href={localePath(locale, "/download")} variant="primary">
                <FiDownload className="h-[1.35em] w-[1.35em] shrink-0" aria-hidden="true" />
                {c.upgrade.download}
              </Button>
              <Button href={localePath(locale, "")}>{c.upgrade.explore}</Button>
            </div>
          </section>
        </Band>

        {/* 6. FAQ */}
        <div className={column}>
          <section className="mb-24 mt-24 lg:mb-28 lg:mt-28">
            <SectionTitle num="05" title={c.faq.title} />
            <dl className={`max-w-3xl border-t ${hairline}`}>
              {c.faq.items.map(([q, a]) => (
                <div key={q} className={`border-b py-6 ${hairline}`}>
                  <dt className="text-[1.05rem] font-semibold">{q}</dt>
                  <dd className="mt-2 leading-relaxed text-muted">
                    <Paths text={a} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
      <SiteFooter c={site} locale={locale} path={PATH} />
      <Reveal />
    </>
  );
}

// Paths in the copy read as code.
function Paths({ text }: { text: string }) {
  const parts = text.split(/(\.[a-z-]+\/(?:[\w一-鿿-]+\/|[\w一-鿿-]+\.md)*)/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} className="whitespace-nowrap rounded bg-code px-1 py-0.5 font-mono text-[0.88em] text-ink">
            {p}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}
