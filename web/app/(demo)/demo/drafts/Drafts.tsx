"use client";

// One home-page workflow preview: a slice of a card page — the task's title, then that workflow's
// draft drawn by kanban-ui's own components. The home page frames it in an iframe, so this page
// lays the slice out wide enough for the drafts' desktop layout (720px, or 400px in a portrait frame) and scales it to
// the frame. Each draft moves only the way a reader would move it, and only while it is in view.
// The clone is laid out wider: its two players are capped to the window's height, and a short
// window letterboxes them, so here the bars take the page's wash rather than black.
import { Compare } from "ai4kanban-ui/components/Compare";
import { Mockup } from "ai4kanban-ui/components/Mockup";
import { Storyboard } from "ai4kanban-ui/components/Storyboard";
import { getCopy } from "ai4kanban-ui/i18n";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ARTICLE, CAROUSEL, CLONE, DECK, PAGES, STORYBOARD, TITLES, prototype, type Kind } from "./data";

const COPY = getCopy("en").card.mockup;
/** How long a paging draft holds each page. */
const BEAT = 3500;

/** The slice's layout size and its scale, from the frame it is drawn in. */
function useFit(kind: string) {
  const [fit, setFit] = useState<{ w: number; h: number; scale: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const w = innerHeight > innerWidth ? 400 : kind === "clone" ? 880 : 720;
      const scale = innerWidth / w;
      setFit({ w, h: innerHeight / scale, scale });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [kind]);
  return fit;
}

/** Whether the slice should move: in view, and the reader has not asked for less motion. */
function useLive(ref: RefObject<HTMLElement | null>) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => setLive(!!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return live;
}

/** Whether the draft runs past the slice's bottom edge, which then fades out. */
function useClipped(ref: RefObject<HTMLElement | null>) {
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setClipped(el.scrollHeight > el.clientHeight + 1));
    for (const child of el.children) ro.observe(child);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return clipped;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((done, fail) => {
    const id = setTimeout(done, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      fail(signal.reason);
    });
  });

