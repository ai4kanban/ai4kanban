"use client";

// The account's Pro answer, and the one way to Pro (#1038).
//
// A screen locks only when the account is KNOWN not to have Pro.

import type { ProAccess } from "@/lib/types";
import { useProAccess } from "@/lib/window-state";
import { configDialog } from "./Configuration";

export { useProAccess };

/** What unlocks a Pro feature here, or null when nothing is locked. */
export type ProLock = "upgrade" | "signIn" | null;

export const proLock = (access: ProAccess | null): ProLock =>
  access === "free" ? "upgrade" : access === "signed-out" ? "signIn" : null;

/** Buying is Configuration → Billing's plans page; signing in is Configuration → Cloud. */
export function goPro(lock: ProLock): void {
  if (lock === "upgrade") configDialog.open("billing", "plans");
  else if (lock === "signIn") configDialog.open("cloud");
}
