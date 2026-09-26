"use client";

// The board's Insights dialog, opened from a chart button in the header. A period picker, a
// trend chart or a daily heatmap of docs/kanban/metrics.csv, the period's totals, and what
// runs and chats consumed on this machine by connector and model (#1067).
//
// Plain SVG and CSS grids, no charting library.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FiChevronRight, FiTrendingUp } from "react-icons/fi";
import { getMetricsAction, getUsageAction } from "@/app/actions";
import type { RailCopy } from "@/i18n/rail/types";
import { useCopy } from "@/i18n/use-copy";
import { usePhone } from "@/lib/media";
import type { MetricsDay, MetricsResult, UsageResult, UsageRow as Row } from "@/lib/types";

import { formatCost, formatTokens } from "./agent-shared";
import { AgentMark } from "./Configuration";
import { PHONE_ROW, TOOL_BTN } from "./chrome";
import { Dialog } from "./Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Copy = RailCopy["insights"];
type SeriesKey = "completed" | "created" | "rejected";
type View = "trend" | "activity";
type Period = keyof Copy["periods"];

const PERIODS: Record<Period, number> = { "30d": 30, "3m": 90, "6m": 180, "1y": 365 };

// Three distinct hues that hold up on the cream/paper canvas: the board's mint,
// sky and ember inks, darkened enough to read as thin lines.
const SERIES: { key: SeriesKey; color: string }[] = [
  { key: "completed", color: "#2f6b46" },
  { key: "created", color: "#2c5c86" },
  { key: "rejected", color: "#b83a12" },
];

export function Insights({ row = false }: { row?: boolean }) {
  const c = useCopy().rail.insights;
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* A tool in the header's cluster (components/chrome.tsx); `row` is the same button on
          the phone's More screen (#357). */}
      {row ? (
        <button type="button" className={PHONE_ROW} onClick={() => setOpen(true)}>
          <FiTrendingUp size={17} className="shrink-0 text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1">{c.open}</span>
          <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
        </button>
      ) : (
      <button
        type="button"
        className={TOOL_BTN}
        data-tip={c.open}
        aria-label={c.open}
        onClick={() => setOpen(true)}
      >
        <FiTrendingUp size={15} aria-hidden />
      </button>
      )}

      {open && (
        <Dialog title={c.title} onClose={() => setOpen(false)} width={760}>
          <InsightsBody />
        </Dialog>
      )}
    </>
  );
}

// ---- the body ---------------------------------------------------------------

// Reads on mount and on every period change — the dialog only mounts while open, so every
// open is a fresh read. Nothing polls.
function InsightsBody() {
  const c = useCopy().rail.insights;
  const [period, setPeriod] = useState<Period>("30d");
  const [view, setView] = useState<View>("trend");
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [usage, setUsage] = useState<UsageResult | null>(null);

  useEffect(() => {
    let alive = true;
    const days = PERIODS[period];
    const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) });
    setMetrics(null);
    setUsage(null);
    getMetricsAction(days)
      .then((r) => alive && setMetrics(r))
      .catch((e) => alive && setMetrics(fail(e)));
    getUsageAction(days)
      .then((r) => alive && setUsage(r))
      .catch((e) => alive && setUsage(fail(e)));
    return () => {
      alive = false;
    };
  }, [period]);

  const shown = metrics?.ok ? metrics.view : null;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-auto px-2.5 py-1 text-[12.5px] font-[700]" aria-label={c.title}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODS) as Period[]).map((p) => (
              <SelectItem key={p} value={p}>
                {c.periods[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {shown && !shown.empty && (
          <div className="flex shrink-0 items-center gap-0.5" role="tablist">
            {(["trend", "activity"] as const).map((v) => (
              <Tab key={v} label={c.views[v]} on={view === v} onPick={() => setView(v)} />
            ))}
          </div>
        )}
      </div>

      <Frame>
        {!metrics ? (
          <Note text={c.daily.reading} />
        ) : !metrics.ok ? (
          <div className="min-h-0 overflow-y-auto">
            <Failure text={metrics.error} />
          </div>
        ) : metrics.view.empty ? (
          <Note text={c.daily.empty} />
        ) : view === "trend" ? (
          <Chart days={metrics.view.days} weekly={PERIODS[period] > 90} />
        ) : PERIODS[period] > 31 ? (
          <WeekGrid days={metrics.view.days} />
        ) : (
          <DayRow days={metrics.view.days} />
        )}
      </Frame>
      <Totals totals={shown && !shown.empty ? shown.totals : null} />

      <Usage result={usage} days={PERIODS[period]} />
    </>
  );
}

