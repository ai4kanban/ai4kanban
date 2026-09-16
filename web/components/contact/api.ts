// Sending the contact form to the service (#784). The browser calls it
// cross-origin, as the booking form does (`components/training/api.ts`).

import { API_ORIGIN, newOpId } from "@/components/training/api";
import type { Problem, Values } from "./state";

export { newOpId };

const TIMEOUT_MS = 15_000;

export type SubmitResult = { ok: true } | { ok: false; problem: Problem };

/** The same `opId` on every retry, so a message whose answer was lost is not
 *  stored or mailed twice. */
export async function submitContact(opId: string, values: Values): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_ORIGIN}/v1/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        opId,
        reason: values.reason,
        email: values.email.trim(),
        message: values.message.trim(),
        workflow: values.reason === "customize" ? values.workflow.trim() : "",
      }),
    });
    if (response.ok) return { ok: true };
    if (response.status >= 500) return { ok: false, problem: "unknown" };
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === "contact_too_many_attempts") return { ok: false, problem: "limited" };
    return { ok: false, problem: "failed" };
  } catch {
    return { ok: false, problem: "unknown" };
  } finally {
    clearTimeout(timer);
  }
}
