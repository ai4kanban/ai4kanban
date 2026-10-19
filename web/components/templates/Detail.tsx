"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiExternalLink, FiInfo, FiPlay, FiRefreshCw } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import type { TemplatesCopy } from "@/i18n/templates/types";
import { localeHref, localePath } from "@/lib/i18n";
import {
  SHELL,
  TEMPLATES_PATH,
  clock,
  fetchTemplate,
  linkLabel,
  templatePath,
  type Side,
  type Template,
} from "@/lib/templates";
import { AccessTag, Duration, NoPreview, StateBox, Tag } from "./parts";

type State = { template: Template | null; missing: boolean; failed: boolean };

// One template: what it is, the original beside its recreation (a prop or a
// motion has only its keyframe), where it came from, and how to use it. Like the catalog, the browser reads it again on
// every visit, so a template taken down since the build says so.
export function Detail({
  locale,
  category,
  name,
  initial,
}: {
  locale: TemplatesLocale;
  category: string;
  name: string;
  initial: Template | null;
}) {
  const t = getTemplatesCopy(locale);
  // The shell page stands in for a template the build never saw: its name is in the URL.
  const pathname = usePathname() ?? "";
  const shell = name === SHELL;
  const [urlCategory = category, urlName = name] = shell ? pathname.split(`${TEMPLATES_PATH}/`)[1]?.split("/") ?? [] : [];
  const want = shell ? urlName : name;
  const [state, setState] = useState<State>({ template: initial, missing: false, failed: false });

  const load = useCallback(() => {
    setState((s) => ({ ...s, failed: false }));
    fetchTemplate(want).then(
      (template) => {
        if (template && template.category !== (shell ? urlCategory : category)) {
          window.location.replace(localePath(locale, templatePath(template.category, template.name)));
        }
        setState({ template, missing: !template, failed: false });
      },
      () => setState((s) => ({ ...s, failed: !s.template })),
    );
  }, [want, shell, urlCategory, category, locale]);
  useEffect(load, [load]);

  useEffect(() => {
    if (shell && state.template) document.title = t.detailTitle(state.template.title);
  }, [shell, state.template, t]);

  const home = localePath(locale, TEMPLATES_PATH);
  const { template: tpl, missing, failed } = state;

  if (missing || (failed && !tpl)) {
    return (
      <section className="mt-8 lg:mt-12">
        <StateBox line={missing ? t.missing : t.unavailable}>
          {missing ? (
            <Button href={home} size="sm">
              {t.all}
            </Button>
          ) : (
            <Button size="sm" onClick={load}>
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
              {t.retry}
            </Button>
          )}
        </StateBox>
      </section>
    );
  }
  if (!tpl) return <p className="mt-10 text-muted">{t.loading}</p>;

  const named = t.categories[tpl.category];
  const sides = [
    "original" in tpl.source ? null : side("original", tpl.original),
    side("recreation", tpl.recreation),
  ].filter((s) => s !== null);
  const video = tpl.category === "video" || sides.some((s) => s.value.video || s.value.youtube);
  const aspect = video ? "aspect-video" : "aspect-[16/10]";
  // Props and motion are pieces of a video template: one keyframe, shown whole.
  const piece = tpl.category === "prop" || tpl.category === "motion";

  return (
    <>
      <section className="mt-8 lg:mt-12">
        <a
          href={`${home}#${tpl.category}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-ink"
        >
          <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          {named?.back ?? t.back(tpl.category)}
        </a>
        <h1 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight sm:text-5xl">{tpl.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tag>{named?.name ?? tpl.category}</Tag>
          <AccessTag access={tpl.access} t={t} />
        </div>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{tpl.summary}</p>
      </section>

      <section className={`mt-10 grid gap-6 ${sides.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {piece ? (
          <figure>
            <figcaption className="mb-2 flex items-center gap-2">
              <Tag>{t.keyframe}</Tag>
            </figcaption>
            <Still src={tpl.cover} aspect="aspect-video" whole t={t} />
          </figure>
        ) : sides.length === 0 ? (
          <Still src={tpl.cover} aspect={aspect} t={t} />
        ) : (
          sides.map(({ key, value }) => (
            <Figure
              key={key}
              t={t}
              side={value}
              aspect={aspect}
              label={key === "original" ? (video ? t.originalVideo : t.original) : video ? t.recreationVideo : t.recreation}
              origin={key === "original" && !("original" in tpl.source) ? tpl.source.site : null}
            />
          ))
        )}
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div>
          {piece && (
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <FiInfo className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              {t.pieceNote}
            </p>
          )}
          <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink">{tpl.description}</p>
          {tpl.tags.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-ink">{t.tags}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {tpl.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </>
          )}
        </div>
        <aside className="space-y-6">
          <div className="border-b border-border/15 pb-6">
            <h2 className="text-base font-bold text-ink">{t.use}</h2>
            <p className="mt-1 text-sm text-muted">{t.useLead}</p>
            <Button href={localeHref(locale, "/download")} variant="primary" className="mt-4 w-full">
              {t.download}
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {tpl.access === "pro" && (
              <>
                <p className="mt-4 text-sm text-muted">{t.proLead}</p>
                <Arrow href={localeHref(locale, "/pricing")}>{t.pricing}</Arrow>
              </>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <h2 className="text-sm font-semibold text-ink">{t.source}</h2>
            {"original" in tpl.source ? (
              <p className="text-ink">{t.originalWork}</p>
            ) : (
              <>
                <Row label={t.site}>
                  <Out href={tpl.source.site} />
                </Row>
                {tpl.source.references
                  .filter((r) => r !== (tpl.source as { site: string }).site)
                  .map((r) => (
                    <Row key={r} label={t.reference}>
                      <Out href={r} />
                    </Row>
                  ))}
                <Row label={t.captured}>{tpl.source.captured.slice(0, 10)}</Row>
              </>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}

function side(key: "original" | "recreation", value: Side | null) {
  return value ? { key, value } : null;
}

function Figure({
  t,
  side,
  label,
  aspect,
  origin,
}: {
  t: TemplatesCopy;
  side: Side;
  label: string;
  aspect: string;
  /** Where the original lives, for when its video will not play. */
  origin: string | null;
}) {
  const youtube = side.youtube ? `https://www.youtube.com/watch?v=${side.youtube}` : null;
  return (
    <figure>
      <figcaption className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        {label}
        {side.keyframe && <Tag>{t.keyframe}</Tag>}
        {youtube && (
          <a
            href={youtube}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 font-normal text-muted no-underline hover:text-ink"
          >
            YouTube
            <FiExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </figcaption>
      {side.video || side.youtube ? (
        <Player t={t} side={side} label={label} aspect={aspect} origin={youtube ?? origin} />
      ) : (
        <Still src={side.image} aspect={aspect} t={t} />
      )}
    </figure>
  );
}

/** `whole` keeps the image's own ratio; `aspect` then only sizes the empty placeholder. */
function Still({ src, aspect, whole, t }: { src: string | null; aspect: string; whole?: boolean; t: TemplatesCopy }) {
  if (!src) return <NoPreview label={t.noPreview} aspect={aspect} />;
  const fit = whole ? "h-auto border border-border/15" : `${aspect} object-cover object-top`;
  // eslint-disable-next-line @next/next/no-img-element -- a static export, and the image is Cloud's
  return <img src={src} alt="" className={`${fit} w-full rounded-xl bg-code`} />;
}

// A still and a play button until it is pressed: nothing of the video, or of
// YouTube's player, loads before that.
function Player({
  t,
  side,
  label,
  aspect,
  origin,
}: {
  t: TemplatesCopy;
  side: Side;
  label: string;
  aspect: string;
  origin: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <div className={`flex ${aspect} w-full flex-col items-center justify-center gap-3 rounded-xl bg-code p-6 text-center`}>
        <FiAlertCircle className="h-6 w-6 text-caution" aria-hidden="true" />
        <p className="font-semibold text-ink">{t.videoFailed}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            {t.retry}
          </Button>
          {origin && (
            <a
              href={origin}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
            >
              {side.youtube ? t.openYouTube : t.openOriginal}
              <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (playing && side.youtube) {
    return (
      <iframe
        key={attempt}
        src={`https://www.youtube-nocookie.com/embed/${side.youtube}?autoplay=1&rel=0`}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={`${aspect} w-full rounded-xl bg-ink`}
      />
    );
  }
  if (playing && side.video) {
    return (
      <video
        key={attempt}
        src={side.video}
        poster={side.image ?? undefined}
        controls
        autoPlay
        playsInline
        onError={() => setFailed(true)}
        className={`${aspect} w-full rounded-xl bg-ink`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`${t.play}: ${label}`}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-code text-left"
    >
      {side.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a static export, and the image is Cloud's
        <img src={side.image} alt="" className={`${aspect} w-full object-cover`} />
      ) : (
        <NoPreview label={t.noPreview} aspect={aspect} />
      )}
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-border bg-elev shadow-[3px_3px_0_0_var(--color-ink)] transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none">
        <FiPlay className="ml-0.5 h-6 w-6 fill-ink text-ink" aria-hidden="true" />
      </span>
      {side.duration ? <Duration>{clock(side.duration)}</Duration> : null}
    </button>
  );
}

function Arrow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent-deep no-underline hover:underline">
      {children}
      <FiArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function Out({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="break-all text-ink underline underline-offset-4">
      {linkLabel(href)}
    </a>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </dl>
  );
}
