"use client";

import { useState, type ReactNode } from "react";
import { quickview, type QvMore, type QvTask } from "../content";
import type { HomeCopy } from "@/i18n/types";

type Mode = "task" | "file";

// The tree itself is a literal capture of a real board in a terminal, so its
// rows stay English in every language — only the caption and the flip labels
// around it are translated.

// Terminal syntax palette — its own colors, distinct from the site's blue accent
// so the tree reads like a real capture from the CLI.
const term = {
  bg: "#0d1117",
  text: "#e6edf3",
  dim: "#7d8590",
  branch: "#3d444d",
  teal: "#56d4c4", // sections, todo, the ● bullet
  amber: "#e3b341", // task ids — set apart from the teal section headers
  blue: "#79c0ff", // med
  pink: "#f778ba", // low
};

// Priority summaries ("med 11 · low 3 · unset 3") color each token by its first
// word; everything else in the tree that looks like metadata stays dim.
function Counts({ text }: { text: string }) {
  return (
    <>
      {text.split(" · ").map((seg, i) => {
        const key = seg.split(" ")[0];
        const color =
          key === "med" ? term.blue : key === "low" ? term.pink : term.dim;
        return (
          <span key={i} style={{ color }}>
            {i > 0 && <span style={{ color: term.dim }}> · </span>}
            {seg}
          </span>
        );
      })}
    </>
  );
}

// One tree line: a dim branch prefix, then whatever content the row carries.
function Line({ prefix, children }: { prefix: string; children: ReactNode }) {
  return (
    <div className="whitespace-pre">
      <span style={{ color: term.branch }}>{prefix}</span>
      {children}
    </div>
  );
}

function TaskRow({
  task,
  mode,
  prefix,
}: {
  task: QvTask;
  mode: Mode;
  prefix: string;
}) {
  return (
    <Line prefix={prefix}>
      <span style={{ color: term.amber }}>#{task.id}</span>{" "}
      <span style={{ color: term.text }}>
        {mode === "task" ? task.task : task.file}
      </span>
      {mode === "task" && task.tracking && (
        <span style={{ color: term.dim }}> (tracking task)</span>
      )}
      {task.meta && <span style={{ color: term.dim }}>{"  " + task.meta}</span>}
    </Line>
  );
}

function MoreRow({ tail, prefix }: { tail: QvMore; prefix: string }) {
  return (
    <Line prefix={prefix}>
      <span style={{ color: term.dim }}>{`… ${tail.more} more`}</span>
      {tail.counts && (
        <>
          <span style={{ color: term.dim }}>{"  "}</span>
          <Counts text={tail.counts} />
        </>
      )}
    </Line>
  );
}

// The rendered tree for one mode. Both cards render this; only `mode` differs,
// which is what makes the flip feel like the same board seen two ways.
function TaskTree({ mode }: { mode: Mode }) {
  const { todo, groups } = quickview;
  // Top-level rows = direct todo tasks followed by the stage groups; the very
  // last one (recurring) closes the branch with └── and drops the │ spine.
  const topCount = todo.length + groups.length;

  return (
    <div
      className="font-mono leading-[1.55] tabular-nums"
      style={{ fontSize: "clamp(7px, 1.7vw, 10px)" }}
    >
      {/* Header */}
      <div className="whitespace-pre">
        <span className="font-bold" style={{ color: term.text }}>
          Kanban Quickview
        </span>
        <span style={{ color: term.dim }}>
          {"   " + quickview.date + "   ·   " + quickview.open + " open"}
        </span>
      </div>

      <div className="mt-3 whitespace-pre">
        <span style={{ color: term.teal }}>●</span>{" "}
        <span className="font-bold" style={{ color: term.text }}>
          TASK TREE
        </span>
        <span style={{ color: term.dim }}>
          {`  (${quickview.open} open · ${quickview.high} high)`}
        </span>
      </div>

      <div className="mt-1 whitespace-pre">
        <span style={{ color: term.teal }}>todo</span>
      </div>

      {/* Direct todo tasks */}
      {todo.map((t, i) => {
        const last = i === topCount - 1; // never true — groups follow
        return (
          <TaskRow
            key={t.id}
            task={t}
            mode={mode}
            prefix={last ? "└── " : "├── "}
          />
        );
      })}

      {/* Stage groups */}
      {groups.map((g, gi) => {
        const groupLast = todo.length + gi === topCount - 1;
        const spine = groupLast ? "    " : "│   "; // child continuation column
        const rows = g.tasks.length + (g.tail ? 1 : 0);
        return (
          <div key={g.name}>
            <Line prefix={groupLast ? "└── " : "├── "}>
              <span style={{ color: term.teal }}>{g.name}</span>
              {g.meta && (
                <span style={{ color: term.dim }}>{"  " + g.meta}</span>
              )}
            </Line>
            {g.tasks.map((t, ti) => {
              const childLast = !g.tail && ti === rows - 1;
              return (
                <TaskRow
                  key={t.id}
                  task={t}
                  mode={mode}
                  prefix={spine + (childLast ? "└── " : "├── ")}
                />
              );
            })}
            {g.tail && <MoreRow tail={g.tail} prefix={spine + "└── "} />}
          </div>
        );
      })}
    </div>
  );
}

