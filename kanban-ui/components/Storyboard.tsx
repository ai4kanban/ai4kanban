"use client";

// A card's static storyboard (#963): the script a `<Storyboard>` tag points at, read and
// checked on the server (lib/storyboard.ts). Every shot in one row that fits the width, then
// only the current shot (#1786); the pager is in the head (#1793). One picture sits left of
// its script; a start and end frame sit side by side over a two-column script; below 640px
// everything stacks (#1792). Without pictures, or on a phone, the row is a bar cut by
// duration. A slide deck (#969) pages the same way; a slide with no notes takes the full
// width, capped to fit the screen (#1117), and its preview may be an HTML/TSX page (#1742).
// Portrait pages (a 3:4 carousel) run side by side at their own shape instead, the current
// one outlined. Each sits in an `<Asset>`'s frame and folds the same way (#1788).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiChevronLeft, FiChevronRight, FiCopy, FiDownload, FiMaximize2, FiRotateCw } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { formatDiagnostic, type StoryboardSize } from "@/lib/storyboard-check";
import { zip } from "@/lib/zip";
import type { StoryboardFrameView, StoryboardShotView, StoryboardSlideView, StoryboardView } from "@/lib/storyboard";
import { useMachine } from "@/lib/screen";
import { useCopyText } from "./copy";
import { CORNER, ExpandableImage, ImageMenu, PreviewDialog, SCRIM_BUTTON } from "./image-preview";
import { Markdown } from "./Markdown";
import { Caption, DraftFrame, ICON_BTN, sandboxOf, useFold, type MenuItem } from "./Mockup";

const seconds = (n: number) => String(Number(n.toFixed(2)));
// A picture with no notes is at most this tall.
const PAGE_HEIGHT = "min(560px, 70vh)";
const FRAME_HEIGHT = "min(360px, 45vh)";
const SOFT_BUTTON =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-wash px-3 py-1.5 text-[12.5px] font-[700] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] nb-focus";

/** Reads the card again — only where the board is. */
function Reload() {
  return useMachine() ? <ReloadButton /> : null;
}

function ReloadButton() {
  const c = useCopy().card.storyboard;
  const router = useRouter();
  return (
    <button type="button" className={SOFT_BUTTON} onClick={() => router.refresh()}>
      <FiRotateCw size={12} aria-hidden />
      {c.reload}
    </button>
  );
}

/** Every picture that loads, as one zip (#1554), as a row of the ⋯ menu; `busy` while it
 *  packs. Numbered by place in the storyboard, so a missing page leaves a gap rather than
 *  renumbering the rest. */
function useDownloadAll(hrefs: (string | null)[], name: string): { item: MenuItem | null; busy: boolean } {
  const c = useCopy().card.storyboard;
  const [state, setState] = useState<"idle" | "packing" | "failed">("idle");
  if (!hrefs.some(Boolean)) return { item: null, busy: false };

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

  return {
    busy: state === "packing",
    item: {
      icon: state === "failed" ? <FiAlertTriangle size={13} className="text-nb-peach-ink" /> : <FiDownload size={13} />,
      text: state === "packing" ? c.packing : state === "failed" ? c.downloadFailed : c.downloadAll,
      onSelect: () => state !== "packing" && pack(),
    },
  };
}

/** `<card>-<label>`, with what a file name cannot hold swapped out. */
const zipName = (card: number, label: string | undefined) =>
  `${card}-${(label?.trim() || "storyboard").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")}`;

/** The caption row an `<Asset>` has, then the body until it is folded. `head` fills the
 *  caption's right side while the body shows. */
