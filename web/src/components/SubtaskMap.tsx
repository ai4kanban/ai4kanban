// A group's build order, after legacy kanban-ui/components/SubtaskMap.tsx: one chip per subtask,
// a line from a blocker to what it blocks. Every chip is the same size and every column the same
// pitch, so the SVG places its lines without measuring the DOM.

import { FiLock } from "react-icons/fi";
import { T } from "../i18n";
import { buildSubtaskMap, type MapNode } from "../lib/subtask-map";
import type { Subtask } from "../lib/subtasks";
import { Link } from "../router";

export const PULSE_DOT = "inline-block size-1.5 rounded-full bg-nb-accent animate-pulse";

const CHIP_H = 28;
const ROW_GAP = 14;
const COL_GAP = 46;
const ROW_PITCH = CHIP_H + ROW_GAP;

// Wide enough for the longest id, plus the lock and the running dot once any chip wears one.
function chipWidth(nodes: MapNode[], running: Set<number>): number {
  const digits = Math.max(...nodes.map((n) => String(n.id).length));
  const lock = nodes.some((n) => n.outside.length > 0) ? 14 : 0;
  const dot = nodes.some((n) => running.has(n.id)) ? 13 : 0;
  return 26 + digits * 8 + lock + dot;
}

export function SubtaskMap({
  subtasks,
  running,
  href,
  onHover,
}: {
  subtasks: Subtask[];
  running: Set<number>;
  href: (id: number) => string;
  /** The hovered chip's title, said by the section's heading. */
  onHover: (title: string) => void;
}) {
  const c = T.subtasks;
  const map = buildSubtaskMap(subtasks);
  if (!map) return null;

  const chipW = chipWidth(map.nodes, running);
  const colPitch = chipW + COL_GAP;
  const rows: number[] = new Array(map.layers).fill(0);
  const at = new Map<number, { x: number; y: number }>();
  for (const n of map.nodes) {
    const row = rows[n.layer]!++;
    at.set(n.id, { x: n.layer * colPitch, y: row * ROW_PITCH });
  }
  const width = (map.layers - 1) * colPitch + chipW;
  const height = (Math.max(...rows) - 1) * ROW_PITCH + CHIP_H;

  return (
    <div className="pb-2" onMouseLeave={() => onHover("")}>
      {/* The padding is room for a chip's press shadow and the live chip's ring. */}
      <div className="overflow-x-auto p-1.5">
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="absolute left-0 top-0" aria-hidden>
            <defs>
              <marker id="nb-submap-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-nb-ink-soft)" />
              </marker>
            </defs>
            {map.edges.map((e) => {
              const from = at.get(e.from);
              const to = at.get(e.to);
              if (!from || !to) return null;
              const x1 = from.x + chipW;
              const y1 = from.y + CHIP_H / 2;
              const x2 = to.x - 2;
              const y2 = to.y + CHIP_H / 2;
              const bend = Math.max(18, (x2 - x1) / 2);
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--color-nb-ink-soft)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  markerEnd="url(#nb-submap-arrow)"
                />
              );
            })}
          </svg>
          {map.nodes.map((n) => {
            const p = at.get(n.id)!;
            const waiting = n.outside.length > 0 ? c.waitingOutside(n.outside.map((o) => `#${o}`).join(", ")) : "";
            const live = running.has(n.id);
            const title = waiting ? `${n.title} — ${waiting}` : n.title;
            return (
              <Link
                key={n.id}
                href={href(n.id)}
                aria-label={`#${n.id} ${n.title}${live ? ` — ${c.running}` : ""}${waiting ? ` — ${waiting}` : ""}`}
                onMouseEnter={() => onHover(title)}
                onFocus={() => onHover(title)}
                onBlur={() => onHover("")}
                className={`nb-press absolute flex items-center justify-center gap-1 rounded-[9px] border-[1.5px] border-nb-ink text-[12.5px] font-[800] leading-none no-underline hover:bg-nb-wash ${
                  live ? "a4k-chip-live bg-nb-accent-wash" : "bg-nb-paper"
                }`}
                style={{ left: p.x, top: p.y, width: chipW, height: CHIP_H }}
              >
                <span style={{ color: "var(--color-nb-accent-deep)" }}>#{n.id}</span>
                {live && <span className={PULSE_DOT} aria-hidden />}
                {waiting && <FiLock aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto", color: "var(--color-nb-peach-ink)" }} />}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
