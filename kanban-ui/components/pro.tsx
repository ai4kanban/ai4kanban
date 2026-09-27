"use client";

// Pro workflows (#1038): the mark, the account's answer, and the one way to Pro.
//
// A screen locks only when the account is KNOWN not to have Pro. When Cloud cannot say, the
// controls stay and the board's refusal at start is what answers.

import { useCopy } from "@/i18n/use-copy";
import type { ProAccess } from "@/lib/types";
import { useProAccess, useWorkflows } from "@/lib/window-state";
import { configDialog } from "./Configuration";

export { useProAccess };

/** What unlocks a Pro workflow here, or null when nothing is locked. */
export type ProLock = "upgrade" | "signIn" | null;

export const proLock = (access: ProAccess | null): ProLock =>
  access === "free" ? "upgrade" : access === "signed-out" ? "signIn" : null;

/** What unlocks the workflow a card names — its own, or the default when it names none. */
export function useWorkflowLock(workflow: string | undefined): ProLock {
  const flows = useWorkflows()?.workflows;
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