// The Notifications header's tabs.
function Tab({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onPick}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-[7px] px-1.5 py-[3px] text-[11.5px] font-[700] ${
        on
          ? "text-nb-ink"
          : "text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] hover:text-nb-ink"
      }`}
      style={on ? { background: "color-mix(in srgb, var(--color-nb-ink) 8%, transparent)" } : undefined}
    >
      {label}
    </button>
  );
}

// The same peach panel the goal editor reports a failed save in. It carries a file path, so
// it wraps rather than pushing the dialog wide.
function Failure({ text }: { text: string }) {
  return (
    <div
      className="nb-panel-sm break-words p-2.5 text-[12px] leading-relaxed"
      style={{ background: "var(--color-nb-peach-soft)" }}
    >
      {text}
    </div>
  );
}

// Every view, period and state draws in this one height, so nothing below it moves.
const FRAME_H = 200;

function Frame({ children }: { children: ReactNode }) {
  const phone = usePhone();
  return (
    <figure
      className={`m-0 flex flex-col rounded-[10px] bg-nb-wash/30 py-3 ${phone ? "px-3" : "px-5"}`}
      style={{ height: FRAME_H }}
    >
      {children}
    </figure>
  );
}

function Note({ text }: { text: string }) {
  return <p className="m-auto text-[13px] text-nb-ink-soft">{text}</p>;
}

/** The element's content width in px, kept current — the charts draw at real size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const watch = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, width] as const;
}

// `null` without data: the same row with dashes, so the usage below doesn't jump.
function Totals({ totals }: { totals: Record<SeriesKey, number> | null }) {
  const c = useCopy().rail.insights.daily;
  return (
    <dl className="m-0 mt-3 grid grid-cols-3 text-center">
      {SERIES.map((s, i) => (
        <div key={s.key} className={i ? "border-l border-nb-ink/10" : ""}>
          <dd className="m-0 text-[22px] font-[800] tracking-[-0.02em] text-nb-ink">{totals ? totals[s.key] : "–"}</dd>
          <dt className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-nb-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {c[s.key]}
          </dt>
        </div>
      ))}
    </dl>
  );
}

// `YYYY-MM-DD` → a local Date, and the copy's own way of saying it.
const toDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const say = (c: Copy, date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return c.date(m, d);
};

/** Arrow keys over a strip of cells: `step` for left/right, `row` for up/down. */
function moveBy(e: KeyboardEvent, at: number, count: number, step: number, row: number): number | null {
  const by = { ArrowLeft: -step, ArrowRight: step, ArrowUp: -row, ArrowDown: row }[e.key];
  if (by === undefined) return null;
  e.preventDefault();
  return Math.min(count - 1, Math.max(0, at + by));
}

// ---- trend ------------------------------------------------------------------

// The frame less its padding and the legend row.
const H = FRAME_H - 24 - 26;
const PAD = { t: 8, r: 8, b: 22, l: 30 };

// A y-axis that fits the data: the smallest of these steps that keeps the axis to four
// intervals or fewer.
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];

function yAxis(max: number): { top: number; ticks: number[] } {
  const target = Math.max(1, max);
  const step = STEPS.find((s) => target / s <= 4) ?? Math.ceil(target / 4);
  const top = Math.ceil(target / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

type Point = Record<SeriesKey, number> & { date: string; label: string };

// Long periods are summed by Monday-first week, so the line stays readable.
function points(c: Copy, days: MetricsDay[], weekly: boolean): Point[] {
  if (!weekly) return days.map((d) => ({ ...d, label: say(c, d.date) }));
  const out: (Point & { last: string })[] = [];
  for (const d of days) {
    const cur = out[out.length - 1];
    if (!cur || toDate(d.date).getDay() === 1) {
      out.push({ date: d.date, last: d.date, label: "", completed: d.completed, created: d.created, rejected: d.rejected });
    } else {
      cur.last = d.date;
      for (const s of SERIES) cur[s.key] += d[s.key];
    }
  }
  return out.map(({ last, ...p }) => ({ ...p, label: c.week(say(c, p.date), say(c, last)) }));
}

function Chart({ days, weekly }: { days: MetricsDay[]; weekly: boolean }) {
  const c = useCopy().rail.insights;
  const pts = points(c, days, weekly);
  const [at, setAt] = useState<number | null>(null);
  const [plot, W] = useWidth<HTMLDivElement>();
  const max = Math.max(...pts.flatMap((d) => SERIES.map((s) => d[s.key])));
  const { top, ticks } = yAxis(max);

  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, pts.length - 1);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const line = (key: SeriesKey) => pts.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");

  const pick = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !W) return;
    const vx = clientX - box.left;
    setAt(Math.min(pts.length - 1, Math.max(0, Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1)))));
  };
  const hovered = at === null ? null : pts[at];
  const left = at === null || !W ? 0 : (x(at) / W) * 100;

  return (
    <>
      <div className="mb-2 flex h-[18px] items-center gap-x-5 overflow-hidden whitespace-nowrap text-[12px] text-nb-ink">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {c.daily[s.key]}
          </span>
        ))}
      </div>
      <div
        ref={plot}
        className="relative rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-nb-ink/40"
        style={{ height: H }}
        tabIndex={0}
        role="group"
        aria-label={c.daily.chart(days.length)}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setAt(null)}
        onFocus={() => setAt((a) => a ?? pts.length - 1)}
        onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          const next = moveBy(e, at ?? pts.length - 1, pts.length, 1, 1);
          if (next !== null) setAt(next);
        }}
      >
        {W > 0 && (
        <svg width={W} height={H} className="block" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-nb-ink)" strokeOpacity={0.14} strokeWidth={1} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fill="var(--color-nb-ink-soft)" className="font-mono" fontSize={11}>
                {t}
              </text>
            </g>
          ))}
          {[...new Set([0, Math.floor(pts.length / 2), pts.length - 1])].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === pts.length - 1 ? "end" : i === 0 ? "start" : "middle"}
              fill="var(--color-nb-ink-soft)"
              className="font-mono"
              fontSize={11}
            >
              {pts[i].date.slice(5)}
            </text>
          ))}
          {SERIES.map((s) => (
            <polyline key={s.key} points={line(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hovered && at !== null && (
            <>
              <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-nb-ink)" strokeOpacity={0.35} strokeDasharray="3 3" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(at)} cy={y(hovered[s.key])} r={4} fill={s.color} stroke="var(--color-nb-paper)" strokeWidth={2} />
              ))}
            </>
          )}
        </svg>
        )}
        {hovered && (
          <div
            role="status"
            className={`pointer-events-none absolute top-0 z-10 rounded-[6px] bg-nb-ink px-2.5 py-1.5 text-[11px] text-nb-cream ${left > 60 ? "mr-3" : "ml-3"}`}
            style={left > 60 ? { right: `${100 - left}%` } : { left: `${left}%` }}
          >
            <div className="mb-1 whitespace-nowrap font-[700]">{hovered.label}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                {c.daily[s.key]}
                <span className="ml-auto pl-3 font-[700] tabular-nums">{hovered[s.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---- activity ---------------------------------------------------------------

// The completed line's mint in four steps, plus the empty day.
const LEVELS = [
  "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)",
  "#cfe9d8",
  "#8fcca6",
  "#4f9a6c",
  "#2f6b46",
];
const levelOf = (n: number, max: number) => (n <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((4 * n) / max))));

function Legend() {
  const c = useCopy().rail.insights.heat;
  return (
    <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-nb-ink-soft" aria-hidden>
      {c.less}
      {LEVELS.map((l, i) => (
        <span key={i} className="size-[10px] rounded-[2px]" style={{ background: l }} />
      ))}
      {c.more}
    </div>
  );
}

// One cell; the tip opens over whichever cell is active, kept inside the grid near its edges.
function Cell({ day, max, on, edge }: { day: MetricsDay; max: number; on: boolean; edge: "start" | "end" | null }) {
  const c = useCopy().rail.insights;
  return (
    <span
      className="relative block aspect-square rounded-[3px]"
      style={{
        background: LEVELS[levelOf(day.completed, max)],
        outline: on ? "2px solid var(--color-nb-ink)" : undefined,
        outlineOffset: 1,
      }}
    >
      {on && (
        <span
          role="status"
          className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-[6px] bg-nb-ink px-[7px] py-1 text-[10.5px] font-[700] text-nb-cream ${
            edge === "start" ? "left-0" : edge === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {c.heat.tip(say(c, day.date), day.completed)}
        </span>
      )}
    </span>
  );
}

// The heatmap's one tab stop, its hover and its arrow keys.
function useCursor(count: number) {
  const [at, setAt] = useState<number | null>(null);
  const hold = (i: number) => ({ onPointerEnter: () => setAt(i), onPointerDown: () => setAt(i) });
  const frame = (step: number, row: number) => ({
    tabIndex: 0,
    onFocus: () => setAt((a) => a ?? count - 1),
    onBlur: () => setAt(null),
    onPointerLeave: (e: { pointerType: string }) => e.pointerType === "mouse" && setAt(null),
    onKeyDown: (e: KeyboardEvent) => {
      const next = moveBy(e, at ?? count - 1, count, step, row);
      if (next !== null) setAt(next);
    },
  });
  return { at, hold, frame };
}

// Cells grow to CELL and no further; a period too wide for that shrinks them to fit.
const CELL = 16;
const GAP = 3;
const cellFor = (width: number, cols: number) => Math.max(4, Math.min(CELL, Math.floor((width - (cols - 1) * GAP) / cols)));

// Up to a month: one row of days, a phone wraps it in two.
function DayRow({ days }: { days: MetricsDay[] }) {
  const c = useCopy().rail.insights;
  const phone = usePhone();
  const [box, width] = useWidth<HTMLDivElement>();
  const perRow = phone ? Math.ceil(days.length / 2) : days.length;
  const max = Math.max(0, ...days.map((d) => d.completed));
  const { at, hold, frame } = useCursor(days.length);
  const size = cellFor(width, perRow);
  const cols = { gridTemplateColumns: `repeat(${perRow}, ${size}px)`, gap: GAP };
  const rows = Array.from({ length: Math.ceil(days.length / perRow) }, (_, r) => r * perRow);

  return (
    <>
      <div ref={box} className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="flex flex-col gap-2 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-nb-ink/40"
          role="group"
          aria-label={c.heat.chart}
          {...frame(1, perRow)}
        >
          {rows.map((from) => (
            <div key={from}>
              <div className="grid" style={cols}>
                {days.slice(from, from + perRow).map((d, j) => (
                  <span key={d.date} {...hold(from + j)}>
                    <Cell day={d} max={max} on={at === from + j} edge={j < 3 ? "start" : j >= perRow - 3 ? "end" : null} />
                  </span>
                ))}
              </div>
              <div className="mt-1 grid" style={cols} aria-hidden>
                {days.slice(from, from + perRow).map((d) => (
                  <span key={d.date} className="overflow-visible whitespace-nowrap font-mono text-[10.5px] text-nb-ink-soft">
                    {toDate(d.date).getDay() === 1 ? d.date.slice(5) : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Legend />
    </>
  );
}

// Longer: Monday-first week columns; a phone scrolls them, opening on the latest week.
function WeekGrid({ days }: { days: MetricsDay[] }) {
  const c = useCopy().rail.insights;
  const phone = usePhone();
  const [box, width] = useWidth<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const max = Math.max(0, ...days.map((d) => d.completed));
  const { at, hold, frame } = useCursor(days.length);
  const lead = (toDate(days[0].date).getDay() + 6) % 7;
  const slots: (number | null)[] = [...Array<null>(lead).fill(null), ...days.map((_, i) => i)];
  const weeks = Array.from({ length: Math.ceil(slots.length / 7) }, (_, w) => slots.slice(w * 7, w * 7 + 7));
  // 30px: the weekday column and its gap.
  const size = phone ? 12 : cellFor(width - 30, weeks.length);
  const cols = { gridTemplateColumns: `repeat(${weeks.length}, ${size}px)`, gap: GAP };
  const rows = { gridTemplateRows: `repeat(7, ${size}px)`, gap: GAP };

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [phone, days]);

  return (
    <>
      <div ref={box} className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex min-w-0 gap-2">
          <div className="grid w-[22px] shrink-0 pt-[18px]" style={rows} aria-hidden>
            {c.heat.weekdays.map((d, i) => (
              <span key={i} className="flex items-center text-[10px] leading-none text-nb-ink-soft">
                {d}
              </span>
            ))}
          </div>
          <div ref={scroller} className={`min-w-0 ${phone ? "overflow-x-auto pb-2" : ""}`}>
            <div
              className="w-max rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-nb-ink/40"
              role="group"
              aria-label={c.heat.chart}
              {...frame(7, 1)}
            >
              <div className="mb-1 grid h-[14px]" style={cols} aria-hidden>
                {weeks.map((w, i) => {
                  const first = w.find((s) => s !== null);
                  const d = first == null ? null : toDate(days[first].date);
                  return (
                    <span key={i} className="overflow-visible whitespace-nowrap text-[10px] text-nb-ink-soft">
                      {d && d.getDate() <= 7 ? c.heat.month(d.getMonth() + 1) : ""}
                    </span>
                  );
                })}
              </div>
              <div className="grid" style={cols}>
                {weeks.map((w, i) => (
                  <div key={i} className="grid" style={rows}>
                    {w.map((s, j) =>
                      s === null ? (
                        <span key={j} />
                      ) : (
                        <span key={j} {...hold(s)}>
                          <Cell day={days[s]} max={max} on={at === s} edge={i < 3 ? "start" : i >= weeks.length - 3 ? "end" : null} />
                        </span>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Legend />
    </>
  );
}

// ---- usage ------------------------------------------------------------------

/** `840`, `12.5K`, `18.4M` — a sense of size; the exact four counts are in the tip. */
function shortTokens(n: number): string {
  if (n < 1_000) return String(n);
  const [v, unit] = n < 1_000_000 ? [n / 1_000, "K"] : [n / 1_000_000, "M"];
  return `${v.toFixed(1).replace(/\.0$/, "")}${unit}`;
}

const tokenSum = (r: Row) => r.tokens.input + r.tokens.cacheCreation + r.tokens.cacheRead + r.tokens.output;

// At most this many lines; past it the costliest keep theirs and the rest share the last.
const LINES = 5;

function Usage({ result, days }: { result: UsageResult | null; days: number }) {
  const c = useCopy().rail.insights;
  const u = c.usage;
  const log = useCopy().runs.log;
  const phone = usePhone();
  const view = result?.ok ? result.view : null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const since = view && !view.empty && view.since > start.getTime() ? new Date(view.since) : null;

  let body: ReactNode;
  if (!result) body = <p className="m-0 border-t border-nb-ink/12 pt-3 text-[13px] text-nb-ink-soft">{c.daily.reading}</p>;
  else if (!result.ok) body = <Failure text={result.error} />;
  else if (!result.view.rows.length) body = <p className="m-0 border-t border-nb-ink/12 pt-3 text-[13px] text-nb-ink-soft">{u.empty}</p>;
  else {
    const rows = result.view.rows;
    const shown = rows.length > LINES ? rows.slice(0, LINES - 1) : rows;
    const rest = rows.slice(shown.length);
    const merged = rest.length
      ? rest.reduce(
          (sum, r) => {
            for (const k of ["input", "cacheCreation", "cacheRead", "output"] as const) sum.tokens[k] += r.tokens[k];
            sum.cost += r.costUsd;
            sum.priced ||= r.unpriced < r.runs + r.turns;
            return sum;
          },
          { tokens: { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 }, cost: 0, priced: false },
        )
      : null;
    body = (
      <div className="border-t border-nb-ink/12">
        {!phone && (
          <div className="flex items-center gap-4 py-2 text-[11.5px] text-nb-ink-soft">
            <span className="min-w-0 flex-1">{u.colSource}</span>
            <span className="w-[72px] text-right">{u.colTokens}</span>
            <span className="w-[96px] cursor-help text-right underline decoration-dotted underline-offset-2" title={u.costHint}>
              {u.colCost}
            </span>
          </div>
        )}
        {shown.map((r) => {
          const model = r.connector ? (r.model ?? u.noModel) : null;
          const counts = [r.runs > 0 && u.runs(r.runs), r.turns > 0 && u.turns(r.turns), r.unpriced > 0 && u.unpriced(r.unpriced)]
            .filter(Boolean)
            .join(" · ");
          return (
            <UsageLine
              key={`${r.harness ?? ""}\u0000${r.model ?? ""}`}
              icon={r.icon}
              name={r.connector ?? u.unknown}
              detail={model}
              detailClass={r.model ? "font-mono" : "italic"}
              tip={counts}
              tokens={tokenSum(r)}
              breakdown={formatTokens(r.tokens, log)}
              cost={r.unpriced < r.runs + r.turns ? formatCost(r.costUsd, log) : "—"}
              phone={phone}
            />
          );
        })}
        {merged && (
          <UsageLine
            name={u.other}
            detail={u.more(rest.length)}
            tip={[...new Set(rest.map((r) => r.connector ?? u.unknown))].join(" · ")}
            tokens={merged.tokens.input + merged.tokens.cacheCreation + merged.tokens.cacheRead + merged.tokens.output}
            breakdown={formatTokens(merged.tokens, log)}
            cost={merged.priced ? formatCost(merged.cost, log) : "—"}
            phone={phone}
          />
        )}
      </div>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className={`m-0 min-w-0 text-[13px] font-[800] text-nb-ink ${phone ? "flex flex-col gap-0.5" : ""}`}>
          {u.title}
          {since && (
            <span className={`text-[12px] font-[400] text-nb-ink-soft ${phone ? "" : "ml-2"}`}>
              {u.since(c.date(since.getMonth() + 1, since.getDate()))}
            </span>
          )}
        </h3>
        {view && view.rows.length > 0 && (
          <span className="shrink-0 whitespace-nowrap text-[12px] font-[700] text-nb-ink">{u.total(view.totalUsd.toFixed(2))}</span>
        )}
      </div>
      {body}
    </section>
  );
}

// One source on one line; the counts behind it are the name's tip.
function UsageLine({
  icon,
  name,
  detail,
  detailClass = "",
  tip,
  tokens,
  breakdown,
  cost,
  phone,
}: {
  icon?: string;
  name: string;
  detail: string | null;
  detailClass?: string;
  tip: string;
  tokens: number;
  breakdown: string;
  cost: string;
  phone: boolean;
}) {
  return (
    <div className={`flex items-center border-b border-nb-ink/8 py-2 last:border-b-0 ${phone ? "gap-3" : "gap-4"}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2" title={tip || undefined}>
        {/* An empty slot on a line with no mark, so every name starts at one edge. */}
        <span className="flex size-[14px] shrink-0 items-center justify-center">{icon && <AgentMark src={icon} size={14} />}</span>
        <span className="shrink-0 text-[13px] font-[700] text-nb-ink">{name}</span>
        {detail && <span className={`truncate text-[12px] text-nb-ink-soft ${detailClass}`}>{detail}</span>}
      </div>
      <span
        className={`shrink-0 cursor-help whitespace-nowrap text-right font-mono text-[12.5px] ${phone ? "w-[44px] text-nb-ink-soft" : "w-[72px] text-nb-ink"}`}
        title={breakdown}
      >
        {shortTokens(tokens)}
      </span>
      <span className={`shrink-0 whitespace-nowrap text-right text-[13px] font-[700] text-nb-ink ${phone ? "min-w-[64px]" : "w-[96px]"}`}>{cost}</span>
    </div>
  );
}
