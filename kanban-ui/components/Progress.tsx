"use client";

// The board's daily progress (#65), opened from a chart button in the header.
// The script already keeps docs/kanban/metrics.csv — one row per day — and this
// is the only place the UI shows it: a read-only line chart of the last 30 days
// with the totals above it. It never writes the file.
//
// The chart is ported from the site's ThroughputChart (web/components/home/):
// plain SVG polylines and gridlines, no charting library. Two things differ
// here — the board's light theme instead of the site's dark code surface, and a
// y-axis that scales to the data (the site's is pinned to 0–8, and this board
// has already had a day of 13). The legend sits above the plot rather than at
// the right edge; the dialog is too narrow to give up 100px of width.

import { useEffect, useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { getMetricsAction } from "@/app/actions";
import type { MetricsDay, MetricsResult } from "@/lib/metrics";
import { Dialog } from "./Dialog";

type SeriesKey = "completed" | "created" | "rejected";

// Three distinct hues that hold up on the cream/paper canvas: the board's mint,
// sky and ember inks, darkened enough to read as thin lines.
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "completed", label: "Completed", color: "#2f6b46" },
  { key: "created", label: "Created", color: "#2c5c86" },
  { key: "rejected", label: "Rejected", color: "#b83a12" },
];

export function Progress() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Ghost sticker button — the same 36px frame as the header's Sessions and
          Configuration buttons, so the three read as one row of quiet controls. */}
      <button
        type="button"
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)] transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_var(--color-nb-ink)]"
        title="Daily progress"
        aria-label="Daily progress"
        onClick={() => setOpen(true)}
      >
        <FiTrendingUp className="text-[16px]" aria-hidden />
      </button>

      {open && (
        <Dialog title="Daily progress" onClose={() => setOpen(false)} width={760}>
          <ProgressView />
        </Dialog>
      )}
    </>
  );
}

// Reads once on mount — the dialog only mounts while open, so every open is a
// fresh read. metrics.csv changes a few times a day at most; nothing polls it.
function ProgressView() {
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
  if (!result) return <p className="text-[13px] text-nb-ink-soft">Reading metrics.csv…</p>;
  if (!result.ok) return <Failure text={result.error} />;

  const view = result.view;
  if (view.empty) {
    return (
      <p className="text-[13px] text-nb-ink-soft">
        No activity recorded yet. The board writes a row to{" "}
        <code className="font-mono text-[12px]">metrics.csv</code> the first time a card is
        created, archived, or rejected.
      </p>
    );
  }

  const { completed, created, rejected } = view.totals;
  return (
    <>
      <p className="mb-4 text-[13px] text-nb-ink-soft">
        Last {view.days.length} days —{" "}
        <strong className="font-[800] text-nb-ink">{completed} completed</strong>,{" "}
        <strong className="font-[800] text-nb-ink">{created} created</strong>,{" "}
        <strong className="font-[800] text-nb-ink">{rejected} rejected</strong>.
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
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Daily board activity over the last ${days.length} days: completed, created, and rejected cards.`}
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
