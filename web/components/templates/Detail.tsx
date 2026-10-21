"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FiAlertCircle, FiArrowLeft, FiCheck, FiCopy, FiExternalLink, FiInfo, FiPause, FiPlay, FiRefreshCw } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import type { TemplatesCopy } from "@/i18n/templates/types";
import { localePath } from "@/lib/i18n";
import {
  SHELL,
  TEMPLATES_PATH,
  clock,
  fetchTemplate,
  linkLabel,
  templatePath,
  type Page,
  type Side,
  type Template,
} from "@/lib/templates";
import { AccessTag, Bone, Duration, Img, NoPreview, Progress, StateBox, Tag, reducedMotion } from "./parts";

/** `settled`: the fresh read is back, or failed — until then the preview waits, so an old
 *  snapshot's layout never flashes before the current one. */
type State = { template: Template | null; missing: boolean; failed: boolean; settled: boolean };

// One template: what it is, the original beside its recreation (a prop has only
// its keyframe, a motion its clip), where it came from, and how to use it. Like the
// catalog, the browser reads it again on every visit, so a template taken down since
// the build says so.
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
  const [state, setState] = useState<State>({ template: initial, missing: false, failed: false, settled: false });

  const load = useCallback(() => {
    setState((s) => ({ ...s, failed: false }));
    fetchTemplate(want).then(
      (template) => {
        if (template && template.category !== (shell ? urlCategory : category)) {
          window.location.replace(localePath(locale, templatePath(template.category, template.name)));
        }
        setState({ template, missing: !template, failed: false, settled: true });
      },
      () => setState((s) => ({ ...s, failed: !s.template, settled: true })),
    );
  }, [want, shell, urlCategory, category, locale]);
  useEffect(load, [load]);

  useEffect(() => {
    if (shell && state.template) document.title = t.detailTitle(state.template.title);
  }, [shell, state.template, t]);

  const home = localePath(locale, TEMPLATES_PATH);
  const { template: tpl, missing, failed, settled } = state;

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
  if (!tpl) return <Skeleton t={t} home={home} category={shell ? urlCategory : category} />;

  const named = t.categories[tpl.category];
  const sides = [
    "original" in tpl.source ? null : side("original", tpl.original),
    side("recreation", tpl.recreation),
  ].filter((s) => s !== null);
  const video = tpl.category === "video" || sides.some((s) => s.value.video || s.value.youtube);
  const aspect = video ? "aspect-video" : "aspect-[16/10]";
  // Props and motion are pieces of a video template: a prop is one keyframe, shown whole; a
  // motion plays its clip, or its keyframe until it has one. Where a motion came from is no use.
  const motion = tpl.category === "motion";
  const piece = motion || tpl.category === "prop";
  const pages = tpl.category === "carousel" ? tpl.pages : [];

  return (
    <>
      <section className="mt-8 lg:mt-12">
        <Back t={t} home={home} category={tpl.category} />
        <h1 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight sm:text-5xl">{tpl.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tag>{named?.name ?? tpl.category}</Tag>
          <AccessTag access={tpl.access} t={t} />
        </div>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{tpl.summary}</p>
      </section>

      {!settled ? (
        !motion && <PreviewBones category={tpl.category} sides={sides.length} />
      ) : pages.length > 0 ? (
        <figure className="mt-10">
          <figcaption className="mb-2 flex items-center gap-2">
            <Tag>{t.pageCount(pages.length)}</Tag>
          </figcaption>
          <Strip t={t} pages={pages} />
        </figure>
      ) : !motion && (
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
      )}

      <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div>
          {motion && !settled && <MotionBones />}
          {motion && settled && (
            <figure className="mb-10 max-w-[40rem]">
              <figcaption className="mb-2 flex items-center gap-2">
                <Tag>{tpl.recreation?.video ? t.preview : t.keyframe}</Tag>
              </figcaption>
              {tpl.recreation?.video ? (
                <Clip t={t} src={tpl.recreation.video} poster={tpl.recreation.image ?? tpl.cover} />
              ) : (
                <Still src={tpl.cover} aspect="aspect-video" whole t={t} />
              )}
            </figure>
          )}
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
          <div className={motion ? "" : "border-b border-border/15 pb-6"}>
            <h2 className="text-base font-bold text-ink">{t.use}</h2>
            <p className="mt-1 text-sm text-muted">{t.useLead}</p>
            <CopyPrompt prompt={t.prompt(tpl.category, tpl.name)} t={t} />
          </div>
          {!motion && (
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
          )}
        </aside>
      </section>
    </>
  );
}

