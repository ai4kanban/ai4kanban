import { inputSourceOrder, loopStageNumbers, loopStageOrder } from "../content";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

// Geometry for a real circle: three stage bubbles sit 120° apart on one ring,
// with an arrowhead on each arc between them so the whole thing reads as a cycle.
const CX = 180;
const CY = 180;
const R = 118; // ring radius the bubbles sit on
const BUBBLE = 44;

const polar = (deg: number, radius: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
};

// Bubbles start at 12 o'clock (-90°) and step clockwise.
const nodes = loopStageOrder.map((key, i) => ({
  key,
  ...polar(-90 + i * 120, R),
}));

// Arrowheads land on the mid-arc between each pair, rotated to point clockwise.
const arrows = loopStageOrder.map((_, i) => {
  const deg = -30 + i * 120;
  return { ...polar(deg, R), rot: deg + 90 };
});

export function LoopDiagram({ c }: { c: HomeCopy["advanced"]["memory"] }) {
  const t = c.loop;
  return (
    <div
      className={`${panelStatic} mt-6 grid grid-cols-1 items-center gap-6 bg-code p-6 sm:grid-cols-2 sm:items-stretch sm:gap-8`}
    >
      <svg
        viewBox="0 0 360 360"
        className="mx-auto block h-auto w-full max-w-[320px] font-sans sm:self-center"
        role="img"
        aria-label={t.aria}
      >
        {/* The ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="2"
        />

        {/* Direction arrowheads on each arc */}
        {arrows.map((a, i) => (
          <g key={i} transform={`translate(${a.x} ${a.y}) rotate(${a.rot})`}>
            <path d="M -7 -7 L 8 0 L -7 7 Z" fill="var(--color-accent)" />
          </g>
        ))}

        {/* Center: the memory the loop turns around */}
        <text
          x={CX}
          y={CY - 3}
          textAnchor="middle"
          fontSize="13"
          fontFamily="var(--font-mono)"
          fill="var(--color-muted)"
        >
          docs/kanban/
        </text>
        <text
          x={CX}
          y={CY + 16}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-muted)"
        >
          {t.centerCaption}
        </text>

        {/* Stage bubbles */}
        {nodes.map((n) => (
          <g key={n.key}>
            <circle
              cx={n.x}
              cy={n.y}
              r={BUBBLE}
              fill="var(--color-elev)"
              stroke="var(--color-accent)"
              strokeWidth="2"
            />
            <text
              x={n.x}
              y={n.y - 12}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fontWeight="600"
              fill="var(--color-accent)"
            >
              {t.stepLabel} {loopStageNumbers[n.key]}
            </text>
            <text
              x={n.x}
              y={n.y + 8}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="var(--color-ink)"
            >
              {t.stages[n.key].label}
            </text>
          </g>
        ))}
      </svg>

      {/* What happens at each stage — beside the circle on desktop, below on mobile */}
      <ol className="mt-5 space-y-3 border-t-2 border-border pt-5 sm:my-2 sm:flex sm:flex-col sm:justify-center sm:border-l-2 sm:border-t-0 sm:pl-8 sm:pt-0">
        {loopStageOrder.map((key) => (
          <li key={key} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border bg-accent/20 font-mono text-[0.7rem] font-semibold text-accent">
              {loopStageNumbers[key]}
            </span>
            <div className="text-sm text-muted">
              <p>
                <span className="font-semibold text-ink">
                  {t.stages[key].label}.
                </span>{" "}
                {t.stages[key].body}
              </p>
              {/* The three sources live under Propose, where they belong */}
              {key === "propose" && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-accent">
                  {inputSourceOrder.map((src) => (
                    <li key={src}>
                      <span className="font-medium text-ink">
                        {t.sources[src].label}
                      </span>{" "}
                      — {t.sources[src].body}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
