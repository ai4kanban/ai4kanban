"use client";

// A `<Compare>` (#1740): two images or two videos, each whole at its own ratio, framed like an
// `<Asset>`. Landscape A stacks A over B; portrait A puts them side by side. Videos share one
// play bar: A leads, B follows muted, is pulled back when it drifts, and holds its last frame
// once it runs out. With `shots` the bar is cut into one segment per shot.
//
// Full size opens the block over the page, in this window (#1776); the ⋯ menu downloads either
// side.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiDownload, FiMaximize2, FiPause, FiPlay } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { Shot } from "@/lib/format/compare";
import type { MockupView } from "@/lib/mockup-tag";
import { PreviewDialog } from "./image-preview";
import { clock } from "./MediaPlayer";
import { Caption, DraftFrame, ICON_BTN, Note, useFold, type MenuItem } from "./Mockup";

const nameOf = (src: string) => src.split("/").pop()!;
const kindOf = (v: MockupView) => (v.image !== undefined ? "image" : v.media?.kind === "video" ? "video" : null);

export function Compare({
  a,
  b,
  label,
  aLabel,
  bLabel,
  shots,
}: {
  a: MockupView;
  b: MockupView;
  label: string;
  aLabel: string;
  bLabel: string;
  shots?: Shot[];
}) {
  const c = useCopy().card.compare;
  for (const v of [a, b]) {
    if (v.error !== undefined) return <Note text={v.error} />;
    if (!kindOf(v)) return <Note text={c.unsupported(nameOf(v.src))} />;
  }
  if (kindOf(a) !== kindOf(b)) return <Note text={c.mismatch} />;
  return <Frame a={a} b={b} label={label} names={[aLabel || nameOf(a.src), bLabel || nameOf(b.src)]} shots={shots} />;
}

type Ratios = [number | null, number | null];
type PaneProps = { name: string; ratio: number | null; max: string; bg: string };

/** How tall one side may be, so both fit one screen: stacked, half of it each. Full size takes
 *  off the preview's padding, the caption and the play bar. */
const maxHeight = (stacked: boolean, full: boolean, video: boolean) =>
  stacked
    ? full
      ? `calc(50dvh - ${video ? 95 : 62}px)`
      : "max(180px, calc(50vh - 110px))"
    : full
      ? `calc(100dvh - ${video ? 190 : 125}px)`
      : "max(320px, calc(100vh - 220px))";

type FrameProps = { a: MockupView; b: MockupView; label: string; names: [string, string]; shots?: Shot[] };

function Frame(props: FrameProps) {
  const c = useCopy().card.mockup;
  const menu = useDownloads(props);
  const box = useRef<HTMLSpanElement>(null);
  const [full, setFull] = useState(false);
  const fold = useFold();
  const open = () => {
    // One side plays with sound; the copy under the preview must not play along.
    for (const v of box.current?.querySelectorAll("video") ?? []) v.pause();
    setFull(true);
  };
  return (
    <DraftFrame ref={box}>
      <Caption label={props.label} variants={null} menu={menu} {...fold}>
        <button type="button" onClick={open} className={ICON_BTN} data-tip={c.openFull} aria-label={c.openFull}>
          <FiMaximize2 aria-hidden size={13} />
        </button>
      </Caption>
      {fold.open && <Body {...props} full={false} />}
      {full && (
        <PreviewDialog label={props.label} onClose={() => setFull(false)}>
          <span onClick={(e) => e.stopPropagation()} className="block w-[calc(100vw-128px)] bg-nb-paper shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <Caption label={props.label} variants={null} menu={menu} />
            <Body {...props} full />
          </span>
        </PreviewDialog>
      )}
    </DraftFrame>
  );
}

/** Each side's own file, under its own name. */
function useDownloads({ a, b, names }: FrameProps): MenuItem[] {
  const c = useCopy().card.compare;
  return [a, b].map((v, side) => ({
    icon: <FiDownload size={13} />,
    text: c.downloadSide(names[side]!),
    href: v.image ?? v.media!.href,
    download: nameOf(v.src),
  }));
}

