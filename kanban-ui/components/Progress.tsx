"use client";

// The board's Progress dialog, opened from a chart button in the header. Two
// full-width sections, stacked so neither gives up the horizontal room its axis
// needs:
//
//   Daily progress (#65)    the last 30 days of docs/kanban/metrics.csv — one
//                           line each for completed, created and rejected.
//   Planning quality (#224) release by release, the three numbers the board
//                           scores its own planning by, worked out by the CLI
//                           from docs/kanban/record.csv. Nothing here parses a
//                           CSV or calculates a percentage; the rules do that.
//
// The two read separately on purpose: one chart failing, or being asked of rules
// too old to answer, must leave the other drawn.
//
// The charts are plain SVG polylines and gridlines, no charting library. Daily
// progress tells its three lines apart by colour; Planning quality gives each
// series a line style and a marker as well, because its lines cross far more
// often and the reader is left guessing otherwise.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { getMetricsAction, getScoreAction } from "@/app/actions";
import type { MetricsDay, MetricsResult, ScoreResult, ScoreSeries, ScoreWindow } from "@/lib/types";

import { TOOL_BTN } from "./chrome";
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
      {/* A tool in the header's cluster (components/chrome.tsx): no frame of its
          own — it shares one with Sessions and Configuration, since the three
          are all "look at the board's machinery" and none of them is a primary
          action. */}
      <button
        type="button"
        className={TOOL_BTN}
        title="Progress"
        aria-label="Progress"
        onClick={() => setOpen(true)}
      >
        <FiTrendingUp size={15} aria-hidden />
      </button>

      {open && (
        <Dialog title="Progress" onClose={() => setOpen(false)} width={760}>
          <Section title="Daily progress">
            <DailyProgress />
          </Section>
          <Section title="Planning quality">
            <PlanningQuality />
          </Section>
        </Dialog>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2 text-[13px] font-[800] tracking-[-0.01em]">{title}</h3>
      {children}
    </section>
  );
}

// ---- Daily progress ---------------------------------------------------------