/** Scroll `el` to `top` over `ms`, eased. */
function glide(el: HTMLElement, top: number, ms: number, signal: AbortSignal) {
  const from = el.scrollTop;
  const start = performance.now();
  return new Promise<void>((done, fail) => {
    const step = (now: number) => {
      if (signal.aborted) return fail(signal.reason);
      const t = Math.min(1, (now - start) / ms);
      el.scrollTop = from + (top - from) * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

/** Run `script` while `live`, aborting it when the slice stops being live. */
function useScript(live: boolean, script: (signal: AbortSignal) => Promise<void>) {
  const run = useRef(script);
  run.current = script;
  useEffect(() => {
    if (!live) return;
    const abort = new AbortController();
    run.current(abort.signal).catch(() => {});
    return () => abort.abort();
  }, [live]);
}

/** Back and forth over `pages`, by the draft's own timeline: its first row of buttons. */
function usePaging(live: boolean, box: RefObject<HTMLElement | null>, pages: number[]) {
  const go = (k: number) => box.current?.querySelector('[role="group"]')?.querySelectorAll("button")[k]?.click();
  useEffect(() => go(pages[0]!), []); // eslint-disable-line react-hooks/exhaustive-deps
  useScript(live, async (signal) => {
    const seq = [...pages, ...pages.slice(1, -1).reverse()];
    for (let b = 1; ; b++) {
      await sleep(BEAT, signal);
      go(seq[b % seq.length]!);
    }
  });
}

function Paged({ pages, live, children }: { pages: number[]; live: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  usePaging(live, box, pages);
  return <div ref={box}>{children}</div>;
}

/** The prototype scrolls its own page. */
function Coding() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  if (!origin) return null;
  return <Mockup views={[{ label: "", view: prototype(origin) }]} label="Home page (desktop)" device="desktop" />;
}

/** The article is opened with its own button, read down to the end, and scrolled back up. */
function Blog({ live, view }: { live: boolean; view: RefObject<HTMLDivElement | null> }) {
  const [round, setRound] = useState(0);
  const cursor = useRef<HTMLSpanElement>(null);
  useScript(live, async (signal) => {
    const el = view.current!;
    const button = () => [...el.querySelectorAll("button")].find((b) => b.textContent === COPY.expand);
    for (;;) {
      await sleep(1500, signal);
      const open = button();
      const pointer = cursor.current;
      if (!open || !pointer) return;
      // Where the button sits in the slice's own scrolled page, unscaled.
      const scale = el.getBoundingClientRect().width / el.offsetWidth;
      const place = () => {
        const r = open.getBoundingClientRect();
        const o = el.getBoundingClientRect();
        return { x: (r.left - o.left) / scale, y: (r.top - o.top) / scale + el.scrollTop, h: r.height / scale, w: r.width / scale };
      };
      const b = place();
      await glide(el, Math.max(0, b.y + b.h - el.clientHeight + 40), 1200, signal);
      const x = b.x + b.w * 0.6;
      const y = b.y + b.h * 0.55;
      pointer.style.transition = "none";
      pointer.style.transform = `translate(${x + 46}px, ${y + 34}px)`;
      pointer.style.visibility = "visible";
      await sleep(50, signal);
      pointer.style.transition = "transform .6s ease-out";
      pointer.style.transform = `translate(${x}px, ${y}px)`;
      await sleep(900, signal);
      open.click();
      await sleep(500, signal);
      pointer.style.visibility = "hidden";
      const end = el.scrollHeight - el.clientHeight;
      await glide(el, end, Math.max(3000, (end - el.scrollTop) * 9), signal);
      await sleep(1500, signal);
      await glide(el, 0, 2000, signal);
      setRound((r) => r + 1);
    }
  });
  return (
    <>
      <Mockup key={round} views={[{ label: "", view: ARTICLE }]} label="README" device="desktop" />
      <span ref={cursor} className="pointer-events-none invisible absolute left-0 top-0 z-10">
        <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
          <path d="M1 1v17l4.5-4.2 3 6.7 3-1.3-3-6.6H15z" fill="#fff" stroke="#24231f" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </span>
    </>
  );
}

/** Both sides play, muted, from the first shot of the clip and round again. */
function Clone({ live }: { live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const videos = [...(box.current?.querySelectorAll("video") ?? [])];
    const lead = videos[0];
    if (!lead) return;
    for (const v of videos) v.muted = true;
    if (!live) {
      lead.pause();
      return;
    }
    const again = () => {
      lead.currentTime = 0;
      lead.play().catch(() => {});
    };
    lead.addEventListener("ended", again);
    lead.play().catch(() => {});
    return () => lead.removeEventListener("ended", again);
  }, [live]);
  return (
    <div ref={box}>
      <Compare a={CLONE.a} b={CLONE.b} label="Against the source" aLabel="Source" bLabel="AI4Kanban" shots={CLONE.shots} />
    </div>
  );
}

function Draft({ kind, live, view }: { kind: Kind; live: boolean; view: RefObject<HTMLDivElement | null> }) {
  switch (kind) {
    case "coding":
      return <Coding />;
    case "blog":
      return <Blog live={live} view={view} />;
    case "video":
      return (
        <Paged pages={PAGES.video!} live={live}>
          <Storyboard view={STORYBOARD} label="Storyboard" />
        </Paged>
      );
    case "slides":
      return (
        <Paged pages={PAGES.slides!} live={live}>
          <Storyboard view={DECK} />
        </Paged>
      );
    case "carousel":
      // Still: paging it clicks the current slide, which opens it enlarged.
      return <Storyboard view={CAROUSEL} label="3x4" />;
    case "clone":
      return <Clone live={live} />;
  }
}

export default function DraftSlice({ kind }: { kind: string }) {
  const fit = useFit(kind);
  const view = useRef<HTMLDivElement>(null);
  const live = useLive(view);
  const clipped = useClipped(view);
  return (
    <div
      ref={view}
      className="relative flex flex-col overflow-hidden bg-nb-sheet text-nb-ink [justify-content:safe_center]"
      style={fit ? { width: fit.w, height: fit.h, transform: `scale(${fit.scale})`, transformOrigin: "0 0" } : { visibility: "hidden" }}
    >
      <div className="shrink-0 truncate px-4 pt-4 text-[17px] font-[800] tracking-[-0.01em]">{TITLES[kind as Kind]}</div>
      <div className="nb-md shrink-0 text-[14px] leading-[1.7] [&_span:has(>video)]:!bg-nb-wash">
        {fit && <Draft kind={kind as Kind} live={live} view={view} />}
      </div>
      {clipped && <span className="pointer-events-none sticky bottom-0 -mt-16 block h-16 shrink-0 bg-gradient-to-b from-transparent to-nb-paper" />}
    </div>
  );
}