function Back({ t, home, category }: { t: TemplatesCopy; home: string; category: string }) {
  return (
    <a
      href={`${home}#${category}`}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted no-underline hover:text-ink"
    >
      <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t.categories[category]?.back ?? t.back(category)}
    </a>
  );
}

/** The page's own layout in quiet blocks, shaped by the category in the URL. */
function Skeleton({ t, home, category }: { t: TemplatesCopy; home: string; category: string }) {
  const motion = category === "motion";
  return (
    <div aria-busy="true">
      <span className="sr-only">{t.loading}</span>
      <section className="mt-8 lg:mt-12">
        <Back t={t} home={home} category={category} />
        <Bone className="mt-5 h-9 w-4/5 sm:h-12 sm:w-1/2" />
        <div className="mt-4 flex gap-2">
          <Bone className="h-5 w-14" />
          <Bone className="h-5 w-12" />
        </div>
        <Bone className="mt-5 h-5 w-full max-w-3xl" />
        <Bone className="mt-2.5 h-5 w-2/3 max-w-xl" />
      </section>
      {!motion && <PreviewBones category={category} sides={2} />}
      <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div>
          {motion && <MotionBones />}
          <div className="space-y-2.5">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-5/6" />
            <Bone className="h-4 w-2/3" />
          </div>
        </div>
        <div className={`space-y-3 ${motion ? "" : "border-b border-border/15 pb-6"}`}>
          <Bone className="h-5 w-40" />
          <Bone className="h-3.5 w-56 max-w-full" />
          <Bone className="h-24 w-full rounded-lg" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      </section>
    </div>
  );
}

/** Where the preview will be: a carousel's strip of pages, or the finished piece's own ratio. */
function PreviewBones({ category, sides }: { category: string; sides: number }) {
  if (category === "carousel") {
    return (
      <div className="mt-10" aria-busy="true">
        <Bone className="mb-2 h-5 w-16" />
        <div className="-mx-6 flex gap-4 overflow-hidden px-6 pb-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="aspect-[4/5] h-[min(26rem,104vw)] shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  const piece = category === "prop";
  const n = piece ? 1 : Math.max(sides, 1);
  const aspect = piece || category === "video" ? "aspect-video" : "aspect-[16/10]";
  return (
    <section className={`mt-10 grid gap-6 ${n > 1 ? "lg:grid-cols-2" : ""}`} aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i}>
          <Bone className="mb-2 h-5 w-24" />
          <Bone className={`${aspect} w-full rounded-xl`} />
        </div>
      ))}
    </section>
  );
}

function MotionBones() {
  return (
    <div className="mb-10 max-w-[40rem]" aria-busy="true">
      <Bone className="mb-2 h-5 w-16" />
      <Bone className="aspect-video w-full rounded-xl" />
    </div>
  );
}

const PAGE = "h-[min(26rem,104vw)] w-auto max-w-none shrink-0 snap-start rounded-xl border border-border/15 bg-code";

/** A page's image, at the strip's height and its own width; a portrait block until it loads. */
function PageImg({ src }: { src: string }) {
  return <Img src={src} lazy until="aspect-[4/5]" className="block h-full w-auto max-w-none" />;
}

/** A carousel's pages side by side at one height and their own ratio; on a phone one fills the
 *  screen and the next peeks past the edge. */
function Strip({ t, pages }: { t: TemplatesCopy; pages: Page[] }) {
  return (
    <div className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none]">
      {pages.map((p, i) =>
        p.video ? (
          <LivePage key={i} t={t} image={p.image} video={p.video} />
        ) : (
          <span key={i} className={`overflow-hidden ${PAGE}`}>
            <PageImg src={p.image} />
          </span>
        ),
      )}
    </div>
  );
}

