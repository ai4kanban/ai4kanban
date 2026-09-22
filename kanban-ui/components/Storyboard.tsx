"use client";

// A card's static storyboard (#963): the script a `<Storyboard>` tag points at, read and
// checked on the server (lib/storyboard.ts). A timeline of equal 120px thumbnails on top,
// scrolled natively when it overflows; under it every shot, picture left and script right,
// stacked once the body is narrower than 640px. A slide deck's storyboard (#969) is the same
// layout with pages instead of shots: a preview per slide and no timing.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FiCheck, FiChevronRight, FiCopy, FiRotateCw } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { formatDiagnostic } from "@/lib/storyboard-check";
import type { StoryboardFrameView, StoryboardShotView, StoryboardSlideView, StoryboardView } from "@/lib/storyboard";
import { useCopyText } from "./copy";
import { ExpandableImage } from "./image-preview";
import { Markdown } from "./Markdown";

const seconds = (n: number) => String(Number(n.toFixed(2)));
const SOFT_BUTTON =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-wash px-3 py-1.5 text-[12.5px] font-[700] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:outline-2 focus-visible:outline-nb-accent";

function Reload() {
  const c = useCopy().card.storyboard;
  const router = useRouter();
  return (
    <button type="button" className={SOFT_BUTTON} onClick={() => router.refresh()}>
      <FiRotateCw size={12} aria-hidden />
      {c.reload}
    </button>
  );
}

function Heading({ title, children }: { title?: string; children?: React.ReactNode }) {
  const c = useCopy().card.storyboard;
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-[15px] font-[700]">{title ?? c.heading}</span>
      {children}
    </div>
  );
}

/** A hosted page, which has no file to read. The frame's own Open in app is the way there. */
export function StoryboardUnavailable() {
  const c = useCopy().card.storyboard;
  return (
    <div className="nb-storyboard min-w-0">
      <Heading />
      <div className="rounded-[8px] bg-nb-wash px-3 py-2.5 text-[13px] text-nb-ink-soft">{c.unavailable}</div>
    </div>
  );
}

export function Storyboard({ view }: { view: StoryboardView }) {
  if (view.slides) return <Slides slides={view.slides} />;
  return view.shots ? <Shots shots={view.shots} /> : <Broken view={view} />;
}