function Body({ a, b, names, shots, full }: FrameProps & { full: boolean }) {
  const c = useCopy().card.mockup;
  const [ratios, setRatios] = useState<Ratios>([null, null]);
  const [failed, setFailed] = useState(false);
  const ratio = useCallback(
    (side: 0 | 1, w: number, h: number) => {
      if (w && h) setRatios((r) => (r[side] === w / h ? r : side ? [r[0], w / h] : [w / h, r[1]]));
    },
    [],
  );
  const fail = useCallback(() => setFailed(true), []);
  // Stable, or each render's new ref would measure again and render again.
  const measure = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) ratio(Number(img.dataset.side) as 0 | 1, img.naturalWidth, img.naturalHeight);
    },
    [ratio],
  );
  if (failed) return <Note text={c.unplayable} />;
  const video = a.media !== undefined;
  const stacked = (ratios[0] ?? 16 / 9) >= 1;
  const max = maxHeight(stacked, full, video);
  const panes = ([0, 1] as const).map((side) => ({ name: names[side], ratio: ratios[side], max, bg: video ? "#000" : "var(--color-nb-wash)" }));
  return video ? (
    <Videos a={a.media!.href} b={b.media!.href} panes={panes} stacked={stacked} shots={shots} ratio={ratio} fail={fail} />
  ) : (
    <Sides stacked={stacked}>
      {[a, b].map((v, side) => (
        <Pane key={side} {...panes[side]!}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine */}
          <img
            src={v.image}
            alt={panes[side]!.name}
            data-side={side}
            ref={measure}
            onLoad={(e) => measure(e.currentTarget)}
            className="absolute inset-0 size-full object-contain"
            style={{ width: "100%", height: "100%", maxWidth: "none", border: 0, borderRadius: 0 }}
          />
        </Pane>
      ))}
    </Sides>
  );
}

/** A beside B, or A over B, with a hairline of the page between them. */
function Sides({ stacked, children }: { stacked: boolean; children: React.ReactNode }) {
  return <span className={`flex items-start gap-[2px] ${stacked ? "flex-col" : "[&>*]:min-w-0 [&>*]:flex-1"}`}>{children}</span>;
}

/** One side: the picture whole at its own ratio, letterboxed when its height is capped. */
function Pane({ name, ratio, max, bg, children }: PaneProps & { children: React.ReactNode }) {
  return (
    <span className="relative block w-full overflow-hidden" style={{ aspectRatio: ratio ?? 16 / 9, maxHeight: max, background: bg }}>
      {children}
      <span
        className="pointer-events-none absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] truncate rounded-[6px] px-2 py-[2px] text-[11.5px] font-[700] text-white"
        style={{ background: "rgba(0,0,0,.55)" }}
      >
        {name}
      </span>
    </span>
  );
}

const RATES = [1, 1.5, 2, 0.5];
/** How far B may drift from A, in seconds, before it is pulled back. */
const DRIFT = 0.25;