// Reads once on mount — the dialog only mounts while open, so every open is a
// fresh read. metrics.csv changes a few times a day at most; nothing polls it.
function DailyProgress() {
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

// ---- Planning quality -------------------------------------------------------

// Each series' own line style and marker, so the three are told apart with the
// colour taken away — printed, in grayscale, or by a reader who can't separate
// mint from ember. The colours match Daily progress's three inks.
type Shape = "circle" | "square" | "triangle";
const STYLE: Record<string, { color: string; dash: string; shape: Shape }> = {
  details: { color: "#2f6b46", dash: "", shape: "circle" },
  decisions: { color: "#2c5c86", dash: "7 4", shape: "square" },
  proposals: { color: "#b83a12", dash: "1.5 4", shape: "triangle" },
};

const style = (key: string) => STYLE[key] ?? STYLE.details;

function Marker({ shape, x, y, color }: { shape: Shape; x: number; y: number; color: string }) {
  if (shape === "square") {
    return <rect x={x - 3.2} y={y - 3.2} width={6.4} height={6.4} fill={color} />;
  }
  if (shape === "triangle") {
    return <polygon points={`${x},${y - 4.2} ${x + 4},${y + 3} ${x - 4},${y + 3}`} fill={color} />;
  }
  return <circle cx={x} cy={y} r={3.6} fill={color} />;
}

function PlanningQuality() {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getScoreAction()
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // A record that can't be read, and a copy of the rules too old to work the
  // scores out, both arrive here as one line. Neither hides Daily progress
  // above: the two sections are read separately for exactly this reason.
  if (error) return <Failure text={error} />;
  if (!result) return <p className="text-[13px] text-nb-ink-soft">Reading record.csv…</p>;
  if (!result.ok) return <Failure text={result.error} />;

  if (result.view.empty) {
    return (
      <p className="text-[13px] text-nb-ink-soft">
        No planning evidence yet. The board writes a row to{" "}
        <code className="font-mono text-[12px]">record.csv</code> as it settles a question,
        proposes a card, or closes a release — the three scores are worked out from those rows.
      </p>
    );
  }

  return <ScoreChart windows={result.view.windows} />;
}

// Y is fixed at 0–100%: a percentage axis that rescaled to its data would make
// two boards' charts, or the same board on two days, look alike at different
// figures.
const PCT_TICKS = [0, 25, 50, 75, 100];

/** How many axis labels fit before they collide. Below this every release is
 *  named; above it only the first and the last, which is the open window. Every
 *  release is still reachable with the arrow keys and names itself in the
 *  readout. */
const MAX_LABELS = 9;

/** A release id too long for its axis label is shortened there; the readout
 *  always carries it in full. */
const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 11)}…` : id);

function ScoreChart({ windows }: { windows: ScoreWindow[] }) {
  // The readout opens on the current window — the last one, always open — because
  // that is the score still worth acting on.
  const [at, setAt] = useState(windows.length - 1);
  const readout = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const move = useCallback((next: number) => {
    moved.current = true;
    setAt(next);
  }, []);

  // Moving brings the readout into view, so a release picked at the top of a
  // scrolled dialog isn't read out below the fold. Not on the first draw: that
  // would scroll the dialog past Daily progress the moment it opens.
  useEffect(() => {
    if (moved.current) readout.current?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const last = windows.length - 1;
  const onKeyDown = (e: React.KeyboardEvent) => {
    const to =
      e.key === "ArrowLeft" ? Math.max(0, at - 1)
      : e.key === "ArrowRight" ? Math.min(last, at + 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (to === null) return;
    e.preventDefault();
    move(to);
  };

  // One point, and the plot is a marker in the middle rather than a line from
  // the left edge to nowhere.
  const x = (i: number) =>
    windows.length === 1
      ? (PAD.l + W - PAD.r) / 2
      : PAD.l + (i * (W - PAD.l - PAD.r)) / (windows.length - 1);
  const y = (pct: number) => PAD.t + (1 - pct / 100) * (H - PAD.t - PAD.b);
  // Half a release's column — how far its hit area reaches. The highlight is
  // capped: on a board with two windows a column is half the plot, and washing
  // half the plot reads as a change in the chart rather than as a choice in it.
  const band =
    windows.length === 1
      ? (W - PAD.l - PAD.r) / 2
      : (W - PAD.l - PAD.r) / (windows.length - 1) / 2;
  const mark = Math.min(band, 26);

  // A series' line is drawn in runs of neighbouring windows that both have a
  // point. A window below its evidence floor ends the run and the next point
  // starts a new one, so the line is never drawn straight across a gap — which
  // would read as evidence nobody has.
  const runs = (key: string): { i: number; pct: number }[][] => {
    const out: { i: number; pct: number }[][] = [];
    let run: { i: number; pct: number }[] = [];
    windows.forEach((w, i) => {
      const pct = w.series.find((s) => s.key === key)?.percent;
      if (pct === null || pct === undefined) {
        if (run.length) out.push(run);
        run = [];
      } else run.push({ i, pct });
    });
    if (run.length) out.push(run);
    return out;
  };

  const labelled =
    windows.length <= MAX_LABELS
      ? windows.map((_, i) => i)
      : [...new Set([0, last])];

  const chosen = windows[at] ?? windows[last];
  const legend = chosen.series;

  return (
    <figure className="m-0 rounded-[10px] bg-nb-wash/30 px-5 pt-4 pb-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-nb-ink">
        {legend.map((s) => {
          const { color, dash, shape } = style(s.key);
          return (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              {/* The legend's swatch is the line as drawn — its style and its
                  marker — not a colour chip, since the style is what tells the
                  three apart. */}
              <svg width={26} height={10} aria-hidden>
                <line
                  x1={0}
                  x2={26}
                  y1={5}
                  y2={5}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dash || undefined}
                  strokeLinecap="round"
                />
                <Marker shape={shape} x={13} y={5} color={color} />
              </svg>
              {s.label}
            </span>
          );
        })}
      </div>

      {/* One Tab stop for the whole chart, so the dialog's own controls stay one
          Tab away on a board with thirty releases. A release is the unit that
          moves — a single series' point is never reached on its own. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Planning quality by release. Use the left and right arrow keys to move from release to release; the readout below gives that release's three scores."
        onKeyDown={onKeyDown}
        className="rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-nb-ink/40"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
          {PCT_TICKS.map((t) => (
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
                {t}%
              </text>
            </g>
          ))}

          {/* The chosen release: a washed column and a rule down it. The column is
              what carries at the two ends, where a rule alone sits under the
              plot's own edge. */}
          <rect
            x={Math.max(PAD.l, x(at) - mark)}
            y={PAD.t}
            width={Math.min(mark * 2, W - PAD.r - Math.max(PAD.l, x(at) - mark))}
            height={H - PAD.t - PAD.b}
            fill="var(--color-nb-ink)"
            fillOpacity={0.06}
          />
          <line
            x1={x(at)}
            x2={x(at)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--color-nb-ink)"
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />

          {legend.map((s) => {
            const { color, dash, shape } = style(s.key);
            const drawn = runs(s.key);
            return (
              <g key={s.key}>
                {drawn
                  .filter((run) => run.length > 1)
                  .map((run) => (
                    <polyline
                      key={run[0].i}
                      points={run.map((p) => `${x(p.i)},${y(p.pct)}`).join(" ")}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={dash || undefined}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                {/* every point keeps its marker, so a window with no neighbour
                    to join is still drawn */}
                {drawn.flat().map((p) => (
                  <Marker key={p.i} shape={shape} x={x(p.i)} y={y(p.pct)} color={color} />
                ))}
              </g>
            );
          })}

          {/* The chosen release names itself in ink; the rest stay soft, so the
              axis says which one the readout below is about. */}
          {labelled.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - PAD.b + 17}
              textAnchor={windows.length === 1 ? "middle" : i === last ? "end" : i === 0 ? "start" : "middle"}
              fill={i === at ? "var(--color-nb-ink)" : "var(--color-nb-ink-soft)"}
              fontWeight={i === at ? 700 : 400}
              className="font-mono"
              fontSize={11}
            >
              {shortId(windows[i].release)}
              {windows[i].open ? " · open" : ""}
            </text>
          ))}

          {/* A column per release, so the mouse reads out what the keyboard
              reads. Hover and click do the same thing: figures only a Tab key
              can reach are hidden from most of the people who open the dialog. */}
          {windows.map((w, i) => {
            const left = Math.max(PAD.l, x(i) - band);
            return (
              <rect
                key={w.release + i}
                x={left}
                y={PAD.t}
                width={Math.min(band * 2, W - PAD.r - left)}
                height={H - PAD.t - PAD.b}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => move(i)}
                onClick={() => move(i)}
              />
            );
          })}
        </svg>
      </div>

      <Readout ref={readout} window={chosen} />
    </figure>
  );
}

// The chosen release in words: each series' percentage, the two counts it came
// from, and every card that contributed. A live region, so moving to a release
// announces it whether the keyboard or the mouse moved it — the line's height
// gives a rough value, and a figure drawn only on screen leaves out the reader
// who most needs it spoken.
function Readout({ ref, window: w }: { ref: React.Ref<HTMLDivElement>; window: ScoreWindow }) {
  return (
    <div
      ref={ref}
      aria-live="polite"
      aria-atomic="true"
      className="mt-3 border-t border-nb-ink/15 pt-3 text-[12px] leading-relaxed"
    >
      <p className="mb-2 font-[800] text-nb-ink">
        {w.release}
        {w.open && <span className="ml-2 font-[600] text-nb-ink-soft">{" · still open"}</span>}
      </p>
      <div className="grid gap-2">
        {w.series.map((s) => (
          <Reading key={s.key} series={s} />
        ))}
      </div>
    </div>
  );
}

function Reading({ series: s }: { series: ScoreSeries }) {
  const { color, dash, shape } = style(s.key);
  const [hit, miss] = s.counts;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 text-nb-ink">
        <svg width={26} height={10} aria-hidden className="shrink-0">
          <line
            x1={0}
            x2={26}
            y1={5}
            y2={5}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dash || undefined}
            strokeLinecap="round"
          />
          <Marker shape={shape} x={13} y={5} color={color} />
        </svg>
        <span className="font-[800]">{s.label}</span>
        <span className="font-mono font-[800]">
          {s.percent === null ? "not enough yet" : `${s.percent}%`}
        </span>
        <span className="text-nb-ink-soft">
          {hit.label} {hit.value} · {miss.label} {miss.value}
          {s.percent === null && ` — ${s.floor} needed`}
        </span>
      </p>
      {/* Every contributing id, in full and in order, so a figure can be
          recalculated from record.csv by hand. Plain text, not links: a card
          counts only once it has been archived or rejected, so almost every
          link would lead nowhere. */}
      <p className="mt-0.5 break-words pl-[34px] font-mono text-[11px] text-nb-ink-soft">
        {s.cards.length ? `Cards ${s.cards.map((id) => `#${id}`).join(", ")}` : "No cards yet"}
      </p>
    </div>
  );
}
