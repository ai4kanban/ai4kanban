// Copied from legacy kanban-ui/components/Queue.tsx: columns that scroll sideways, module bands
// in 等你处理, the stale column longest-forgotten first, and at phone width one column at a time,
// swiped, under a band naming it. 等你处理 (to review, didn't finish, anything unread) fills the
// width; 进行中, 排队中 and 搁置 (5 days untouched, nothing unread) are narrow beside it.

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Task } from "../api";
import { placeOf, useAlerts, type Place } from "../alerts";
import { T } from "../i18n";
import { byQueueOrder, staleDays } from "../lib/card";
import { useStore } from "../store";
import { BoardCard } from "./BoardCard";
import { HAIRLINE } from "@review/components/chrome";

const HEAD: Record<Place, { bar: string; dot: string }> = {
  needs: { bar: "bg-nb-accent-soft", dot: "text-nb-accent" },
  running: { bar: "bg-nb-wash", dot: "text-nb-sky" },
  queued: { bar: "bg-nb-wash", dot: "text-nb-ink/30" },
  stale: { bar: "bg-nb-ink/10", dot: "text-nb-ink/50" },
};

const MAIN_W = "min-w-[min(528px,calc(100vw-2rem))] flex-1";
const SIDE_W = "w-[min(300px,calc(100vw-2rem))] shrink-0";

type Col = { key: Place; title: string; count: string; body: ReactNode };

export function Queue({ tasks, phone }: { tasks: Task[]; phone: boolean }) {
  const store = useStore();
  const alerts = useAlerts();
  const [now] = useState(Date.now);
  const order = byQueueOrder((t) => store.cardOf(t));
  const at = (p: Place) => tasks.filter((t) => placeOf(t, alerts, now) === p);
  const needs = at("needs");
  const unread = needs.filter((t) => alerts.of(t.id)).length;
  const running = at("running").sort(order);
  const queued = at("queued").sort(order);
  const blocked = queued.filter((t) => store.cardOf(t)?.blockedBy.length).length;
  const stale = at("stale")
    .map((task) => ({ task, days: staleDays(task, now) }))
    .sort((a, b) => b.days - a.days || order(a.task, b.task));
  const cols: Col[] = [
    { key: "needs", title: T.columns.needs, count: T.counts.needs(needs.length, unread), body: <Bands tasks={needs} /> },
    { key: "running", title: T.columns.running, count: T.counts.running(running.length), body: <List tasks={running} /> },
    { key: "queued", title: T.columns.queued, count: T.counts.queued(queued.length, blocked), body: <List tasks={queued} /> },
    {
      key: "stale",
      title: T.columns.stale,
      count: String(stale.length),
      body: stale.length ? (
        <div className="flex flex-col gap-3 px-2 pb-3 pt-2">
          {stale.map(({ task, days }) => (
            <BoardCard key={task.id} task={task} staleDays={days} />
          ))}
        </div>
      ) : (
        <Empty />
      ),
    },
  ];
  if (phone) return <Swiped cols={cols} />;
  return (
    <div className="a4k-reveal flex h-full min-h-0 items-stretch gap-8 overflow-x-auto p-4">
      {cols.map((col) => (
        <section key={col.key} className={`flex min-h-0 flex-col ${col.key === "needs" ? MAIN_W : SIDE_W}`}>
          <div className={`mb-3 flex h-8 shrink-0 items-center justify-between gap-3 rounded-[10px] px-2.5 ${HEAD[col.key].bar}`}>
            <h2 className="nb-tag whitespace-nowrap">
              <span className={HEAD[col.key].dot}>●</span>
              {col.title}
            </h2>
            <span className="min-w-0 truncate text-[12px] text-nb-ink-soft">{col.count}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1 pl-px pr-1 pt-px">{col.body}</div>
        </section>
      ))}
    </div>
  );
}

const Empty = () => <p className="px-2 text-[12px] italic text-nb-ink-soft">{T.emptyColumn}</p>;

function List({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <Empty />;
  return (
    <div className="flex flex-col gap-3 px-2 pb-3 pt-2">
      {tasks.map((task) => (
        <BoardCard key={task.id} task={task} />
      ))}
    </div>
  );
}

/** 等你处理's module bands, the unread first in each. */
function Bands({ tasks }: { tasks: Task[] }) {
  const store = useStore();
  const alerts = useAlerts();
  if (!tasks.length) return <Empty />;
  const queue = byQueueOrder((t) => store.cardOf(t));
  const order = (a: Task, b: Task) => Number(!alerts.of(a.id)) - Number(!alerts.of(b.id)) || queue(a, b);
  const moduleOf = (t: Task) => store.cardOf(t)?.modules[0] ?? "";
  const modules = [...new Set(tasks.map(moduleOf))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : 0));
  return (
    <div className="flex flex-col gap-2">
      {modules.map((m) => {
        const band = tasks.filter((t) => moduleOf(t) === m).sort(order);
        return (
          <section key={m} className="rounded-[10px] px-2 pb-3 pt-2">
            <div className="mb-2.5 flex items-center gap-2.5">
              <h3 className="nb-tag whitespace-nowrap text-[10.5px]">{m || T.otherModule}</h3>
              <span aria-hidden className="h-px flex-1" style={{ background: HAIRLINE }} />
              <span className="text-[11px] tabular-nums text-nb-ink-soft">{band.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {band.map((task) => (
                <BoardCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Phone width: one column on screen, swiped, the dots saying which (legacy SwipedColumns). */
function Swiped({ cols }: { cols: Col[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    setAt(Math.round(el.scrollLeft / el.clientWidth));
  }, []);
  const go = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "smooth" });
  const here = cols[Math.min(at, cols.length - 1)]!;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 shrink-0 items-center gap-2 px-4">
        <h2 className="nb-tag shrink-0 whitespace-nowrap">
          <span className={HEAD[here.key].dot}>●</span>
          {here.title}
        </h2>
        <span className="min-w-0 truncate text-[12px] text-nb-ink-soft">{here.count}</span>
        <span className="ml-auto flex shrink-0 items-center">
          {cols.map((col, i) => (
            <button key={col.key} type="button" onClick={() => go(i)} aria-label={T.goToColumn(col.title)} aria-current={col === here ? "true" : undefined} className="grid h-10 w-4 cursor-pointer place-items-center">
              <span aria-hidden className={`block size-2 rounded-full ${col === here ? "bg-nb-ink" : "bg-nb-ink/25"}`} />
            </button>
          ))}
        </span>
      </div>
      <div ref={strip} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {cols.map((col) => (
          <section key={col.key} aria-label={col.title} className="min-h-0 w-full shrink-0 snap-center overflow-y-auto overscroll-y-contain px-2 pb-3">
            {col.body}
          </section>
        ))}
      </div>
    </div>
  );
}