function Videos({
  a,
  b,
  panes,
  stacked,
  shots,
  ratio,
  fail,
}: {
  a: string;
  b: string;
  panes: PaneProps[];
  stacked: boolean;
  shots?: Shot[];
  ratio: (side: 0 | 1, w: number, h: number) => void;
  fail: () => void;
}) {
  const va = useRef<HTMLVideoElement>(null);
  const vb = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  const follow = useCallback(() => {
    const A = va.current;
    const B = vb.current;
    if (!A || !B) return;
    const t = A.currentTime;
    if (Number.isFinite(B.duration) && t >= B.duration) {
      if (!B.paused) B.pause();
      if (B.currentTime < B.duration - 0.05) B.currentTime = B.duration;
      return;
    }
    if (Math.abs(B.currentTime - t) > DRIFT) B.currentTime = t;
    if (!A.paused && B.paused) B.play().catch(() => {});
  }, []);

  const meta = useCallback(
    (side: 0 | 1) => {
      const el = (side ? vb : va).current;
      if (!el) return;
      if (el.error) return fail();
      if (el.readyState < HTMLMediaElement.HAVE_METADATA) return;
      ratio(side, el.videoWidth, el.videoHeight);
      if (!side) setDuration(el.duration);
    },
    [fail, ratio],
  );
  // Metadata or an error that arrived before hydration never reaches the handlers.
  useEffect(() => {
    meta(0);
    meta(1);
  }, [meta]);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      if (va.current) setTime(va.current.currentTime);
      follow();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, follow]);

  const toggle = () => {
    const A = va.current;
    if (!A) return;
    if (A.paused) A.play().catch(() => {});
    else A.pause();
  };
  const seek = (t: number) => {
    const A = va.current;
    if (!A) return;
    A.currentTime = Math.max(0, Math.min(t, duration || t));
    setTime(A.currentTime);
    follow();
  };
  const speed = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    setRate(next);
    for (const v of [va.current, vb.current]) if (v) v.playbackRate = next;
  };
  const stop = () => {
    setPlaying(false);
    vb.current?.pause();
  };

  const video = (side: 0 | 1) => (
    <video
      ref={side ? vb : va}
      src={side ? b : a}
      preload="metadata"
      playsInline
      muted={side === 1}
      onClick={toggle}
      onError={fail}
      onLoadedMetadata={() => meta(side)}
      {...(side
        ? {}
        : {
            onPlay: () => setPlaying(true),
            onPause: stop,
            onEnded: stop,
            onSeeked: () => {
              setTime(va.current!.currentTime);
              follow();
            },
          })}
      className="absolute inset-0 size-full cursor-pointer object-contain"
    />
  );

  return (
    <>
      <Sides stacked={stacked}>
        {panes.map((pane, side) => (
          <Pane key={side} {...pane}>
            {video(side as 0 | 1)}
          </Pane>
        ))}
      </Sides>
      <PlayBar playing={playing} time={time} duration={duration} rate={rate} shots={shots} toggle={toggle} seek={seek} speed={speed} />
    </>
  );
}

const STEP =
  "nb-tip grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink";

