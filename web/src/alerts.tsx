// The account's unread alerts in the current workspace, every channel, grouped by task. The
// board reads them for 等你处理, its unread dots and commenters; opening a task reads them.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "./api";
import { isOpen, staleDays } from "./lib/card";
import { useStore } from "./store";

export interface Unread {
  alerts: api.Alert[];
  /** Who left the unread comments, first to comment first. */
  commenters: string[];
}

const whoOf = (a: api.Alert) => (a.comment?.author.handle ? `@${a.comment.author.handle}` : (a.comment?.author.email ?? ""));

function useUnreadAlerts() {
  const store = useStore();
  const [rows, setRows] = useState<api.Alert[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(() => api.listAlerts().then(setRows, () => {}), []);
  useEffect(() => void load(), [load, store.ws.id]);
  useEffect(
    () =>
      store.onEvent((e) => {
        if (!e.type.startsWith("alert.")) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void load(), 300);
      }),
    [store, load],
  );

  const byTask = useMemo(() => {
    const ids = new Set((store.tasks ?? []).map((t) => t.id));
    const out = new Map<string, Unread>();
    for (const a of [...rows].reverse()) {
      if (!ids.has(a.task)) continue;
      const u = out.get(a.task) ?? { alerts: [], commenters: [] };
      u.alerts.push(a);
      const who = a.kind === "comment" ? whoOf(a) : "";
      if (who && !u.commenters.includes(who)) u.commenters.push(who);
      out.set(a.task, u);
    }
    return out;
  }, [rows, store.tasks]);

  /** Reading one alert reads its task, phase and kind on every channel: one call each. */
  const read = useCallback(
    (task: string) => {
      const mine = byTask.get(task)?.alerts ?? [];
      if (!mine.length) return;
      setRows((was) => was.filter((a) => a.task !== task));
      const seen = new Set<string>();
      for (const a of mine) {
        const k = `${a.phase}|${a.kind}`;
        if (seen.has(k)) continue;
        seen.add(k);
        void api.readAlert(a.id).catch(() => {});
      }
    },
    [byTask],
  );

  return { of: (task: string) => byTask.get(task), read };
}

export type Alerts = ReturnType<typeof useUnreadAlerts>;

const Ctx = createContext<Alerts | null>(null);
export const useAlerts = () => useContext(Ctx)!;
export function AlertsProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useUnreadAlerts()}>{children}</Ctx.Provider>;
}

export type Place = "needs" | "running" | "queued" | "stale";

/** The board column an open task sits in: an unread alert keeps it in 等你处理, out of 搁置. */
export function placeOf(t: api.Task, alerts: Alerts, now: number): Place | null {
  if (!isOpen(t)) return null;
  const unread = alerts.of(t.id);
  if (!unread && staleDays(t, now) > 0) return "stale";
  if (t.status === "waiting_review" || t.status === "failed" || t.status === "stopped" || t.run?.runner_removed || unread) return "needs";
  return t.status === "running" ? "running" : "queued";
}

/** How many tasks in each project sit in 等你处理, plus its chats waiting on you (no project is general's). */
export function useNeedsByProject(): Map<string, number> {
  const store = useStore();
  const alerts = useAlerts();
  const now = Date.now();
  const out = new Map<string, number>();
  const add = (p: string | undefined | null) => p && out.set(p, (out.get(p) ?? 0) + 1);
  for (const t of store.tasks ?? []) if (placeOf(t, alerts, now) === "needs") add(t.project);
  for (const c of store.chats) if (c.state === "waiting_you") add(c.project || store.general?.id);
  return out;
}