// A live page loads and plays, muted on a loop, only while in view. Under reduced motion it
// waits for the play button; a video that fails stays on its cover frame.
function LivePage({ t, image, video }: { t: TemplatesCopy; image: string; video: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"idle" | "waiting" | "live">("idle");
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setMode(reducedMotion() ? "waiting" : "live"), []);
  useEffect(() => {
    const v = ref.current;
    if (mode !== "live" || !v) return;
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    io.observe(v);
    return () => io.disconnect();
  }, [mode]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (visible) {
      setSeen(true);
      v.play().catch(() => undefined);
    } else v.pause();
  }, [visible, seen]);

  if (failed) {
    return (
      <span className={`overflow-hidden ${PAGE}`}>
        <PageImg src={image} />
      </span>
    );
  }
  if (mode === "waiting") {
    return (
      <button
        type="button"
        onClick={() => setMode("live")}
        aria-label={t.play}
        className={`group relative cursor-pointer overflow-hidden p-0 ${PAGE}`}
      >
        <PageImg src={image} />
        <PlayBadge />
      </button>
    );
  }
  // The cover frame sits under the video, so it can fade in like every other page.
  return (
    <span className={`relative overflow-hidden ${PAGE}`}>
      <PageImg src={image} />
      <video
        ref={ref}
        src={seen ? video : undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
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
  return (
    <div className={`overflow-hidden rounded-xl bg-code ${whole ? "border border-border/15" : ""}`}>
      <Img
        src={src}
        until={whole ? aspect : ""}
        className={`block w-full ${whole ? "h-auto" : `${aspect} object-cover object-top`}`}
      />
    </div>
  );
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
      <Failed
        t={t}
        aspect={aspect}
        retry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      >
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
      </Failed>
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
    <PlayCover t={t} image={side.image} aspect={aspect} label={`${t.play}: ${label}`} onPlay={() => setPlaying(true)}>
      {side.duration ? <Duration>{clock(side.duration)}</Duration> : null}
    </PlayCover>
  );
}

// A motion's clip: silent, looping, playing as the page opens — unless the system asks
// for reduced motion, when it waits for the play button.
function Clip({ t, src, poster }: { t: TemplatesCopy; src: string; poster: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setStarted(!reducedMotion()), []);
  useEffect(() => {
    const v = video.current;
    if (!started || !v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, [started, attempt]);

  const aspect = "aspect-video";
  if (failed) {
    return (
      <Failed
        t={t}
        aspect={aspect}
        retry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!started) return <PlayCover t={t} image={poster} aspect={aspect} label={t.play} onPlay={() => setStarted(true)} />;

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setFailed(true));
    else v.pause();
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/15 bg-code">
      <video
        key={attempt}
        ref={video}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => setFailed(true)}
        className={`${aspect} block w-full`}
      />
      <Progress video={video} />
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? t.play : t.pause}
        title={paused ? t.play : t.pause}
        className="absolute bottom-3 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-ink/80 text-elev hover:bg-ink"
      >
        {paused ? (
          <FiPlay className="ml-0.5 h-4 w-4 fill-elev" aria-hidden="true" />
        ) : (
          <FiPause className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function Failed({ t, aspect, retry, children }: { t: TemplatesCopy; aspect: string; retry: () => void; children?: ReactNode }) {
  return (
    <div className={`flex ${aspect} w-full flex-col items-center justify-center gap-3 rounded-xl bg-code p-6 text-center`}>
      <FiAlertCircle className="h-6 w-6 text-caution" aria-hidden="true" />
      <p className="font-semibold text-ink">{t.videoFailed}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="sm" onClick={retry}>
          <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
          {t.retry}
        </Button>
        {children}
      </div>
    </div>
  );
}

function PlayCover({
  t,
  image,
  aspect,
  label,
  onPlay,
  children,
}: {
  t: TemplatesCopy;
  image: string | null;
  aspect: string;
  label: string;
  onPlay: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={label}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-code text-left"
    >
      {image ? (
        <Img src={image} className={`${aspect} w-full object-cover`} />
      ) : (
        <NoPreview label={t.noPreview} aspect={aspect} />
      )}
      <PlayBadge />
      {children}
    </button>
  );
}

function PlayBadge() {
  return (
    <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-border bg-elev shadow-[3px_3px_0_0_var(--color-ink)] transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none">
      <FiPlay className="ml-0.5 h-6 w-6 fill-ink text-ink" aria-hidden="true" />
    </span>
  );
}

function CopyPrompt({ prompt, t }: { prompt: string; t: TemplatesCopy }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  const Icon = copied ? FiCheck : FiCopy;
  return (
    <>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-border/15 bg-elev p-3 font-mono text-[0.8rem] leading-relaxed text-ink">
        {prompt}
      </pre>
      <Button variant="primary" className="mt-4 w-full" onClick={copy}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {copied ? t.copied : t.copyPrompt}
      </Button>
    </>
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
