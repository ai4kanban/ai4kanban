// The card page's canvas view (#12): each preview section is one group, the previews the body
// does not name one more, in a row on a ground that pans and zooms. Laid out by itself; a
// drag never moves a group.

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiMaximize, FiMinus, FiPlus } from "react-icons/fi";
import type { PreviewPiece } from "@review/components/CardBody";
import { HAIRLINE } from "@review/components/chrome";
import { Markdown, PreviewOf, type CardLink } from "@review/components/Markdown";
import { ShieldFrames } from "@review/components/zoom";
import type { Previews } from "@review/lib/artifacts";
import { eachLine } from "@review/lib/agent-half";
import { compareTag } from "@review/lib/format/compare";
import { storyboardAttrs } from "@review/lib/format/storyboard";
import { mockupBlock } from "@review/lib/mockup-tag";
import { cn } from "@review/lib/utils";
import { T } from "../i18n";

const MIN = 0.1;
const MAX = 2;
const STEP = 1.25;
const PAD = 24;
/** Room under the row for the zoom controls. */
const PAD_BOTTOM = 64;
/** Below this the canvas stops shrinking to end at the window's bottom, and the page scrolls to it. */
const MIN_HEIGHT = 360;

type View = { x: number; y: number; s: number };
type Tile = { key: string; body: string; text?: true; phone?: true };
type Group = { key: string; name: string; tiles: Tile[] };

const TAG = /<(?:Asset|Mockup)\b[^<>]*?\/>/g;

/** A body's paragraphs, a fenced block kept whole. */
function paragraphs(md: string): string[] {
  const out: string[] = [];
  let at: string[] = [];
  eachLine(md, (line, fenced) => {
    if (!fenced && !line.trim()) {
      if (at.length) out.push(at.join("\n"));
      at = [];
    } else at.push(line);
  });
  if (at.length) out.push(at.join("\n"));
  return out;
}

/** One section's tiles: its prose as one, then every drawn tag as its own. */
function tilesOf(p: PreviewPiece): Tile[] {
  const text: string[] = [];
  const drawn: Tile[] = [];
  const take = (md: string) =>
    paragraphs(md)
      .filter((para) => {
        const tags = mockupBlock(para);
        if (tags) {
          for (const [i, raw] of (para.match(TAG) ?? []).entries())
            drawn.push({ key: `${p.key}/${drawn.length}`, body: raw, ...(tags[i]?.device === "mobile" && { phone: true as const }) });
          return false;
        }
        if (storyboardAttrs(para) || compareTag(para)) return void drawn.push({ key: `${p.key}/${drawn.length}`, body: para.trim() });
        return true;
      })
      .join("\n\n");
  const intro = take(p.intro);
  if (intro) text.push(intro);
  for (const s of p.subs) {
    const rest = take(s.body);
    if (rest) text.push(`### ${s.heading}\n\n${rest}`);
  }
  return [...(text.length ? [{ key: `${p.key}/text`, body: text.join("\n\n"), text: true as const }] : []), ...drawn];
}

const clamp = (s: number) => Math.min(MAX, Math.max(MIN, s));

/** The view showing every group, centered across and from the top. */
function fitOf(area: { w: number; h: number }, row: { w: number; h: number }): View | null {
  if (!area.w || !row.w) return null;
  const s = clamp(Math.min(1, (area.w - 2 * PAD) / row.w, (area.h - PAD - PAD_BOTTOM) / row.h));
  return { s, x: Math.max(PAD, (area.w - row.w * s) / 2), y: PAD };
}

/** Where a touch may not start a pinch: controls. A pan also skips prose a reader may select. */
const NO_PINCH = 'button, a, input, textarea, select, summary, video, audio, [role="slider"], [role="menu"]';
const NO_PAN = `${NO_PINCH}, [data-canvas-text]`;

