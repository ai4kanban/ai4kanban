"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLock } from "react-icons/fi";

import { buildSubtaskMap, type MapNode } from "@/lib/subtask-map";
import type { Subtask } from "@/lib/types";

// A group's build order, drawn above the subtasks list on the root's page (#333): one chip
// per subtask, a line from a blocker to what it blocks. The list beneath says what these
// ids are, so the panel carries no heading and nothing labels a column.
//
// The picture is placed, not laid out: every chip is the same size and every column the
// same pitch, so the SVG can put a line between two chips without measuring the DOM. A
// group holds a handful of subtasks and the map never moves, so this is enough — a graph
// library would be a runtime dependency in the shipped desktop app for a static drawing.

const CHIP_H = 28;
const ROW_GAP = 14;
const COL_GAP = 46; // the channel the lines run through
const ROW_PITCH = CHIP_H + ROW_GAP;
// Room the title bubble sits in, above the top row of chips. Its height is fixed: one line
// of 10.5px text, 4px padding, clear of the chip beneath it.
const TIP_BAND = 30;

// A chip is the id and nothing else, so its width follows the longest id in the group — plus
// the lock, once any chip in the map wears one, so every column keeps the same pitch.
function chipWidth(nodes: MapNode[]): number {
  const digits = Math.max(...nodes.map((n) => String(n.id).length));
  const lock = nodes.some((n) => n.outside.length > 0) ? 14 : 0;
  return 26 + digits * 8 + lock;
}

/** The words the panel says on its own. English here while `kanban-ui/i18n/` (#335) has not
 *  landed — the same place the rest of this screen's words still sit. */
const WAITING = (ids: number[]) =>
  `waiting on ${ids.map((n) => `#${n}`).join(", ")}, outside this group`;

export function SubtaskMap({ subtasks }: { subtasks: Subtask[] }) {
  // The hovered chip's title, drawn OUTSIDE the scroll box. `.nb-tip` would put it inside,
  // where the box clips it once the map scrolls and where it widens what can be scrolled to
  // even when the map itself fits.
  const [tip, setTip] = useState("");
  const map = buildSubtaskMap(subtasks);
  if (!map) return null;

  const chipW = chipWidth(map.nodes);
  const colPitch = chipW + COL_GAP;
  const rows: number[] = new Array(map.layers).fill(0);
  const at = new Map<number, { x: number; y: number }>();
  for (const n of map.nodes) {
    const row = rows[n.layer]++;
    at.set(n.id, { x: n.layer * colPitch, y: TIP_BAND + row * ROW_PITCH });
  }
  const width = (map.layers - 1) * colPitch + chipW;
  const height = TIP_BAND + (Math.max(...rows) - 1) * ROW_PITCH + CHIP_H;

  return (
    <div className="nb-outline bg-nb-paper p-3">
      <div className="relative">
        {tip && (
          <div
            className="pointer-events-none absolute left-1 top-[2px] z-30 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[6px] bg-nb-ink px-[7px] py-[4px] text-[10.5px] font-[700] text-nb-cream"
            aria-hidden
          >
            {tip}
          </div>
        )}
        {/* Wider than the panel, it scrolls sideways: a drawing whose columns wrap is a
            different drawing. */}
        <div className="overflow-x-auto px-1">
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
              const waiting = n.outside.length > 0 ? WAITING(n.outside) : "";
              const title = waiting ? `${n.title} — ${waiting}` : n.title;
              return (
                <Link
                  key={n.id}
                  href={`/${n.id}`}
                  // The bubble is a plain div no screen reader reads, and `#123` is the only
                  // text in the link — so the name is spelled out.
                  aria-label={`#${n.id} ${n.title}${waiting ? ` — ${waiting}` : ""}`}
                  onMouseEnter={() => setTip(title)}
                  onMouseLeave={() => setTip("")}
                  onFocus={() => setTip(title)}
                  onBlur={() => setTip("")}
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
    </div>
  );
}
