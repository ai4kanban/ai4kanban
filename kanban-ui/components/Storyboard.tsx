"use client";

// A card's static storyboard (#963): the script a `<Storyboard>` tag points at, read and
// checked on the server (lib/storyboard.ts). A timeline on top, then only the current shot
// (#1786): its pictures side by side, then its script in two columns. A storyboard with no
// pictures gets a row of shot chips instead of thumbnails. A slide deck (#969) pages the same
// way: a preview per slide and no timing; a slide with no notes takes the full width, capped
// to fit the screen (#1117), and its preview may be an HTML/TSX page (#1742). Each sits in an
// `<Asset>`'s frame and folds the same way (#1788).

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiChevronLeft, FiChevronRight, FiCopy, FiDownload, FiLoader, FiMaximize2, FiRotateCw } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { formatDiagnostic, type StoryboardSize } from "@/lib/storyboard-check";
import { zip } from "@/lib/zip";
import type { StoryboardFrameView, StoryboardShotView, StoryboardSlideView, StoryboardView } from "@/lib/storyboard";
import { useCopyText } from "./copy";
import { CORNER, ExpandableImage, PreviewDialog } from "./image-preview";
import { Markdown } from "./Markdown";
import { Caption, ICON_BTN, sandboxOf, useFold } from "./Mockup";

const seconds = (n: number) => String(Number(n.toFixed(2)));
// A thumbnail fits a 120 × 96 box; a picture with no notes is at most this tall.
const thumbWidth = (ratio: number) => Math.min(120, 96 * ratio);
const PAGE_HEIGHT = "min(560px, 70vh)";
const FRAME_HEIGHT = "min(360px, 45vh)";
const SOFT_BUTTON =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-wash px-3 py-1.5 text-[12.5px] font-[700] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] nb-focus";

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

/** Every picture that loads, as one zip (#1554). Numbered by place in the storyboard, so a
 *  missing page leaves a gap rather than renumbering the rest. */
function DownloadAll({ hrefs, name }: { hrefs: (string | null)[]; name: string }) {
  const c = useCopy().card.storyboard;
  const [state, setState] = useState<"idle" | "packing" | "failed">("idle");
  if (!hrefs.some(Boolean)) return null;

  const pack = async () => {
    setState("packing");
    const pad = Math.max(2, String(hrefs.length).length);
    const files = await Promise.all(
      hrefs.map(async (href, k) => {
        if (!href) return null;
        try {
          const res = await fetch(href);
          if (!res.ok) return null;
          const ext = new URL(href, location.href).pathname.match(/\.\w+$/)?.[0] ?? "";
          return { name: `${String(k + 1).padStart(pad, "0")}${ext}`, bytes: new Uint8Array(await res.arrayBuffer()) };
        } catch {
          return null;
        }
      }),
    );
    const found = files.filter((f) => f !== null);
    if (!found.length) return setState("failed");
    const url = URL.createObjectURL(zip(found));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setState("idle");
  };

  const tip = state === "packing" ? c.packing : state === "failed" ? c.downloadFailed : c.downloadAll;
  return (
    <button
      type="button"
      disabled={state === "packing"}
      onClick={pack}
      aria-label={tip}
      data-tip={tip}
      className={`${ICON_BTN} ${state === "packing" ? "cursor-default opacity-70" : ""}`}
    >
      {state === "packing" ? (
        <FiLoader size={13} aria-hidden className="animate-spin" />
      ) : state === "failed" ? (
        <FiAlertTriangle size={13} aria-hidden className="text-nb-peach-ink" />
      ) : (
        <FiDownload size={13} aria-hidden />
      )}
    </button>
  );
}

/** `<card>-<label>`, with what a file name cannot hold swapped out. */
const zipName = (card: number, label: string | undefined) =>
  `${card}-${(label?.trim() || "storyboard").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")}`;

/** The caption row an `<Asset>` has, then the body until it is folded. `head` fills the
 *  caption's right side, told whether the body shows. */