// A single terminal window: the tree on a dark panel with the site's hard
// offset shadow, so it sits in the same visual family as the page's cards.
function TerminalCard({ mode }: { mode: Mode }) {
  return (
    <div
      className="overflow-hidden rounded-lg border-2 border-border p-4 shadow-[8px_8px_0_0_#010409] sm:p-5"
      style={{ backgroundColor: term.bg }}
    >
      <TaskTree mode={mode} />
    </div>
  );
}

// How far the back card peeks out from behind the front one (px).
const PEEK = 56;

export function Quickview({ c }: { c: HomeCopy["quickview"] }) {
  const label: Record<Mode, string> = { task: c.taskView, file: c.fileView };
  const [front, setFront] = useState<Mode>("task");
  const back: Mode = front === "task" ? "file" : "task";
  // Paint back-to-front so the front card wins the stacking order naturally.
  const order: Mode[] = [back, front];

  return (
    <div>
      {/* PEEK is how far the back card juts out (down-right). The container
          reserves that much room on the right/bottom so the offset stays in
          bounds, and each card is narrowed by the same amount — front pinned
          top-left, back shifted into the reserved gap so it sits half-behind. */}
      <div
        className="relative mx-auto w-full max-w-2xl"
        style={{ paddingRight: PEEK, paddingBottom: PEEK }}
      >
        {/* Invisible sizer establishes the container height; the real cards are
            absolutely positioned on top of it. */}
        <div aria-hidden className="pointer-events-none invisible">
          <TerminalCard mode={front} />
        </div>

        {order.map((mode) => {
          const isFront = mode === front;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setFront(mode)}
              aria-label={(isFront ? c.frontAria : c.flipAria).replace(
                "{view}",
                label[mode],
              )}
              aria-pressed={isFront}
              className="group absolute left-0 top-0 origin-top-left text-left transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              style={{
                width: `calc(100% - ${PEEK}px)`,
                zIndex: isFront ? 20 : 10,
                transform: isFront
                  ? "translate(0px, 0px)"
                  : `translate(${PEEK}px, ${PEEK}px)`,
                cursor: isFront ? "default" : "pointer",
              }}
              tabIndex={isFront ? -1 : 0}
            >
              <TerminalCard mode={mode} />
              {/* Shadow overlay dims the back card and fades away as it comes
                  forward; lightens on hover to signal it's clickable. */}
              <span
                aria-hidden
                className={
                  "pointer-events-none absolute inset-0 rounded-lg bg-black/60 transition-opacity duration-300 " +
                  (isFront ? "opacity-0" : "opacity-100 group-hover:opacity-40")
                }
              />
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted">{c.caption}</p>
    </div>
  );
}
