// `/stats` (#2066): the workspace's tasks created, done and cancelled per day, and what its runs
// cost, over 30 days, 90 days or a year, split into days in the browser's time zone.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HAIRLINE } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { useStore } from "../store";
import { Window } from "../components/Window";

const RANGES = [30, 90, 365];
const DAY_MS = 86_400_000;
const LINE = { created: "var(--color-nb-ink)", completed: "var(--color-nb-accent)", cancelled: "var(--color-nb-ink-soft)" };
const ZERO: api.Usage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 };

const iso = (at: number) => new Date(at).toISOString().slice(0, 10);
const label = (date: string) => T.stats.day(Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const money = (usd: number) => `$${usd.toFixed(2)}`;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** The last `n` days up to today on the browser's calendar, each with its row or zeros. */
function daysOf(n: number, rows: api.StatsDay[]): api.StatsDay[] {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const held = new Map(rows.map((r) => [r.date, r]));
  return Array.from({ length: n }, (_, i) => {
    const date = iso(today - (n - 1 - i) * DAY_MS);
    return held.get(date) ?? { date, created: 0, completed: 0, rejected: 0, usage: ZERO, costUsd: 0 };
  });
}

export function Stats() {
  const store = useStore();
  const phone = useNarrow();
  const [range, setRange] = useState(RANGES[0]!);
  const [rows, setRows] = useState<api.StatsDay[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = `${T.stats.title} · WildCrane`;
  }, []);

  useEffect(() => {
    let live = true;
    const days = daysOf(range, []);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setRows(null);
    setFailed(false);
    api.readStats(store.ws.id, days[0]!.date, days.at(-1)!.date, tz).then(
      (r) => live && setRows(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [store.ws.id, range]);

  const days = useMemo(() => daysOf(range, rows ?? []), [range, rows]);
  const total = (pick: (d: api.StatsDay) => number) => days.reduce((s, d) => s + pick(d), 0);
  const ticks = phone ? [days[0]!, days.at(-1)!] : [0, 1, 2, 3].map((k) => days[Math.round((k * (days.length - 1)) / 3)]!);

  return (
    <Window>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[840px] flex-col gap-4 px-6 py-6 max-md:px-4 max-md:py-4">
          <div className="flex items-center gap-4 max-md:flex-col max-md:items-start max-md:gap-2">
            <h1 className="text-[20px] font-[800] tracking-[-0.02em]">{T.stats.title}</h1>
            <span className="flex items-center gap-4 text-[12.5px] md:ml-auto" role="tablist">
              {RANGES.map((n, i) => (
                <button key={n} type="button" role="tab" aria-selected={range === n} onClick={() => setRange(n)} className={cn("flex cursor-pointer flex-col items-center gap-1", range === n ? "font-[700]" : "text-nb-ink-soft")}>
                  {T.stats.ranges[i]}
                  <span className={cn("h-[2px] w-full rounded-full", range === n && "bg-nb-ink")} aria-hidden />
                </button>
              ))}
            </span>
          </div>
          {failed ? (
            <p className="text-[13px] text-nb-ink-soft">{T.stats.failed}</p>
          ) : rows === null ? null : (
            <>
              <div className="nb-section grid grid-cols-4 bg-nb-sheet max-md:grid-cols-2">
                {(
                  [
                    [T.stats.created, String(total((d) => d.created))],
                    [T.stats.completed, String(total((d) => d.completed))],
                    [T.stats.cancelled, String(total((d) => d.rejected))],
                    [T.stats.cost, money(total((d) => d.costUsd))],
                  ] as const
                ).map(([name, value], k) => (
                  <div
                    key={name}
                    className="flex flex-col gap-1 px-4 py-3"
                    style={{
                      borderLeft: (phone ? k % 2 : k) ? `1px solid ${HAIRLINE}` : undefined,
                      borderTop: phone && k > 1 ? `1px solid ${HAIRLINE}` : undefined,
                    }}
                  >
                    <span className="text-[12px] text-nb-ink-soft">{name}</span>
                    <span className="text-[22px] font-[800] tabular-nums tracking-[-0.02em]">{value}</span>
                  </div>
                ))}
              </div>
              {rows.length === 0 ? (
                <p className="text-[13px] text-nb-ink-soft">{T.stats.empty}</p>
              ) : (
                <>
                  <Chart
                    title={T.stats.tasks}
                    ticks={ticks}
                    height={phone ? 140 : 180}
                    legend={
                      <>
                        <Key color={LINE.created}>{T.stats.created}</Key>
                        <Key color={LINE.completed}>{T.stats.completed}</Key>
                        <Key color={LINE.cancelled} dash>
                          {T.stats.cancelled}
                        </Key>
                      </>
                    }
                    series={[
                      { values: days.map((d) => d.created), color: LINE.created },
                      { values: days.map((d) => d.completed), color: LINE.completed },
                      { values: days.map((d) => d.rejected), color: LINE.cancelled, dash: true },
                    ]}
                    tip={(i) => [
                      [T.stats.created, String(days[i]!.created), LINE.created],
                      [T.stats.completed, String(days[i]!.completed), LINE.completed],
                      [T.stats.cancelled, String(days[i]!.rejected), LINE.cancelled],
                    ]}
                    days={days}
                  />
                  <Chart
                    title={T.stats.usage}
                    ticks={ticks}
                    height={phone ? 120 : 150}
                    legend={<Key color={LINE.completed}>{T.stats.cost}</Key>}
                    series={[{ values: days.map((d) => d.costUsd), color: LINE.completed }]}
                    tip={(i) => {
                      const d = days[i]!;
                      return [
                        [T.stats.cost, money(d.costUsd)],
                        [T.stats.tokens.input, compact.format(d.usage.input)],
                        [T.stats.tokens.output, compact.format(d.usage.output)],
                        [T.stats.tokens.cacheRead, compact.format(d.usage.cacheRead)],
                        [T.stats.tokens.cacheWrite, compact.format(d.usage.cacheCreation)],
                      ];
                    }}
                    days={days}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Window>
  );
}

function Key({ color, dash, children }: { color: string; dash?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Dot color={color} dash={dash} />
      {children}
    </span>
  );
}

function Dot({ color, dash }: { color: string; dash?: boolean }) {
  return <span aria-hidden className="inline-block h-[2px] w-3 rounded-full" style={{ background: dash ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} />;
}

type Series = { values: number[]; color: string; dash?: boolean };
type TipRow = [string, string, string?];

function Chart({ title, legend, ticks, height, series, tip, days }: { title: string; legend: ReactNode; ticks: api.StatsDay[]; height: number; series: Series[]; tip: (i: number) => TipRow[]; days: api.StatsDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const n = days.length;
  const max = Math.max(...series.flatMap((s) => s.values), 0) * 1.15 || 1;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => height - (v / max) * (height - 8) - 4;
  const at = hover === null ? 0 : (hover / (n - 1)) * 100;
  return (
    <section className="nb-section flex flex-col gap-3 bg-nb-sheet px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-[14px] font-[800]">{title}</h2>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[12px] text-nb-ink-soft">{legend}</span>
      </div>
      <div
        className="relative touch-pan-y"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * (n - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={height * f} y2={height * f} stroke={HAIRLINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--color-nb-ink)" strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          {series.map((s, k) => (
            <polyline key={k} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash ? "4 3" : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          ))}
        </svg>
        {hover !== null && (
          <div className="nb-panel-sm pointer-events-none absolute top-2 z-10 flex min-w-[150px] flex-col gap-1 px-3 py-2 text-[12px]" style={at > 50 ? { right: `calc(${100 - at}% + 10px)` } : { left: `calc(${at}% + 10px)` }}>
            <span className="font-[700]">{label(days[hover]!.date)}</span>
            {tip(hover).map(([name, value, color]) => (
              <span key={name} className="flex items-center gap-2">
                {color && <Dot color={color} dash={color === LINE.cancelled} />}
                <span className="flex-1 text-nb-ink-soft">{name}</span>
                <span className="font-[600] tabular-nums">{value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-nb-ink-soft">
        {ticks.map((d) => (
          <span key={d.date}>{label(d.date)}</span>
        ))}
      </div>
    </section>
  );
}
