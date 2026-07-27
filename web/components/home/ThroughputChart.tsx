// Daily throughput, one row per day in metrics.csv, drawn as four lines.
// Colors are the dataviz categorical dark slots, validated for CVD on the code
// surface (#0a0e14): total=yellow, completed=aqua, created=blue, rejected=red.
import { Rich } from "../Rich";
import { panelStatic } from "../styles";
import type { HomeCopy, ThroughputSeriesKey } from "@/i18n/types";

type Row = { d: string; created: number; completed: number; rejected: number };

const rows: Row[] = [
  { d: "07-02", created: 3, completed: 1, rejected: 0 },
  { d: "07-03", created: 2, completed: 2, rejected: 1 },
  { d: "07-04", created: 4, completed: 2, rejected: 0 },
  { d: "07-05", created: 1, completed: 3, rejected: 0 },
  { d: "07-06", created: 2, completed: 1, rejected: 1 },
  { d: "07-07", created: 3, completed: 3, rejected: 0 },
  { d: "07-08", created: 2, completed: 4, rejected: 1 },
  { d: "07-09", created: 4, completed: 2, rejected: 0 },
  { d: "07-10", created: 1, completed: 3, rejected: 0 },
  { d: "07-11", created: 3, completed: 4, rejected: 1 },
  { d: "07-12", created: 2, completed: 3, rejected: 0 },
  { d: "07-13", created: 1, completed: 5, rejected: 0 },
];

const series: { key: ThroughputSeriesKey; color: string; width: number }[] = [
  { key: "total", color: "#c98500", width: 2.5 },
  { key: "completed", color: "#199e70", width: 2 },
  { key: "created", color: "#3987e5", width: 2 },
  { key: "rejected", color: "#e66767", width: 2 },
];

// Chart geometry (viewBox units; the SVG scales to its container width).
const W = 720;
const H = 260;
const PAD = { t: 18, r: 118, b: 30, l: 30 };
const Y_MAX = 8;
const Y_TICKS = [0, 2, 4, 6, 8];

const data = rows.map((r) => ({
  ...r,
  total: r.created + r.completed + r.rejected,
}));

const x = (i: number) =>
  PAD.l + (i * (W - PAD.l - PAD.r)) / (data.length - 1);
const y = (v: number) => PAD.t + (1 - v / Y_MAX) * (H - PAD.t - PAD.b);

function line(key: ThroughputSeriesKey) {
  return data.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");
}

export function ThroughputChart({
  c,
}: {
  c: HomeCopy["advanced"]["metrics"]["chart"];
}) {
  return (
    <figure className={`${panelStatic} mt-4 bg-code p-5`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={c.aria}>
        {/* horizontal gridlines + y ticks */}
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              stroke="#2c2c2a"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#898781"
              className="font-mono"
              fontSize={11}
            >
              {t}
            </text>
          </g>
        ))}

        {/* x ticks: first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - PAD.b + 18}
            textAnchor="middle"
            fill="#898781"
            className="font-mono"
            fontSize={11}
          >
            {data[i].d}
          </text>
        ))}

        {/* series lines */}
        {series.map((s) => (
          <polyline
            key={s.key}
            points={line(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* right-edge direct labels */}
        {series.map((s) => {
          const last = data[data.length - 1][s.key];
          return (
            <g key={s.key}>
              <circle cx={W - PAD.r + 12} cy={y(last)} r={4} fill={s.color} />
              <text
                x={W - PAD.r + 22}
                y={y(last)}
                dominantBaseline="middle"
                fill="#c3c2b7"
                fontSize={12}
              >
                {c.series[s.key]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 text-sm text-muted">
        <Rich>{c.caption}</Rich>
      </figcaption>
    </figure>
  );
}