function Broken({ view }: { view: StoryboardView }) {
  const c = useCopy().card.storyboard;
  const { copied, copy } = useCopyText();
  return (
    <div className="nb-storyboard min-w-0 text-[13px] leading-5">
      <Heading />
      <div role="alert" className="rounded-[8px] bg-nb-peach-soft px-3 py-2.5 text-nb-peach-ink">
        <div className="font-[700]">{c.needsFixing}</div>
        <div className="mt-0.5">{c.fixHint}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={SOFT_BUTTON} onClick={() => copy(view.report)}>
          {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
          {copied ? c.copied : c.copyDiagnostics}
        </button>
        <Reload />
      </div>
      <details className="group mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-[600] text-nb-ink-soft">
          <FiChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
          {c.diagnostics}
        </summary>
        <div className="mt-2 rounded-[8px] bg-nb-wash p-3">
          <div className="break-all font-mono text-[12px] text-nb-ink-soft">{view.diagnostics[0]?.file}</div>
          {view.diagnostics.map((d, k) => (
            <div key={k} className="mt-2 break-words font-mono text-[12px]">
              {formatDiagnostic(d)}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Shots({ shots }: { shots: StoryboardShotView[] }) {
  const c = useCopy().card.storyboard;
  const base = useId();
  const [current, setCurrent] = useState(0);
  const anchor = (k: number) => `${base}-${k}`;
  const total = shots.length ? shots[shots.length - 1]!.end : 0;

  const go = (k: number) => {
    setCurrent(k);
    document.getElementById(anchor(k))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="nb-storyboard @container min-w-0 text-[13px] leading-5">
      <Heading>
        {shots.length > 0 && <span className="text-nb-ink-soft">{c.summary(shots.length, seconds(total))}</span>}
        <span className="ml-auto text-[11px] text-nb-ink-soft">{c.sketch}</span>
      </Heading>
      {shots.length === 0 ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.empty}</div>
      ) : (
        <>
          <div className="mb-6 overflow-x-auto" role="group" aria-label={c.timeline}>
            <div className="flex w-max gap-2 p-[3px]">
              {shots.map((shot, k) => (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => go(k)}
                  aria-current={k === current ? "true" : undefined}
                  aria-label={`${shot.id} · ${seconds(shot.end - shot.start)}s`}
                  className="w-[120px] shrink-0 cursor-pointer rounded-[5px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
                >
                  {shot.frames.length > 0 && (
                    <div
                      className={`aspect-video overflow-hidden rounded-[4px] bg-nb-wash ${k === current ? "outline outline-1 outline-offset-1 outline-nb-accent-deep" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine */}
                      {shot.frames[0]?.href && <img className="nb-thumb" src={shot.frames[0].href} alt="" />}
                    </div>
                  )}
                  <div
                    className={`flex justify-between gap-1 px-1 pt-1 text-[11px] ${shot.frames.length === 0 && k === current ? "text-nb-accent-deep" : ""}`}
                  >
                    <span className="font-[700]">{shot.id.slice(1)}</span>
                    <span className="text-nb-ink-soft">{seconds(shot.end - shot.start)}s</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-8">
            {shots.map((shot, k) => (
              <Shot key={shot.id} id={anchor(k)} shot={shot} current={k === current} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Shot({ id, shot, current }: { id: string; shot: StoryboardShotView; current: boolean }) {
  const c = useCopy().card.storyboard;
  const pair = shot.frames.length === 2;
  return (
    <section id={id} className="scroll-mt-4" aria-current={current ? "true" : undefined}>
      <div className={`mb-2 font-[700] ${current ? "text-nb-accent-deep" : ""}`}>
        {shot.id} · {seconds(shot.start)}–{seconds(shot.end)}s
      </div>
      <div
        className={`grid items-start gap-6 @max-[640px]:grid-cols-1 @max-[640px]:gap-4 ${shot.frames.length ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {shot.frames.length > 0 && (
          <div className="flex min-w-0 flex-col gap-3">
            {shot.frames.map((frame, k) => (
              <div key={k}>
                {pair && <div className="mb-1 text-[11px] font-[700]">{k === 0 ? c.start : c.end}</div>}
                <Frame frame={frame} />
              </div>
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="mb-1 font-[700]">{c.voiceover}</div>
            {shot.voiceover.mode === "spoken" ? (
              <>
                <div>{shot.voiceover.text}</div>
                <div className="mt-1 text-[12px] text-nb-ink-soft">{shot.voiceover.source}</div>
              </>
            ) : (
              <div className="text-nb-ink-soft">{c.noVoiceover}</div>
            )}
          </div>
          <div>
            <div className="mb-1 font-[700]">{c.action}</div>
            <div>{shot.action}</div>
          </div>
          <details className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-[600] text-nb-ink-soft focus-visible:outline-2 focus-visible:outline-nb-accent">
              <FiChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
              {c.details}
            </summary>
            <div className="mt-2 text-nb-ink-soft">
              <Markdown body={shot.details} className="text-[13px]" />
              {shot.captions.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 font-[700] text-nb-ink">{c.captions}</div>
                  {shot.captions.map((line, k) => (
                    <div key={k}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function Frame({ frame, missing }: { frame: StoryboardFrameView; missing?: string }) {
  const c = useCopy().card.storyboard;
  const [failed, setFailed] = useState<string | null>(null);
  if (frame.href && failed !== frame.href) {
    return (
      <ExpandableImage
        src={frame.href}
        alt={frame.alt}
        onError={() => setFailed(frame.href)}
        hint
        className="block w-full"
      />
    );
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] bg-nb-wash text-nb-ink-soft">
      <span>{missing ?? c.noFrame}</span>
      <Reload />
    </div>
  );
}

function Slides({ slides }: { slides: StoryboardSlideView[] }) {
  const c = useCopy().card.storyboard;
  const base = useId();
  const [current, setCurrent] = useState(0);
  const anchor = (k: number) => `${base}-${k}`;

  const go = (k: number) => {
    setCurrent(k);
    document.getElementById(anchor(k))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="nb-storyboard @container min-w-0 text-[13px] leading-5">
      <Heading title={c.slidesHeading}>
        {slides.length > 0 && <span className="text-nb-ink-soft">{c.pages(slides.length)}</span>}
      </Heading>
      {slides.length === 0 ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.emptySlides}</div>
      ) : (
        <>
          <div className="mb-6 overflow-x-auto" role="group" aria-label={c.slidesTimeline}>
            <div className="flex w-max gap-2 p-[3px]">
              {slides.map((slide, k) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => go(k)}
                  aria-current={k === current ? "true" : undefined}
                  aria-label={`${k + 1} · ${slide.title}`}
                  className="w-[120px] shrink-0 cursor-pointer rounded-[5px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
                >
                  <div
                    className={`aspect-video overflow-hidden rounded-[4px] bg-nb-wash ${k === current ? "outline outline-1 outline-offset-1 outline-nb-accent-deep" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine */}
                    {slide.preview.href && <img className="nb-thumb" src={slide.preview.href} alt="" />}
                  </div>
                  <div className="px-1 pt-1 text-[11px] font-[700]">{k + 1}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-8">
            {slides.map((slide, k) => (
              <Slide key={slide.id} id={anchor(k)} slide={slide} page={k + 1} current={k === current} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Slide({ id, slide, page, current }: { id: string; slide: StoryboardSlideView; page: number; current: boolean }) {
  const c = useCopy().card.storyboard;
  return (
    <section id={id} className="scroll-mt-4" aria-current={current ? "true" : undefined}>
      <div className={`mb-2 font-[700] ${current ? "text-nb-accent-deep" : ""}`}>
        {page} · {slide.title}
      </div>
      <div className="grid grid-cols-2 items-start gap-6 @max-[640px]:grid-cols-1 @max-[640px]:gap-4">
        <div className="min-w-0 overflow-hidden rounded-[6px]">
          <Frame frame={slide.preview} missing={c.noPreview} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {slide.copy.length > 0 && (
            <div>
              <div className="mb-1 font-[700]">{c.onSlide}</div>
              {slide.copy.map((line, k) => (
                <div key={k}>{line}</div>
              ))}
            </div>
          )}
          <div>
            <div className="mb-1 font-[700]">{c.notes}</div>
            {slide.notes.trim() ? <div>{slide.notes}</div> : <div className="text-nb-ink-soft">{c.noNotes}</div>}
          </div>
          <details className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-[600] text-nb-ink-soft focus-visible:outline-2 focus-visible:outline-nb-accent">
              <FiChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
              {c.layout}
            </summary>
            <div className="mt-2 text-nb-ink-soft">
              <div>{slide.layout}</div>
              {slide.assets.map((asset, k) => (
                <div key={k} className="break-all">
                  {asset}
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