function Framed({
  label,
  head,
  onKeyDown,
  children,
}: {
  label: string;
  head?: (open: boolean) => React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  const fold = useFold();
  return (
    <div className="nb-storyboard my-4 block min-w-0 bg-nb-paper" onKeyDown={onKeyDown}>
      <Caption label={label} variants={null} {...fold}>
        {head?.(fold.open)}
      </Caption>
      {fold.open && <div className="@container px-4 pb-4 text-[13px] leading-5">{children}</div>}
    </div>
  );
}

const META = "text-[12px] text-nb-ink-soft";

/** A hosted page, which has no file to read. The frame's own Open in app is the way there. */
export function StoryboardUnavailable({ label }: { label?: string }) {
  const c = useCopy().card.storyboard;
  return (
    <Framed label={label ?? c.heading}>
      <div className="rounded-[8px] bg-nb-wash px-3 py-2.5 text-nb-ink-soft">{c.unavailable}</div>
    </Framed>
  );
}

export function Storyboard({ view, label }: { view: StoryboardView; label?: string }) {
  const name = zipName(view.card, label);
  if (view.slides) return <Slides slides={view.slides} ratio={view.ratio} size={view.size} label={label} name={name} />;
  return view.shots ? <Shots shots={view.shots} ratio={view.ratio} label={label} name={name} /> : <Broken view={view} label={label} />;
}

function Broken({ view, label }: { view: StoryboardView; label?: string }) {
  const c = useCopy().card.storyboard;
  const { copied, copy } = useCopyText();
  return (
    <Framed label={label ?? c.heading}>
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
    </Framed>
  );
}

/** A timeline thumbnail, in its picture's own shape — the storyboard's when it has none. */
function Thumb({ frame, ratio, size, current }: { frame: StoryboardFrameView; ratio: number; size?: StoryboardSize; current: boolean }) {
  const shape = frame.ratio ?? ratio;
  return (
    <div
      className={`overflow-hidden rounded-[4px] bg-nb-wash ${current ? "outline outline-1 outline-offset-1 outline-nb-accent-deep" : ""}`}
      style={{ width: thumbWidth(shape), aspectRatio: shape }}
    >
      {frame.href &&
        (frame.page && size ? (
          <PageBox href={frame.href} size={size} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a file on this machine
          <img className="nb-thumb" src={frame.href} alt="" />
        ))}
    </div>
  );
}

// ---- a slide's HTML/TSX page (#1742) ---------------------------------------------------------

type PageDoc = { doc: string; scripts?: boolean } | "failed";

/** Drawn pages by address, so a page's thumbnail and its slide share one draw. A failure is
 *  not kept, and the oldest page goes once there are many. */
const pageDocs = new Map<string, Promise<PageDoc>>();
function loadPage(href: string): Promise<PageDoc> {
  let got = pageDocs.get(href);
  if (!got) {
    got = fetch(href)
      .then((r) => (r.ok ? r.json() : null))
      .then((v): PageDoc => (typeof v?.doc === "string" ? { doc: v.doc, scripts: v.scripts } : "failed"))
      .catch((): PageDoc => "failed")
      .then((page) => {
        if (page === "failed") pageDocs.delete(href);
        return page;
      });
    pageDocs.set(href, got);
    if (pageDocs.size > 40) pageDocs.delete(pageDocs.keys().next().value!);
  }
  return got;
}

/** The page at `href` once `el` is near the viewport; `null` until it arrives. */
function usePage(el: HTMLElement | null, href: string | null): PageDoc | null {
  const [near, setNear] = useState(false);
  const [got, setGot] = useState<{ href: string; page: PageDoc } | null>(null);
  useEffect(() => {
    if (!href || near || !el) return;
    const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el, href, near]);
  useEffect(() => {
    if (!href || !near) return;
    let live = true;
    loadPage(href).then((page) => live && setGot({ href, page }));
    return () => {
      live = false;
    };
  }, [href, near]);
  return got?.href === href ? got.page : null;
}

function useWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return width;
}

/** The page laid out on the canvas, scaled to `width`. A picture, not a screen: clicks and
 *  focus belong to whatever holds it. */
function Canvas({ page, size, width, title }: { page: { doc: string; scripts?: boolean }; size: StoryboardSize; width: number; title: string }) {
  return (
    <iframe
      sandbox={sandboxOf(page.scripts)}
      srcDoc={page.doc}
      title={title}
      tabIndex={-1}
      className="pointer-events-none absolute left-0 top-0 block border-0"
      style={{ width: size.width, height: size.height, transform: `scale(${width / size.width})`, transformOrigin: "top left" }}
    />
  );
}

