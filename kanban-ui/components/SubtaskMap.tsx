"use client";

import Link from "next/link";
import { FiLock } from "react-icons/fi";

import { useCopy } from "@/i18n/use-copy";
import { buildSubtaskMap, type MapNode } from "@/lib/subtask-map";
import type { Subtask } from "@/lib/types";

// A group's build order, drawn at the head of the subtasks panel on the root's page (#333):
// one chip per subtask, a line from a blocker to what it blocks. It is a band inside that
// panel, not a panel of its own — the list right beneath it is what these ids say, and two
// outlines around one subject read as two subjects with a gap of dead paper between them. A
// hairline is all that parts the drawing from the rows: they are one thing said twice.
//
// The picture is placed, not laid out: every chip is the same size and every column the
// same pitch, so the SVG can put a line between two chips without measuring the DOM. A
// group holds a handful of subtasks and the map never moves, so this is enough — a graph
// library would be a runtime dependency in the shipped desktop app for a static drawing.

const CHIP_H = 28;
const ROW_GAP = 14;
const COL_GAP = 46; // the channel the lines run through
const ROW_PITCH = CHIP_H + ROW_GAP;

// A chip is the id and nothing else, so its width follows the longest id in the group — plus
// the lock, once any chip in the map wears one, so every column keeps the same pitch.
function chipWidth(nodes: MapNode[]): number {
  const digits = Math.max(...nodes.map((n) => String(n.id).length));
  const lock = nodes.some((n) => n.outside.length > 0) ? 14 : 0;
  return 26 + digits * 8 + lock;
}

export function SubtaskMap({
  subtasks,
  onHover,
}: {
  subtasks: Subtask[];
  /** The hovered chip's title, said by the panel's heading rather than by a bubble over the
   *  drawing. A bubble needed a band of empty space above the top row for every reader who
   *  never hovers; the heading is already on screen and has room to spare. */
  onHover: (title: string) => void;
}) {
  const c = useCopy().card.subtasks;
  const map = buildSubtaskMap(subtasks);
  if (!map) return null;

  const chipW = chipWidth(map.nodes);
  const colPitch = chipW + COL_GAP;
  const rows: number[] = new Array(map.layers).fill(0);
  const at = new Map<number, { x: number; y: number }>();
  for (const n of map.nodes) {
    const row = rows[n.layer]++;
    at.set(n.id, { x: n.layer * colPitch, y: row * ROW_PITCH });
  }
  const width = (map.layers - 1) * colPitch + chipW;
  const height = (Math.max(...rows) - 1) * ROW_PITCH + CHIP_H;

  return (
    <div
      className="mb-2.5 pb-4"
      style={{ borderBottom: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)" }}
      onMouseLeave={() => onHover("")}
    >
      {/* Wider than the panel, it scrolls sideways: a drawing whose columns wrap is a
          different drawing. The padding is the room a chip's press shadow needs — a
          sideways scroller clips both axes, and without it the bottom row's shadow is
          sliced off on hover. */}
      <div className="overflow-x-auto p-1">
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="absolute left-0 top-0" aria-hidden>
            <defs>
              <marker
                id="nb-submap-arrow"
                viewBox="0 0 8 8"
                refX="8"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
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
            const waiting =
              n.outside.length > 0 ? c.waitingOutside(n.outside.map((o) => `#${o}`).join(", ")) : "";
            const title = waiting ? `${n.title} — ${waiting}` : n.title;
            return (
              <Link
                key={n.id}
                href={`/${n.id}`}
                // `#123` is the only text in the link, and the heading that names it is not
                // read out — so the name is spelled out here.
                aria-label={`#${n.id} ${n.title}${waiting ? ` — ${waiting}` : ""}`}
                onMouseEnter={() => onHover(title)}
                onFocus={() => onHover(title)}
                onBlur={() => onHover("")}
                className="nb-press absolute flex items-center justify-center gap-1 rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper text-[12.5px] font-[800] leading-none hover:bg-nb-wash"
                style={{ left: p.x, top: p.y, width: chipW, height: CHIP_H }}
              >
                <span style={{ color: "var(--color-nb-accent-deep)" }}>#{n.id}</span>
                {waiting && (
                  <FiLock
                    aria-hidden
                    style={{ width: 10, height: 10, flex: "0 0 auto", color: "var(--color-nb-peach-ink)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