function Framed({
  label,
  meta,
  head,
  menu,
  busy,
  onKeyDown,
  children,
}: {
  label: string;
  meta?: string;
  head?: React.ReactNode;
  menu?: (MenuItem | null)[];
  busy?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  const fold = useFold();
  return (
    <DraftFrame className="nb-storyboard" onKeyDown={onKeyDown}>
      <Caption label={label} meta={meta} variants={null} menu={menu} busy={busy} {...fold}>
        {head}
      </Caption>
      {fold.open && <div className="@container px-4 pb-4 text-[13px] leading-5">{children}</div>}
    </DraftFrame>
  );
}

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

/** A picture filling its box, or the HTML/TSX page standing in for one. */
function Preview({ frame, size }: { frame: StoryboardFrameView; size?: StoryboardSize }) {
  if (!frame.href) return null;
  return frame.page && size ? (
    <PageBox href={frame.href} size={size} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a file on this machine
    <img className="nb-thumb absolute inset-0" src={frame.href} alt="" />
  );
}

/** The timeline: every item in one row that fits the width, at the storyboard's shape. Below
 *  640px, or with no pictures at all, a bar cut by each item's `share` of the whole. */
function Timeline({
  items,
  ratio,
  size,
  current,
  go,
  label,
  pictured,
}: {
  items: { key: string; tip: string; frame: StoryboardFrameView; share: number }[];
  ratio: number;
  size?: StoryboardSize;
  current: number;
  go: (k: number) => void;
  label: string;
  pictured: boolean;
}) {
  const bar = (
    <div role="group" aria-label={label} className={`mb-3 h-[18px] items-center gap-[2px] ${pictured ? "hidden @max-[640px]:flex" : "flex"}`}>
      {items.map((it, k) => (
        <button
          key={it.key}
          type="button"
          onClick={() => go(k)}
          aria-current={k === current ? "true" : undefined}
          aria-label={it.tip}
          data-tip={it.tip}
          className="nb-tip group/seg flex h-full min-w-[3px] cursor-pointer items-center nb-focus"
          style={{ flex: `${it.share} 0 0` }}
        >
          <span className={`block h-[6px] w-full rounded-[2px] ${k === current ? "bg-nb-accent" : "bg-nb-wash group-hover/seg:bg-nb-ink-soft/40"}`} />
        </button>
      ))}
    </div>
  );
  if (!pictured) return bar;
  return (
    <>
      <div role="group" aria-label={label} className="mb-4 flex gap-[3px] @max-[640px]:hidden">
        {items.map((it, k) => (
          <button
            key={it.key}
            type="button"
            onClick={() => go(k)}
            aria-current={k === current ? "true" : undefined}
            aria-label={it.tip}
            data-tip={it.tip}
            className="nb-tip min-w-0 flex-1 cursor-pointer rounded-[3px] nb-focus"
          >
            <span
              className={`relative block overflow-hidden rounded-[3px] bg-nb-wash ${k === current ? "outline outline-2 outline-offset-1 outline-nb-accent" : "opacity-80 hover:opacity-100"}`}
              style={{ aspectRatio: ratio }}
            >
              <Preview frame={it.frame} size={size} />
            </span>
          </button>
        ))}
      </div>
      {bar}
    </>
  );
}

/** The current item's name over its body. */
function Heading({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 font-[700] text-nb-accent-deep">{index}</span>
      {children}
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
function PageFrame({ frame, size, missing, onOpen }: { frame: StoryboardFrameView; size: StoryboardSize; missing: string; onOpen: () => void }) {
  const c = useCopy().shared;
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box);
  const page = usePage(box, frame.href);
  const ratio = size.width / size.height;
  if (!frame.href || page === "failed") return <Missing ratio={ratio} text={missing} />;
  const ready = page !== null;
  return (
    <div
      ref={setBox}
      role={ready ? "button" : undefined}
      tabIndex={ready ? 0 : undefined}
      aria-label={ready ? c.viewLarger : undefined}
      onClick={() => ready && onOpen()}
      onKeyDown={(e) => {
        if (!ready || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onOpen();
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
  );
}

/** One shot or slide at a time (#1786), and ←/→ while focus is inside. */
function usePager(count: number) {
  const [current, setCurrent] = useState(0);
  const k = Math.min(current, Math.max(0, count - 1));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !e.currentTarget.contains(e.target as Node)) return;
    const next = k + (e.key === "ArrowLeft" ? -1 : 1);
    if (next < 0 || next >= count) return;
    e.preventDefault();
    setCurrent(next);
  };
  return { current: k, go: setCurrent, onKeyDown };
}

/** ‹ 5 / 18 › in the head. An end stays focusable (aria-disabled) so ←/→ keep working (#1796). */
function Pager({ current, count, go, prev, next }: { current: number; count: number; go: (k: number) => void; prev: string; next: string }) {
  if (count < 2) return null;
  return (
    <span className="mr-1 inline-flex items-center">
      <button type="button" className={ICON_BTN} data-tip={prev} aria-label={prev} aria-disabled={current === 0 || undefined} onClick={() => current > 0 && go(current - 1)}>
        <FiChevronLeft size={15} aria-hidden />
      </button>
      <span className="min-w-[46px] text-center text-[12px] font-[600] tabular-nums text-nb-ink-soft">
        <span className="text-nb-ink">{current + 1}</span> / {count}
      </span>
      <button type="button" className={ICON_BTN} data-tip={next} aria-label={next} aria-disabled={current === count - 1 || undefined} onClick={() => current < count - 1 && go(current + 1)}>
        <FiChevronRight size={15} aria-hidden />
      </button>
    </span>
  );
}

function Shots({ shots, ratio, label, name }: { shots: StoryboardShotView[]; ratio: number; label?: string; name: string }) {
  const c = useCopy().card.storyboard;
  const { current, go, onKeyDown } = usePager(shots.length);
  const total = shots.length ? shots[shots.length - 1]!.end : 0;
  const shot = shots[current];
  const download = useDownloadAll(shots.flatMap((s) => s.frames.map((f) => f.href)), name);

  return (
    <Framed
      label={label ?? c.heading}
      meta={shots.length > 0 ? c.duration(seconds(total)) : undefined}
      onKeyDown={onKeyDown}
      head={<Pager current={current} count={shots.length} go={go} prev={c.prevShot} next={c.nextShot} />}
      menu={[download.item]}
      busy={download.busy}
    >
      {!shot ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.empty}</div>
      ) : (
        <>
          <Timeline
            items={shots.map((s) => ({ key: s.id, tip: `${s.id} · ${seconds(s.end - s.start)}s`, frame: s.frames[0] ?? BLANK, share: s.end - s.start }))}
            ratio={ratio}
            current={current}
            go={go}
            label={c.timeline}
            pictured={shots.some((s) => s.frames.length > 0)}
          />
          <Heading index={shot.id}>
            <span className="text-[12px] tabular-nums text-nb-ink-soft">
              {seconds(shot.start)}–{seconds(shot.end)}s
            </span>
          </Heading>
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
  // Short enough that a tall picture still leaves the script on screen.
  const tall = (frame: StoryboardFrameView) => `calc(${FRAME_HEIGHT} * ${frame.ratio ?? ratio})`;
  const frameBox = (frame: StoryboardFrameView, share: string) =>
    ({ "--w": `min(${share}, ${tall(frame)})`, "--w-narrow": `min(100%, ${tall(frame)})` }) as React.CSSProperties;
  const FRAME_BOX = "min-w-0 w-(--w) @max-[640px]:w-(--w-narrow)";
  const script = (
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
  );
  const details = shot.details.trim() && (
    <details open className="group min-w-0">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-[600] text-nb-ink-soft nb-focus">
        <FiChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
        {c.details}
      </summary>
      <div className="mt-1 text-nb-ink-soft">
        <Markdown body={shot.details} className="text-[13px]" />
      </div>
    </details>
  );
  if (shot.frames.length === 1) {
    const frame = shot.frames[0]!;
    return (
      <section aria-label={shot.id} className="flex items-start gap-5 @max-[640px]:flex-col">
        <div className={FRAME_BOX} style={frameBox(frame, "58%")}>
          <Frame frame={frame} ratio={ratio} />
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-4 @max-[640px]:min-w-0 @max-[640px]:self-stretch">
          {script}
          {details}
        </div>
      </section>
    );
  }
  return (
    <section aria-label={shot.id}>
      {shot.frames.length > 0 && (
        <div className="mb-5 flex gap-4 @max-[640px]:flex-col">
          {shot.frames.map((frame, k) => (
            <div key={k} className={FRAME_BOX} style={frameBox(frame, "calc((100% - 16px) / 2)")}>
              {pair && <div className="mb-1 text-[11px] font-[700]">{k === 0 ? c.start : c.end}</div>}
              <Frame frame={frame} ratio={ratio} />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-4 @max-[640px]:grid-cols-1">
        {script}
        {details}
      </div>
    </section>
  );
}

function Frame({ frame, ratio, missing, onOpen }: { frame: StoryboardFrameView; ratio: number; missing?: string; onOpen?: () => void }) {
  const c = useCopy().card.storyboard;
  const [failed, setFailed] = useState<string | null>(null);
  if (frame.href && failed !== frame.href) {
    return (
      <ExpandableImage
        src={frame.href}
        alt={frame.alt}
        onError={() => setFailed(frame.href)}
        onOpen={onOpen}
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
  const { current, go, onKeyDown } = usePager(slides.length);
  const [open, setOpen] = useState(false);
  const slide = slides[current];
  const download = useDownloadAll(slides.map((s) => (s.preview.page ? null : s.preview.href)), name);
  const onOpen = () => setOpen(true);

  return (
    <Framed
      label={label ?? c.slidesHeading}
      meta={slides.length > 0 ? c.pages(slides.length) : undefined}
      onKeyDown={onKeyDown}
      head={<Pager current={current} count={slides.length} go={go} prev={c.prevSlide} next={c.nextSlide} />}
      menu={[download.item]}
      busy={download.busy}
    >
      {!slide ? (
        <div className="rounded-[8px] bg-nb-wash p-6 text-nb-ink-soft">{c.emptySlides}</div>
      ) : ratio < 1 ? (
        <Pages slides={slides} ratio={ratio} size={size} current={current} go={go} onOpen={onOpen} />
      ) : (
        <>
          <Timeline
            items={slides.map((s, k) => ({ key: s.id, tip: `${k + 1} · ${s.title}`, frame: s.preview, share: 1 }))}
            ratio={ratio}
            size={size}
            current={current}
            go={go}
            label={c.slidesTimeline}
            pictured
          />
          <Heading index={String(current + 1)}>
            <span className="min-w-0 truncate font-[700]">{slide.title}</span>
          </Heading>
          <Slide key={slide.id} slide={slide} ratio={ratio} size={size} onOpen={onOpen} />
        </>
      )}
      {open && slide && <SlideViewer slides={slides} size={size} current={current} go={go} onClose={() => setOpen(false)} />}
    </Framed>
  );
}

/** Portrait pages side by side at the storyboard's shape, about three and a half across; on a phone,
 *  one at a time with the next one's edge showing, and a swipe moves the current page. A side
 *  fades while there are pages past it. */
function Pages({
  slides,
  ratio,
  size,
  current,
  go,
  onOpen,
}: {
  slides: StoryboardSlideView[];
  ratio: number;
  size: StoryboardSize;
  current: number;
  go: (k: number) => void;
  onOpen: () => void;
}) {
  const copy = useCopy();
  const c = copy.card.storyboard;
  const band = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const settle = useRef(0);

  const measure = useCallback(() => {
    const el = band.current;
    if (el) setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const el = band.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const items = () => [...(band.current?.querySelectorAll<HTMLElement>("[data-item]") ?? [])];
  /** One page across: the phone's band. */
  const single = (el: HTMLElement, first: HTMLElement) => first.offsetWidth > el.clientWidth / 2;

  // Keep the current page clear of the fades, scrolling no further than that.
  useEffect(() => {
    const el = band.current;
    const all = items();
    const it = all[current];
    if (!el || !it) return;
    const fade = single(el, all[0]!) ? all[0]!.offsetLeft : FADE;
    const left = it.offsetLeft - fade;
    const right = it.offsetLeft + it.offsetWidth + fade - el.clientWidth;
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: "smooth" });
    else if (right > el.scrollLeft) el.scrollTo({ left: right, behavior: "smooth" });
  }, [current]);

  const onScroll = () => {
    measure();
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = band.current;
      const all = items();
      if (!el || !all[0] || !single(el, all[0])) return;
      const at = el.scrollLeft + all[0].offsetLeft;
      let best = 0;
      all.forEach((it, k) => {
        if (Math.abs(it.offsetLeft - at) < Math.abs(all[best]!.offsetLeft - at)) best = k;
      });
      go(best);
    }, 120);
  };

  const slide = slides[current]!;
  const notes = slide.notes?.trim();
  return (
    <>
      <div className="relative -mx-4 @max-[640px]:mb-1">
        <div
          ref={band}
          onScroll={onScroll}
          role="group"
          aria-label={c.slidesTimeline}
          className="relative flex items-start gap-7 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] @max-[640px]:snap-x @max-[640px]:snap-mandatory @max-[640px]:gap-5 @max-[640px]:px-3 [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: "16px 12px" }}
        >
          {slides.map((s, k) => (
            <button
              key={s.id}
              data-item
              type="button"
              onClick={() => (k === current && s.preview.href ? onOpen() : go(k))}
              aria-current={k === current ? "true" : undefined}
              aria-label={k === current && s.preview.href ? `${k + 1} · ${s.title} · ${copy.shared.viewLarger}` : `${k + 1} · ${s.title}`}
              className={`w-[calc((100cqw_-_68px)/3.5)] shrink-0 snap-start rounded-[6px] text-left nb-focus @max-[640px]:w-[calc(100cqw_-_56px)] ${k === current && s.preview.href ? "cursor-zoom-in" : "cursor-pointer"}`}
            >
              <span
                className={`relative block overflow-hidden rounded-[6px] bg-nb-wash ${
                  k === current
                    ? "outline outline-2 outline-offset-2 outline-nb-accent"
                    : "border border-[color-mix(in_srgb,var(--color-nb-ink)_12%,transparent)]"
                }`}
                style={{ aspectRatio: ratio }}
              >
                {s.preview.href ? (
                  <Preview frame={s.preview} size={size} />
                ) : (
                  <span className="flex size-full items-center justify-center text-[12px] text-nb-ink-soft">{c.noPreview}</span>
                )}
              </span>
              <span className={`mt-2.5 line-clamp-2 text-[12.5px] leading-[18px] ${k === current ? "font-[700] text-nb-ink" : "text-nb-ink-soft"}`}>
                <span className={`mr-1.5 font-[700] tabular-nums ${k === current ? "text-nb-accent-deep" : ""}`}>{k + 1}</span>
                {s.title}
              </span>
            </button>
          ))}
        </div>
        {edges.left && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-nb-paper to-transparent @max-[640px]:w-3" />
        )}
        {edges.right && (
          <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-nb-paper to-transparent @max-[640px]:w-10" />
        )}
      </div>
      {notes && (
        <div className="mt-4">
          <div className="mb-1 font-[700]">{c.notes}</div>
          <div>{notes}</div>
        </div>
      )}
    </>
  );
}

/** How far a desktop band's fade reaches. */
const FADE = 64;

/** A slide deck opened over everything (#1880): the current slide fitted to the window and never
 *  past its own pixels, ‹ › and ←/→ paging the deck itself, and its number and title below. On a
 *  phone the ‹ › flank that line; at an end, the one past it is gone. */
function SlideViewer({
  slides,
  size,
  current,
  go,
  onClose,
}: {
  slides: StoryboardSlideView[];
  size: StoryboardSize;
  current: number;
  go: (k: number) => void;
  onClose: () => void;
}) {
  const c = useCopy().card.storyboard;
  const slide = slides[current]!;
  const many = slides.length > 1;
  const step = (by: -1 | 1) => {
    const next = current + by;
    if (next >= 0 && next < slides.length) go(next);
  };
  const arrow = (by: -1 | 1, className: string) => {
    if (!many) return null;
    const end = by < 0 ? current === 0 : current === slides.length - 1;
    if (end) return <span aria-hidden className={`size-10 shrink-0 ${className}`} />;
    return (
      <button
        type="button"
        aria-label={by < 0 ? c.prevSlide : c.nextSlide}
        onClick={(e) => {
          e.stopPropagation();
          step(by);
        }}
        className={`shrink-0 ${className} ${SCRIM_BUTTON}`}
      >
        {by < 0 ? <FiChevronLeft size={22} aria-hidden /> : <FiChevronRight size={22} aria-hidden />}
      </button>
    );
  };
  return (
    <PreviewDialog label={slide.title} onClose={onClose} onStep={many ? step : undefined}>
      <div className="flex w-full flex-col items-center gap-3">
        <LargeSlide key={slide.id} frame={slide.preview} size={size} title={slide.title} />
        <div className="flex max-w-full items-center gap-3">
          {arrow(-1, "sm:hidden")}
          <div onClick={(e) => e.stopPropagation()} className="flex h-8 min-w-0 items-center gap-2 rounded-full bg-nb-ink/60 px-3.5 text-[13px] text-white backdrop-blur-sm">
            <span className="shrink-0 font-[700] tabular-nums">
              {current + 1} <span className="font-[500] text-white/70">/ {slides.length}</span>
            </span>
            <span className="min-w-0 truncate text-white/90">{slide.title}</span>
          </div>
          {arrow(1, "sm:hidden")}
        </div>
      </div>
      {arrow(-1, "absolute left-5 top-1/2 -translate-y-1/2 max-sm:hidden")}
      {arrow(1, "absolute right-5 top-1/2 -translate-y-1/2 max-sm:hidden")}
    </PreviewDialog>
  );
}

/** One slide in the viewer: room is left for the ‹ › beside it and the line below. */
function LargeSlide({ frame, size, title }: { frame: StoryboardFrameView; size: StoryboardSize; title: string }) {
  const c = useCopy().card.storyboard;
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box);
  const page = usePage(box, frame.page ? frame.href : null);
  const ratio = size.width / size.height;
  const fit = (room: string) => `min(${room}, ${size.width}px, calc((100dvh - 136px) * ${ratio}))`;
  const style = { "--w": fit("100% - 112px"), "--w-narrow": fit("100%"), aspectRatio: ratio } as React.CSSProperties;
  const SHADOW = "rounded-[10px] shadow-[0_8px_40px_rgba(0,0,0,0.35)]";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (frame.href && !frame.page) {
    return (
      <ImageMenu src={frame.href}>
        {(badge) => (
          <span onClick={stop} className="relative flex min-w-0 max-w-[calc(100%-112px)] max-sm:max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine */}
            <img src={frame.href!} alt={frame.alt} className={`max-h-[calc(100dvh-136px)] max-w-full object-contain ${SHADOW}`} />
            {badge}
          </span>
        )}
      </ImageMenu>
    );
  }
  return (
    <div ref={setBox} onClick={stop} className={`relative w-(--w) shrink-0 overflow-hidden bg-white max-sm:w-(--w-narrow) ${SHADOW}`} style={style}>
      {page && page !== "failed" && width > 0 ? (
        <Canvas page={page} size={size} width={width} title={title} />
      ) : (
        (!frame.href || page === "failed") && <div className="grid size-full place-items-center bg-nb-wash text-nb-ink-soft">{c.noPreview}</div>
      )}
    </div>
  );
}

function Slide({ slide, ratio, size, onOpen }: { slide: StoryboardSlideView; ratio: number; size: StoryboardSize; onOpen: () => void }) {
  const c = useCopy().card.storyboard;
  const notes = slide.notes?.trim();
  const shape = slide.preview.ratio ?? ratio;
  const frame = slide.preview.page ? (
    <PageFrame frame={slide.preview} size={size} missing={c.noPreview} onOpen={onOpen} />
  ) : (
    <Frame frame={slide.preview} ratio={ratio} missing={c.noPreview} onOpen={onOpen} />
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