function PlayBar({
  playing,
  time,
  duration,
  rate,
  shots,
  toggle,
  seek,
  speed,
}: {
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  shots?: Shot[];
  toggle: () => void;
  seek: (t: number) => void;
  speed: () => void;
}) {
  const c = useCopy().card;
  const at = shots ? Math.max(0, shots.findLastIndex((s) => s.start <= time + 0.01)) : -1;
  const shot = shots?.[at];
  const go = (i: number) => shots && seek(shots[Math.max(0, Math.min(shots.length - 1, i))]!.start);
  return (
    <span className="relative z-10 flex flex-col gap-2.5 px-4 pb-1 pt-3">
      <Track shots={shots} time={time} duration={duration} seek={seek} />
      <span className="flex items-center gap-2">
        <span className="-ml-1.5 flex items-center">
          {shots && (
            <button type="button" aria-label={c.compare.prevShot} data-tip={c.compare.prevShot} className={STEP} onClick={() => go(at - 1)}>
              <FiChevronLeft aria-hidden size={15} />
            </button>
          )}
          <button type="button" aria-label={playing ? c.mockup.pause : c.mockup.play} data-tip={playing ? c.mockup.pause : c.mockup.play} className={STEP} onClick={toggle}>
            {playing ? <FiPause aria-hidden size={14} fill="currentColor" /> : <FiPlay aria-hidden size={14} fill="currentColor" />}
          </button>
          {shots && (
            <button type="button" aria-label={c.compare.nextShot} data-tip={c.compare.nextShot} className={STEP} onClick={() => go(at + 1)}>
              <FiChevronRight aria-hidden size={15} />
            </button>
          )}
        </span>
        {shot && (
          <span className="min-w-0 truncate text-[12.5px] font-[700] text-nb-ink">
            {shot.id}
            <span className="font-[600] text-nb-ink-soft"> / {shots!.length} · </span>
            {shot.name}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[12.5px] font-[600] tabular-nums text-nb-ink">
          {clock(time)}
          <span className="text-nb-ink-soft"> / {clock(duration)}</span>
        </span>
        <button
          type="button"
          aria-label={c.compare.speed}
          data-tip={c.compare.speed}
          onClick={speed}
          className="nb-tip shrink-0 cursor-pointer rounded-[6px] px-1.5 py-[2px] text-[12.5px] font-[700] tabular-nums text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink"
        >
          {rate}×
        </button>
      </span>
    </span>
  );
}

/** The progress track: one segment per shot, as wide as it lasts, or one plain bar. A click on a
 *  shot jumps to its start; a drag scrubs. */
function Track({ shots, time, duration, seek }: { shots?: Shot[]; time: number; duration: number; seek: (t: number) => void }) {
  const track = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const segments = shots ?? [{ id: "", start: 0, end: duration || 1, name: "" }];
  const gap = segments.length * 3 + (segments.length - 1) * 2 > width ? 1 : 2;

  /** The segment under `x`, and the time there. */
  const pointAt = (x: number) => {
    const kids = [...track.current!.children].slice(0, segments.length) as HTMLElement[];
    let i = kids.findIndex((k) => x < k.getBoundingClientRect().right);
    if (i < 0) i = kids.length - 1;
    const r = kids[i]!.getBoundingClientRect();
    const s = segments[i]!;
    const f = Math.max(0, Math.min(1, (x - r.left) / r.width));
    return { i, t: s.start + f * (s.end - s.start) };
  };

  const tip = hover !== null && shots ? shots[hover] : null;
  const tipAt = (() => {
    if (hover === null || !track.current) return null;
    const kid = track.current.children[hover] as HTMLElement | undefined;
    if (!kid) return null;
    const x = kid.offsetLeft + kid.offsetWidth / 2;
    return x < width * 0.2 ? { left: kid.offsetLeft } : x > width * 0.8 ? { right: width - kid.offsetLeft - kid.offsetWidth } : { left: x, transform: "translateX(-50%)" };
  })();

  return (
    <span
      ref={track}
      className="relative -my-1.5 flex h-[18px] w-full cursor-pointer touch-none items-center py-1.5"
      style={{ gap }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d && (d.moved || Math.abs(e.clientX - d.x) > 3)) {
          d.moved = true;
          seek(pointAt(e.clientX).t);
        }
        if (shots) setHover(pointAt(e.clientX).i);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved) return;
        const p = pointAt(e.clientX);
        seek(shots ? shots[p.i]!.start : p.t);
      }}
      onPointerLeave={() => setHover(null)}
    >
      {segments.map((s, i) => {
        const fill = Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start)));
        return (
          <span key={i} className="relative block h-[6px]" style={{ flex: `${s.end - s.start} 0 0`, minWidth: 3 }}>
            <span className={`absolute inset-0 block rounded-[2px] ${i === hover ? "bg-nb-ink-soft/40" : "bg-nb-wash"}`} />
            {fill > 0 && <span className="absolute inset-y-0 left-0 block rounded-[2px] bg-nb-accent" style={{ width: `${fill * 100}%` }} />}
          </span>
        );
      })}
      {tip && tipAt && (
        <span
          className="pointer-events-none absolute bottom-[22px] z-10 block whitespace-nowrap rounded-[6px] bg-nb-ink px-2 py-1 text-[11.5px] font-[600] text-nb-paper"
          style={tipAt}
        >
          {tip.id} · {tip.name} · {clock(tip.start)}
        </span>
      )}
    </span>
  );
}
