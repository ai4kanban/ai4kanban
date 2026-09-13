// Talking to the booking service (#683).
//
// The site is a static export, so there is no server of ours between the page
// and `api.ai4kanban.dev` — the browser calls it directly, cross-origin, and the
// service echoes this origin back (`cloud/src/training.ts`).
//
// The one thing worth reading twice is `submitBooking`. A request that never
// answers is not a booking that did not happen: the hold may have landed and the
// reply been lost. So a timeout or a dropped connection comes back as `unknown`
// rather than a failure, and every retry carries the same `opId`, which the
// service answers with the booking it already made.

import type { Booking, FormValues, Manage, Problem } from "./state";
import type { Slot } from "./week";

/** Where the booking service answers. */
export const API_ORIGIN = "https://api.ai4kanban.dev";

/** How long the page waits before it stops knowing. Past this the answer is
 *  unknown, not absent — the difference the retry rests on. */
const TIMEOUT_MS = 15_000;

type Refusal = { code: string; message: string };

async function refusalOf(response: Response): Promise<Refusal> {
  const body = (await response.json().catch(() => null)) as { error?: Refusal } | null;
  return body?.error ?? { code: "service_unavailable", message: "" };
}

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export type Availability = { slots: Slot[] };

/** The hours in the visitor's own week. Throws on anything that is not an
 *  answer — the grid shows a retry in place rather than an empty week, because
 *  an empty week and a failed read are not the same thing to a reader. */
export async function readAvailability(from: Date, to: Date): Promise<Availability> {
  const { signal, done } = withTimeout();
  try {
    const url = new URL(`${API_ORIGIN}/v1/training/availability`);
    url.searchParams.set("from", from.toISOString());
    url.searchParams.set("to", to.toISOString());
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error((await refusalOf(response)).message);
    return (await response.json()) as Availability;
  } finally {
    done();
  }
}

export type SubmitResult =
  | { ok: true; booking: Booking; manage: Manage }
  | { ok: false; problem: Problem };

/** Take the hour. The same `opId` every time this submission is tried. */
export async function submitBooking(input: {
  opId: string;
  slotAt: string;
  timezone: string;
  form: FormValues;
}): Promise<SubmitResult> {
  const { signal, done } = withTimeout();
  try {
    const response = await fetch(`${API_ORIGIN}/v1/training/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        opId: input.opId,
        slotAt: input.slotAt,
        timezone: input.timezone,
        service: input.form.service,
        name: input.form.name.trim(),
        email: input.form.email.trim(),
        project: input.form.project.trim(),
      }),
    });

    if (response.ok) {
      const body = (await response.json()) as { booking: Booking; manage: Manage };
      return { ok: true, booking: body.booking, manage: body.manage };
    }

    const refusal = await refusalOf(response);
    if (refusal.code === "training_slot_taken") return { ok: false, problem: { kind: "conflict" } };
    // A 5xx is the one answer that leaves the hold undecided: the service may
    // have written the row and failed on the way back. Everything else it
    // refused — the rate limit and the day's write budget included — it refused
    // before writing, and said why in a sentence meant to be shown.
    if (response.status >= 500) return { ok: false, problem: { kind: "unknown" } };
    return { ok: false, problem: { kind: "refused", message: refusal.message } };
  } catch {
    // Aborted, or the network went away mid-flight. Whether the hold landed is
    // exactly what we do not know.
    return { ok: false, problem: { kind: "unknown" } };
  } finally {
    done();
  }
}

/** One booking, to whoever holds its token — what the manage link opens. */
export async function readBooking(reference: string, token: string): Promise<Booking | null> {
  const { signal, done } = withTimeout();
  try {
    const url = new URL(`${API_ORIGIN}/v1/training/bookings/${encodeURIComponent(reference)}`);
    url.searchParams.set("token", token);
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    return ((await response.json()) as { booking: Booking }).booking;
  } catch {
    return null;
  } finally {
    done();
  }
}

export async function cancelBooking(reference: string, token: string): Promise<Booking | null> {
  const { signal, done } = withTimeout();
  try {
    const response = await fetch(
      `${API_ORIGIN}/v1/training/bookings/${encodeURIComponent(reference)}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal,
        body: JSON.stringify({ token }),
      },
    );
    if (!response.ok) return null;
    return ((await response.json()) as { booking: Booking }).booking;
  } catch {
    return null;
  } finally {
    done();
  }
}

/** A submission id. `randomUUID` where it exists; a random string where the page
 *  is opened over plain http, which is only ever a developer's own machine. */
export function newOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