export function Canvas({
  sections,
  extra,
  previews,
  nameOf,
  cardLink,
}: {
  sections: PreviewPiece[];
  extra: string[];
  previews: Previews;
  nameOf: (agent: string) => string;
  cardLink?: CardLink;
}) {
  const groups = useMemo<Group[]>(
    () => [
      ...sections.map((p) => ({ key: p.key, name: nameOf(p.name), tiles: tilesOf(p) })),
      ...(extra.length ? [{ key: "extra", name: T.canvas.other, tiles: extra.map((id) => ({ key: id, body: id })) }] : []),
    ],
    [sections, extra, nameOf],
  );
  const root = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; left: number; height: number } | null>(null);
  const [sizes, setSizes] = useState({ area: { w: 0, h: 0 }, row: { w: 0, h: 0 } });
  // null follows the fit until the reader pans or zooms.
  const [moved, setMoved] = useState<View | null>(null);
  const fit = fitOf(sizes.area, sizes.row);
  const view = moved ?? fit;
  const latest = useRef(view);
  latest.current = view;

  // As wide as the page's scroller, and down to its bottom.
  useLayoutEffect(() => {
    const el = root.current;
    const pane = el?.closest<HTMLElement>("[data-canvas-pane]");
    if (!el || !pane) return;
    const place = () => {
      const parent = el.parentElement!;
      const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
      const height = Math.round(Math.min(pane.clientHeight, Math.max(MIN_HEIGHT, pane.clientHeight - top)));
      const width = pane.clientWidth;
      const left = Math.round((parent.clientWidth - width) / 2);
      setBox((b) => (b && b.width === width && b.left === left && b.height === height ? b : { width, left, height }));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(pane);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const a = area.current;
    const r = row.current;
    if (!a || !r) return;
    const measure = () =>
      setSizes((p) => {
        const next = { area: { w: a.clientWidth, h: a.clientHeight }, row: { w: r.offsetWidth, h: r.offsetHeight } };
        return JSON.stringify(next) === JSON.stringify(p) ? p : next;
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(a);
    ro.observe(r);
    return () => ro.disconnect();
  }, []);

  // The wheel pans, a pinch or ctrl+wheel zooms at the pointer — caught before any preview's own.
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    const onWheel = (e: WheelEvent) => {
      const v = latest.current;
      if (!v) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey) {
        const r = a.getBoundingClientRect();
        setMoved(zoomAt(v, Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) / 100), e.clientX - r.left, e.clientY - r.top));
      } else {
        const k = e.deltaMode === 1 ? 16 : 1;
        setMoved({ ...v, x: v.x - e.deltaX * k, y: v.y - e.deltaY * k });
      }
    };
    a.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => a.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  // A drag from anywhere but a control or prose pans; a press that never moved stays a click.
  // Two fingers anywhere but a control pinch-zoom at their midpoint.
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    let drag: { id: number; x: number; y: number; from: View; on: boolean } | null = null;
    let dragged = false;
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { ids: [number, number]; d: number; mx: number; my: number; from: View; now: View } | null = null;
    const two = () => {
      const p = touches.get(pinch!.ids[0])!;
      const q = touches.get(pinch!.ids[1])!;
      const r = a.getBoundingClientRect();
      return { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, mx: (p.x + q.x) / 2 - r.left, my: (p.y + q.y) / 2 - r.top };
    };
    const down = (e: PointerEvent) => {
      const v = latest.current;
      if (e.button !== 0 || !v) return;
      const target = e.target as Element;
      if (e.pointerType === "touch" && !target.closest?.(NO_PINCH)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          drag = null;
          dragged = true;
          for (const id of touches.keys()) a.setPointerCapture(id);
          pinch = { ids: [...touches.keys()] as [number, number], d: 0, mx: 0, my: 0, from: v, now: v };
          Object.assign(pinch, two());
          return;
        }
      }
      if (pinch || target.closest?.(NO_PAN)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: v, on: false };
    };
    const move = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) {
        if (!pinch.ids.includes(e.pointerId)) return;
        const { d, mx, my } = two();
        const z = zoomAt(pinch.from, d / pinch.d, pinch.mx, pinch.my);
        pinch.now = { ...z, x: z.x + mx - pinch.mx, y: z.y + my - pinch.my };
        setMoved(pinch.now);
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.on && Math.hypot(dx, dy) < 4) return;
      if (!drag.on) {
        drag.on = dragged = true;
        a.setPointerCapture(e.pointerId);
      }
      setMoved({ ...drag.from, x: drag.from.x + dx, y: drag.from.y + dy });
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (pinch?.ids.includes(e.pointerId)) {
        // The other finger pans on from where it is.
        const id = pinch.ids.find((i) => i !== e.pointerId)!;
        const rest = touches.get(id);
        drag = rest ? { id, x: rest.x, y: rest.y, from: pinch.now, on: true } : null;
        pinch = null;
      } else if (drag?.id !== e.pointerId) return;
      else drag = null;
      // Past the click this release fires.
      if (!drag) setTimeout(() => (dragged = false));
    };
    const click = (e: MouseEvent) => {
      if (!dragged) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const noDrag = (e: DragEvent) => e.preventDefault();
    // Safari's own pinch zooms the page.
    const noGesture = (e: Event) => e.preventDefault();
    a.addEventListener("pointerdown", down);
    a.addEventListener("pointermove", move);
    a.addEventListener("pointerup", up);
    a.addEventListener("pointercancel", up);
    a.addEventListener("click", click, true);
    a.addEventListener("dragstart", noDrag);
    a.addEventListener("gesturestart", noGesture);
    a.addEventListener("gesturechange", noGesture);
    return () => {
      a.removeEventListener("pointerdown", down);
      a.removeEventListener("pointermove", move);
      a.removeEventListener("pointerup", up);
      a.removeEventListener("pointercancel", up);
      a.removeEventListener("click", click, true);
      a.removeEventListener("dragstart", noDrag);
      a.removeEventListener("gesturestart", noGesture);
      a.removeEventListener("gesturechange", noGesture);
    };
  }, []);

  const zoomBy = (f: number) => view && setMoved(zoomAt(view, f, sizes.area.w / 2, sizes.area.h / 2));

  return (
    <section
      ref={root}
      className="relative shrink-0 overflow-hidden"
      style={box ? { width: box.width, marginLeft: box.left, height: box.height } : { height: 480 }}
    >
      {/* The ground fades up into the page; the groups on it never do. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "var(--color-nb-canvas)",
          backgroundImage: `radial-gradient(${HAIRLINE} 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(to top, #000 55%, transparent)",
        }}
      />
      <div ref={area} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing">
        <div
          ref={row}
          className="absolute left-0 top-0 flex origin-top-left items-start gap-6"
          style={{ transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.s})` : undefined, visibility: view ? undefined : "hidden" }}
        >
          <Groups groups={groups} previews={previews} cardLink={cardLink} />
        </div>
      </div>
      {view && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-[10px] bg-nb-paper p-1" style={{ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }}>
          <ZoomButton label={T.canvas.zoomOut} disabled={view.s <= MIN + 0.001} onClick={() => zoomBy(1 / STEP)}>
            <FiMinus size={14} aria-hidden />
          </ZoomButton>
          <span className="w-10 text-center text-[12px] font-[600] tabular-nums text-nb-ink">{Math.round(view.s * 100)}%</span>
          <ZoomButton label={T.canvas.zoomIn} disabled={view.s >= MAX - 0.001} onClick={() => zoomBy(STEP)}>
            <FiPlus size={14} aria-hidden />
          </ZoomButton>
          <span className="mx-0.5 h-4 w-px" style={{ background: HAIRLINE }} />
          <ZoomButton label={T.canvas.fit} disabled={!moved} onClick={() => setMoved(null)}>
            <FiMaximize size={13} aria-hidden />
          </ZoomButton>
        </div>
      )}
    </section>
  );
}

/** `f` times the scale, the point (`px`, `py`) of the area staying put. */
function zoomAt(v: View, f: number, px: number, py: number): View {
  const s = clamp(v.s * f);
  return { s, x: px - ((px - v.x) * s) / v.s, y: py - ((py - v.y) * s) / v.s };
}

function ZoomButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

// Memoised: a pan re-renders the transform only, never the previews.
const Groups = memo(function Groups({ groups, previews, cardLink }: { groups: Group[]; previews: Previews; cardLink?: CardLink }) {
  return (
    <ShieldFrames.Provider value>
      {groups.map((g) => (
        <div key={g.key} className="flex w-[560px] shrink-0 flex-col gap-2.5 rounded-[14px] bg-nb-sheet p-3.5" style={{ boxShadow: `0 0 0 1px ${HAIRLINE}` }}>
          <div className="flex items-center gap-2 px-0.5">
            <span className="min-w-0 truncate text-[13.5px] font-[800] text-nb-ink">{g.name}</span>
            <span className="text-[12px] tabular-nums text-nb-ink-soft">{g.tiles.length}</span>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {g.tiles.map((t) =>
              t.text ? (
                <div key={t.key} data-canvas-text className="w-full cursor-auto select-text rounded-[10px] bg-nb-paper p-4" style={{ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }}>
                  <Markdown body={t.body} previews={previews} cardLink={cardLink} />
                </div>
              ) : (
                <div key={t.key} className={cn("min-w-0 [&_.nb-draft]:my-0 [&_.nb-md>*]:my-0", t.phone ? "w-[200px] shrink-0" : "flex-[1_1_240px]")}>
                  {g.key === "extra" ? <PreviewOf view={previews.viewOfArtifact(t.body)} /> : <Markdown body={t.body} previews={previews} cardLink={cardLink} />}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </ShieldFrames.Provider>
  );
});
