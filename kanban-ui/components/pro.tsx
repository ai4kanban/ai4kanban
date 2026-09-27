"use client";

// Pro workflows (#1038): the mark, the account's answer, and the one way to Pro.
//
// A screen locks only when the account is KNOWN not to have Pro. When Cloud cannot say, the
// controls stay and the board's refusal at start is what answers.

import { useEffect, useState } from "react";
import { proAccessAction, workflowsAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { ProAccess, WorkflowView } from "@/lib/types";
import { configDialog } from "./Configuration";

/** What unlocks a Pro workflow here, or null when nothing is locked. */
export type ProLock = "upgrade" | "signIn" | null;

/** The account's answer, asked while `ask` holds — and again whenever the window comes back,
 *  so a purchase made in the browser unlocks without a restart. */
export function useProAccess(ask: boolean): ProAccess | null {
  const [access, setAccess] = useState<ProAccess | null>(null);
  useEffect(() => {
    if (!ask) return;
    let live = true;
    const read = () => void proAccessAction().then((a) => live && setAccess(a), () => {});
    const onShow = () => document.visibilityState === "visible" && read();
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [ask]);
  return ask ? access : null;
}

export const proLock = (access: ProAccess | null): ProLock =>
  access === "free" ? "upgrade" : access === "signed-out" ? "signIn" : null;

/** What unlocks the workflow a card names — its own, or the default when it names none. */
export function useWorkflowLock(workflow: string | undefined): ProLock {
  const [flows, setFlows] = useState<WorkflowView[] | null>(null);
  useEffect(() => {
    void workflowsAction().then((res) => setFlows(res.workflows), () => {});
  }, []);
  const flow = flows?.find((f) => f.id === (workflow || "")) ?? flows?.find((f) => f.isDefault);
  return proLock(useProAccess(!!flow?.pro));
}

/** Buying is Configuration → Billing's plans page; signing in is Configuration → Cloud. */
export function goPro(lock: ProLock): void {
  if (lock === "upgrade") configDialog.open("billing", "plans");
  else if (lock === "signIn") configDialog.open("cloud");
}

export function ProPill() {
  const mark = useCopy().shared.pro.mark;
  return (
    <span className="shrink-0 rounded-[5px] bg-nb-ink/7 px-1.5 py-0.5 text-[10px] font-[700] text-nb-ink-soft">{mark}</span>
  );
}