/** A page filling its box, drawn once near the viewport. */
function PageBox({ href, size, title = "" }: { href: string; size: StoryboardSize; title?: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box);
  const page = usePage(box, href);
  return (
    <div ref={setBox} className="relative size-full overflow-hidden">
      {page && page !== "failed" && width > 0 && <Canvas page={page} size={size} width={width} title={title} />}
    </div>
  );
}

/** A slide's page at the body's width, opening larger like a picture does. */
function PageFrame({ frame, size, missing }: { frame: StoryboardFrameView; size: StoryboardSize; missing: string }) {
  const c = useCopy().shared;
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box);
  const page = usePage(box, frame.href);
  const [open, setOpen] = useState(false);
  const ratio = size.width / size.height;
  if (!frame.href || page === "failed") return <Missing ratio={ratio} text={missing} />;
  const ready = page !== null;
  return (
    <>
      <div
        ref={setBox}
        role={ready ? "button" : undefined}
        tabIndex={ready ? 0 : undefined}
        aria-label={ready ? c.viewLarger : undefined}
        onClick={() => ready && setOpen(true)}
        onKeyDown={(e) => {
          if (!ready || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          setOpen(true);
        }}
        className={`group relative w-full overflow-hidden rounded-[6px] bg-nb-wash ${ready ? "cursor-zoom-in nb-focus" : ""}`}
        style={{ aspectRatio: ratio }}
      >
        {ready && width > 0 && <Canvas page={page} size={size} width={width} title={frame.alt} />}
        {ready && (
          <span className={`${CORNER} opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}>
            <FiMaximize2 size={12} aria-hidden />
            {c.viewLarger}
          </span>
        )}
      </div>
      {open && ready && (
        <PreviewDialog label={frame.alt} onClose={() => setOpen(false)}>
          <LargePage page={page} size={size} title={frame.alt} />
        </PreviewDialog>
      )}
    </>
  );
}

/** Fitted to the window and never past the canvas's own pixels, as a picture is. */
function LargePage({ page, size, title }: { page: { doc: string; scripts?: boolean }; size: StoryboardSize; title: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box);
  const ratio = size.width / size.height;
  return (
    <div
      ref={setBox}
      onClick={(e) => e.stopPropagation()}
      className="relative shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
      style={{ width: `min(100%, ${size.width}px, calc((100dvh - 80px) * ${ratio}))`, aspectRatio: ratio }}
    >
      {width > 0 && <Canvas page={page} size={size} width={width} title={title} />}
    </div>
  );
}

/** One shot or slide at a time (#1786): its index, pager and ←/→ while focus is inside, and a
 *  timeline that keeps the current item in view. */
function usePager(count: number) {
  const [current, setCurrent] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const k = Math.min(current, Math.max(0, count - 1));
  useEffect(() => {
    const box = strip.current;
    const item = box?.querySelectorAll<HTMLElement>("[data-item]")[k];
    if (!box || !item) return;
    const left = item.offsetLeft - 3;
    const right = item.offsetLeft + item.offsetWidth + 3;
    if (left < box.scrollLeft) box.scrollTo({ left, behavior: "smooth" });
    else if (right > box.scrollLeft + box.clientWidth) box.scrollTo({ left: right - box.clientWidth, behavior: "smooth" });
  }, [k]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !e.currentTarget.contains(e.target as Node)) return;
    const next = k + (e.key === "ArrowLeft" ? -1 : 1);
    if (next < 0 || next >= count) return;
    e.preventDefault();
    setCurrent(next);
  };
  return { current: k, go: setCurrent, strip, onKeyDown };
}

const PAGER_BUTTON =
  "nb-tip inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] bg-nb-wash text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-nb-wash nb-focus";

function Pager({ head, current, count, go, prev, next }: { head: React.ReactNode; current: number; count: number; go: (k: number) => void; prev: string; next: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="min-w-0 font-[700] text-nb-accent-deep">{head}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button type="button" className={PAGER_BUTTON} data-tip={prev} aria-label={prev} disabled={current === 0} onClick={() => go(current - 1)}>
          <FiChevronLeft size={15} aria-hidden />
        </button>
        <span className="min-w-[44px] text-center text-[12px] text-nb-ink-soft tabular-nums">
          {current + 1} / {count}
        </span>
        <button
          type="button"
          className={PAGER_BUTTON}
          data-tip={next}
          aria-label={next}
          disabled={current === count - 1}
          onClick={() => go(current + 1)}
        >
          <FiChevronRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Shots({ shots, ratio, label, name }: { shots: StoryboardShotView[]; ratio: number; label?: string; name: string }) {
  const c = useCopy().card.storyboard;
  const { current, go, strip, onKeyDown } = usePager(shots.length);
  const total = shots.length ? shots[shots.length - 1]!.end : 0;
  const pictured = shots.some((s) => s.frames.length > 0);
  const shot = shots[current];

  return (
    <Framed
      label={label ?? c.heading}
      onKeyDown={onKeyDown}
      head={(open) => (
        <>
          {shots.length > 0 && <span className={META}>{c.summary(shots.length, seconds(total))}</span>}
          {open && <span className="text-[11px] text-nb-ink-soft">{c.sketch}</span>}
          <DownloadAll hrefs={shots.flatMap((s) => s.frames.map((f) => f.href))} name={name} />
        </>
      )}
    >
      {!shot ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.empty}</div>
      ) : (
        <>
          {pictured ? (
            <div ref={strip} className="relative mb-4 overflow-x-auto" role="group" aria-label={c.timeline}>
              <div className="flex w-max gap-2 p-[3px]">
                {shots.map((s, k) => (
                  <button
                    key={s.id}
                    data-item
                    type="button"
                    onClick={() => go(k)}
                    aria-current={k === current ? "true" : undefined}
                    aria-label={`${s.id} · ${seconds(s.end - s.start)}s`}
                    className="shrink-0 cursor-pointer rounded-[5px] text-left nb-focus"
                    style={{ width: thumbWidth(s.frames[0]?.ratio ?? ratio) }}
                  >
                    <Thumb frame={s.frames[0] ?? BLANK} ratio={ratio} current={k === current} />
                    <div className="flex justify-between gap-1 px-1 pt-1 text-[11px]">
                      <span className="font-[700]">{s.id.slice(1)}</span>
                      <span className="text-nb-ink-soft">{seconds(s.end - s.start)}s</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={c.timeline}>
              {shots.map((s, k) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(k)}
                  aria-current={k === current ? "true" : undefined}
                  aria-label={`${s.id} · ${seconds(s.end - s.start)}s`}
                  className={`inline-flex cursor-pointer items-baseline gap-1.5 rounded-[6px] px-2 py-1 text-[11px] nb-focus ${k === current ? "bg-nb-accent-soft text-nb-accent-deep" : "bg-nb-wash"}`}
                >
                  <span className="font-[700]">{s.id.slice(1)}</span>
                  <span className={k === current ? "" : "text-nb-ink-soft"}>{seconds(s.end - s.start)}s</span>
                </button>
              ))}
            </div>
          )}
          <Pager
            head={`${shot.id} · ${seconds(shot.start)}–${seconds(shot.end)}s`}
            current={current}
            count={shots.length}
            go={go}
            prev={c.prevShot}
            next={c.nextShot}
          />
          <Shot key={shot.id} shot={shot} ratio={ratio} />
        </>
      )}
    </Framed>
  );
}

const BLANK: StoryboardFrameView = { src: "", alt: "", href: null, ratio: null };

function Shot({ shot, ratio }: { shot: StoryboardShotView; ratio: number }) {
  const c = useCopy().card.storyboard;
  const pair = shot.frames.length === 2;
  const captions = shot.captions.filter((line) => line.trim()).join(" / ");
  return (
    <section aria-label={shot.id}>
      {shot.frames.length > 0 && (
        <div className="mb-5 flex gap-4">
          {shot.frames.map((frame, k) => (
            // Two to a row, and short enough that a tall picture still leaves the script on screen.
            <div key={k} className="min-w-0" style={{ width: `min(calc((100% - 16px) / 2), calc(${FRAME_HEIGHT} * ${frame.ratio ?? ratio}))` }}>
              {pair && <div className="mb-1 text-[11px] font-[700]">{k === 0 ? c.start : c.end}</div>}
              <Frame frame={frame} ratio={ratio} />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-4 @max-[640px]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="mb-1 font-[700]">{c.action}</div>
            <div>{shot.action}</div>
          </div>
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
          {captions && (
            <div>
              <div className="mb-1 font-[700]">{c.captions}</div>
              <div>{captions}</div>
            </div>
          )}
        </div>
        {shot.details.trim() && (
          <details open className="group min-w-0">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-[600] text-nb-ink-soft nb-focus">
              <FiChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
              {c.details}
            </summary>
            <div className="mt-1 text-nb-ink-soft">
              <Markdown body={shot.details} className="text-[13px]" />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function Frame({ frame, ratio, missing }: { frame: StoryboardFrameView; ratio: number; missing?: string }) {
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
  return <Missing ratio={frame.ratio ?? ratio} text={missing ?? c.noFrame} />;
}

function Missing({ ratio, text }: { ratio: number; text: string }) {
  return (
    <div
      style={{ aspectRatio: ratio }}
      className="flex flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[color-mix(in_srgb,var(--color-nb-ink)_25%,transparent)] bg-nb-wash text-nb-ink-soft">
      <span>{text}</span>
      <Reload />
    </div>
  );
}

function Slides({
  slides,
  ratio,
  size,
  label,
  name,
}: {
  slides: StoryboardSlideView[];
  ratio: number;
  size: StoryboardSize;
  label?: string;
  name: string;
}) {
  const c = useCopy().card.storyboard;
  const { current, go, strip, onKeyDown } = usePager(slides.length);
  const slide = slides[current];

  return (
    <Framed
      label={label ?? c.slidesHeading}
      onKeyDown={onKeyDown}
      head={() => (
        <>
          {slides.length > 0 && <span className={META}>{c.pages(slides.length)}</span>}
          <DownloadAll hrefs={slides.map((s) => (s.preview.page ? null : s.preview.href))} name={name} />
        </>
      )}
    >
      {!slide ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.emptySlides}</div>
      ) : (
        <>
          <div ref={strip} className="relative mb-4 overflow-x-auto" role="group" aria-label={c.slidesTimeline}>
            <div className="flex w-max gap-2 p-[3px]">
              {slides.map((s, k) => (
                <button
                  key={s.id}
                  data-item
                  type="button"
                  onClick={() => go(k)}
                  aria-current={k === current ? "true" : undefined}
                  aria-label={`${k + 1} · ${s.title}`}
                  className="shrink-0 cursor-pointer rounded-[5px] text-left nb-focus"
                  style={{ width: thumbWidth(s.preview.ratio ?? ratio) }}
                >
                  <Thumb frame={s.preview} ratio={ratio} size={size} current={k === current} />
                  <div className="px-1 pt-1 text-[11px] font-[700]">{k + 1}</div>
                </button>
              ))}
            </div>
          </div>
          <Pager
            head={`${current + 1} · ${slide.title}`}
            current={current}
            count={slides.length}
            go={go}
            prev={c.prevSlide}
            next={c.nextSlide}
          />
          <Slide key={slide.id} slide={slide} ratio={ratio} size={size} />
        </>
      )}
    </Framed>
  );
}

function Slide({ slide, ratio, size }: { slide: StoryboardSlideView; ratio: number; size: StoryboardSize }) {
  const c = useCopy().card.storyboard;
  const notes = slide.notes?.trim();
  const shape = slide.preview.ratio ?? ratio;
  const frame = slide.preview.page ? (
    <PageFrame frame={slide.preview} size={size} missing={c.noPreview} />
  ) : (
    <Frame frame={slide.preview} ratio={ratio} missing={c.noPreview} />
  );
  return (
    <section aria-label={slide.title}>
      {notes ? (
        <div className="grid grid-cols-2 items-start gap-6 @max-[640px]:grid-cols-1 @max-[640px]:gap-4">
          <div className="min-w-0 overflow-hidden rounded-[6px]">{frame}</div>
          <div className="min-w-0">
            <div className="mb-1 font-[700]">{c.notes}</div>
            <div>{notes}</div>
          </div>
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-[6px]" style={{ width: `min(100%, calc(${PAGE_HEIGHT} * ${shape}))` }}>
          {frame}
        </div>
      )}
    </section>
  );
}
