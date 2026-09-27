"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cloudAccountAction, installedAgentsAction, proAccessAction, workflowsAction } from "@/app/actions";
import type { CloudAccount, HarnessOption, ProAccess, WorkflowView } from "./types";

// What the whole window reads once and shares (#1181): the Cloud account, its Pro answer, the
// board's workflows and the agents this machine has. One change here redraws every reader.
//
// `refresh` joins a read already on its way; `reload` starts a new one that supersedes it — a
// read started before a sign-out or a workflow write must never land on top of what followed.

interface Read<T> {
  value?: T;
  /** False when a newer read started meanwhile, so this answer was dropped. */
  latest: boolean;
}

function sharedRead<T>(read: () => Promise<T>, accept: (next: T) => boolean = () => true) {
  let value: T | null = null;
  let asked = 0;
  let pending: Promise<Read<T>> | null = null;
  const subs = new Set<() => void>();
  const put = (next: T) => {
    value = next;
    for (const fn of subs) fn();
  };
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => void subs.delete(fn);
  };

  const reload = (): Promise<Read<T>> => {
    const mine = ++asked;
    const p = read().then(
      (next): Read<T> => {
        if (mine !== asked) return { value: next, latest: false };
        if (accept(next)) put(next);
        return { value: next, latest: true };
      },
      (): Read<T> => ({ latest: mine === asked }),
    );
    pending = p;
    void p.then(() => {
      if (pending === p) pending = null;
    });
    return p;
  };

  return {
    reload,
    refresh: (): Promise<Read<T>> => pending ?? reload(),
    set(next: T) {
      asked++;
      pending = null;
      put(next);
    },
    use: (): T | null =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => null,
      ),
  };
}

// --- the Cloud account and its Pro answer ------------------------------------

export const cloudAccount = sharedRead<CloudAccount>(cloudAccountAction);
const pro = sharedRead<ProAccess>(proAccessAction);

// Pro is asked only while something on screen needs it, and again each time the window comes back.
let proNeeds = 0;
const onFocus = () => void pro.refresh();
const onShow = () => document.visibilityState === "visible" && void pro.refresh();

/** A sign-in, a sign-out or an admission changed who this machine is: read both again. */
export async function accountChanged(): Promise<Read<CloudAccount>> {
  if (proNeeds) void pro.reload();
  return cloudAccount.reload();
}

/** The account's Pro answer while `ask` holds; null otherwise. */
export function useProAccess(ask: boolean): ProAccess | null {
  const access = pro.use();
  useEffect(() => {
    if (!ask) return;
    if (proNeeds++ === 0) {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onShow);
      void pro.refresh();
    }
    return () => {
      if (--proNeeds > 0) return;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [ask]);
  return ask ? access : null;
}

// --- the board's workflows ----------------------------------------------------

export const workflows = sharedRead<{ workflows: WorkflowView[] | null; error?: string }>(workflowsAction);

/** The workflows, read again on mount so one added from a terminal shows up. Null until the first answer. */
export function useWorkflows() {
  useEffect(() => void workflows.refresh(), []);
  return workflows.use();
}

// --- the agents this machine has ---------------------------------------------

// An empty answer means the rules could not be asked, not that nothing is installed.
export const installedAgents = sharedRead<HarnessOption[]>(installedAgentsAction, (next) => next.length > 0);

/** The installed agents, read again on mount so a CLI installed since shows up. */
export function useInstalledAgents(): HarnessOption[] | null {
  useEffect(() => void installedAgents.refresh(), []);
  return installedAgents.use();
}

const lookedFor = new Set<string>();

/** An agent the list does not have yet: read the list once more for it. */
export function lookForAgent(name: string): void {
  if (lookedFor.has(name)) return;
  lookedFor.add(name);
  void installedAgents.reload();
}
