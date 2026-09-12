"use client";

// The board's Insights dialog, opened from a chart button in the header. One chart: the
// last 30 days of docs/kanban/metrics.csv, a line each for completed, created and rejected.
//
// Plain SVG polylines and gridlines, no charting library; the three lines are told apart by
// colour.

import { useEffect, useState } from "react";
import { FiChevronRight, FiTrendingUp } from "react-icons/fi";
import { getMetricsAction } from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { MetricsDay, MetricsResult } from "@/lib/types";

import { PHONE_ROW, TOOL_BTN } from "./chrome";
import { Dialog } from "./Dialog";

type SeriesKey = "completed" | "created" | "rejected";

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
      {/* A tool in the header's cluster (components/chrome.tsx): no frame of its
          own — it shares one with Sessions and Configuration, since the three
          are all "look at the board's machinery" and none of them is a primary
          action. `row` is the same button on the phone's More screen (#357),
          where the cluster it belongs to has no room to be. */}
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
          <DailyProgress />
        </Dialog>
      )}
    </>
  );
}

// ---- Daily progress ---------------------------------------------------------

// Reads once on mount — the dialog only mounts while open, so every open is a
// fresh read. metrics.csv changes a few times a day at most; nothing polls it.
function DailyProgress() {
  const c = useCopy().rail.insights.daily;
  const [result, setResult] = useState<MetricsResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getMetricsAction()
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // A file we couldn't read says so, naming the file. It never falls through to
  // the empty note below — that would tell a user whose history is damaged that
  // they simply have none.
  if (error) return <Failure text={error} />;
  if (!result) return <p className="text-[13px] text-nb-ink-soft">{c.reading}</p>;
  if (!result.ok) return <Failure text={result.error} />;

  const view = result.view;
  if (view.empty) {
    return (
      <p className="text-[13px] text-nb-ink-soft">
        <Rich code="font-mono text-[12px]">{c.empty}</Rich>
      </p>
    );
  }

  const { completed, created, rejected } = view.totals;
  return (
    <>
      <p className="mb-4 text-[13px] text-nb-ink-soft [&_strong]:font-[800] [&_strong]:text-nb-ink">
        <Rich>{c.totals(view.days.length, completed, created, rejected)}</Rich>
      </p>
      <Chart days={view.days} />
    </>
  );
}

// The same peach panel the goal editor reports a failed save in. It carries a
// file path, so it wraps rather than pushing the dialog wide.
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

// Chart geometry (viewBox units; the SVG scales to its container width).
const W = 720;
const H = 250;
const PAD = { t: 16, r: 12, b: 28, l: 34 };

// A y-axis that fits the data: the smallest of these steps that keeps the axis
// to four intervals or fewer, so the ticks stay round whether the board's
// busiest day was 3 or 130.
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];

function yAxis(max: number): { top: number; ticks: number[] } {
  const target = Math.max(1, max);
  const step = STEPS.find((s) => target / s <= 4) ?? Math.ceil(target / 4);
  const top = Math.ceil(target / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

export function Chart({ days }: { days: MetricsDay[] }) {
  const c = useCopy().rail.insights.daily;
  const max = Math.max(...days.flatMap((d) => SERIES.map((s) => d[s.key])));
  const { top, ticks } = yAxis(max);

  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, days.length - 1);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const line = (key: SeriesKey) => days.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");
  // `YYYY-MM-DD` → `MM-DD`, the way the site's chart labels its days.
  const short = (date: string) => date.slice(5);

  // A borderless wash panel: the plot needs to sit apart from the dialog's
  // white, but a second hard border inside the dialog's own reads as a frame in
  // a frame.
  return (
    <figure className="m-0 rounded-[10px] bg-nb-wash/30 px-5 pt-4 pb-3">
      {/* Legend across the top, so the plot itself keeps the full width and the
          series names don't crowd the right edge. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-nb-ink">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {c[s.key]}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={c.chart(days.length)}
      >
        {/* horizontal gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-nb-ink)"
              strokeOpacity={0.14}
              strokeWidth={1}
            />
            <text
              x={PAD.l - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--color-nb-ink-soft)"
              className="font-mono"
              fontSize={11}
            >
              {t}
            </text>
          </g>
        ))}

        {/* x ticks: first, middle, last */}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - PAD.b + 17}
            textAnchor={i === days.length - 1 ? "end" : "middle"}
            fill="var(--color-nb-ink-soft)"
            className="font-mono"
            fontSize={11}
          >
            {short(days[i].date)}
          </text>
        ))}

        {/* series lines */}
        {SERIES.map((s) => (
          <polyline
            key={s.key}
            points={line(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

      </svg>
    </figure>
  );
}
