// Where the booking flow is, and what happens to what you typed (#683).
//
// A reducer rather than a scatter of `useState` calls, because the rule that
// matters is a rule about transitions: going back to the week, being beaten to
// an hour, and a submit whose answer never arrived all keep the form intact.
// Written down here, each of those is one line and a test in
// `web/test/booking-state.test.mts`; spread across handlers it is three chances
// to clear a field somebody typed.
//
// It is pure — no `fetch`, no React. The component calls it and does the I/O.

import type { PlacedSlot } from "./week";

export type ServiceId = "single" | "monthly";

export type FormValues = {
  name: string;
  email: string;
  project: string;
  service: ServiceId;
};

export const EMPTY_FORM: FormValues = {
  name: "",
  email: "",
  project: "",
  service: "single",
};

/** What the fields themselves are wrong about. Shown beside each one. */
export type FieldErrors = Partial<Record<"name" | "email", "required" | "invalid">>;

/**
 * What went wrong with a submit, if anything.
 *
 * - `conflict` — somebody took the hour first. Not a failure: pick another.
 * - `unknown` — the answer never arrived. Retrying is safe, because the submit
 *   carries the same id and the service answers a repeat with the same booking.
 * - `refused` — the service said no and said why. Its sentence is shown.
 */
export type Problem =
  | { kind: "conflict" }
  | { kind: "unknown" }
  | { kind: "refused"; message: string };

/** What the visitor booked, as the service reports it. */
export type Booking = {
  reference: string;
  slot_at: string;
  service: ServiceId;
  price_cents: number;
  name: string;
  email: string;
  timezone: string;
  project: string;
  state: "booked" | "cancelled";
};

export type Manage = { reference: string; token: string; url: string };

export type Phase =
  | { name: "week" }
  | { name: "form"; slot: PlacedSlot; problem?: Problem; fields?: FieldErrors }
  | { name: "submitting"; slot: PlacedSlot }
  | { name: "done"; booking: Booking; manage?: Manage }
  | { name: "cancelling"; booking: Booking; manage: Manage }
  | { name: "cancelled"; booking: Booking };

export type State = {
  phase: Phase;
  /** Kept across every transition below. The one exception is a booking that
   *  landed, which replaces it with what was actually stored. */
  form: FormValues;
  /**
   * The id this submit and every retry of it carry. Minted when an hour is
   * picked, so a retry after an unknown result is the same submission and the
   * service answers it with the booking it already made — and picking a
   * different hour is a different submission, because it is one.
   */
  opId: string;
};

export const initialState: State = { phase: { name: "week" }, form: EMPTY_FORM, opId: "" };

export type Action =
  | { type: "pick"; slot: PlacedSlot; opId: string }
  | { type: "back" }
  | { type: "edit"; patch: Partial<FormValues> }
  | { type: "submit"; fields: FieldErrors }
  | { type: "booked"; booking: Booking; manage?: Manage }
  | { type: "problem"; problem: Problem }
  /** The week rolled over while the page was open. `stillOpen` is the set of
   *  instants the new week offers. */
  | { type: "weekChanged"; stillOpen: ReadonlySet<string> }
  | { type: "restore"; booking: Booking; manage: Manage }
  | { type: "cancelling" }
  | { type: "cancelled"; booking: Booking };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "pick":
      // A new hour is a new submission. What was typed comes with it.
      return { ...state, phase: { name: "form", slot: action.slot }, opId: action.opId };

    case "back":
      return { ...state, phase: { name: "week" } };

    case "edit":
      return {
        ...state,
        form: { ...state.form, ...action.patch },
        // Typing clears the complaint about what you are typing, and the last
        // submit's problem with it — the sentence was about the old attempt.
        phase: state.phase.name === "form" ? { name: "form", slot: state.phase.slot } : state.phase,
      };

    case "submit": {
      if (state.phase.name !== "form") return state;
      if (Object.keys(action.fields).length > 0) {
        return { ...state, phase: { ...state.phase, fields: action.fields, problem: undefined } };
      }
      return { ...state, phase: { name: "submitting", slot: state.phase.slot } };
    }

    case "booked":
      return { ...state, phase: { name: "done", booking: action.booking, manage: action.manage } };

    case "problem": {
      const slot = slotOf(state.phase);
      if (!slot) return state;
      // Back to the form with everything still in it. A conflict sends the
      // reader to the week to choose again, but only when they press.
      return { ...state, phase: { name: "form", slot, problem: action.problem } };
    }

    case "weekChanged": {
      const slot = slotOf(state.phase);
      // A submit in flight is left alone: its answer decides, not the clock.
      if (state.phase.name === "submitting") return state;
      if (!slot) return state;
      // A problem on screen is a sentence nobody has read yet. A conflict's own
      // re-read of the week arrives a moment after it, and the hour it reports
      // gone is the one the sentence is about — dropping the form here would
      // answer "that hour was just booked" by silently returning to the grid.
      if (state.phase.name === "form" && state.phase.problem) return state;
      // The hour they had chosen is not on offer any more, so the choice goes
      // and what they typed stays.
      if (!action.stillOpen.has(slot.at)) return { ...state, phase: { name: "week" } };
      return state;
    }

    case "restore":
      return {
        ...state,
        phase: { name: "done", booking: action.booking, manage: action.manage },
      };

    case "cancelling":
      if (state.phase.name !== "done" || !state.phase.manage) return state;
      return {
        ...state,
        phase: { name: "cancelling", booking: state.phase.booking, manage: state.phase.manage },
      };

    case "cancelled":
      return { ...state, phase: { name: "cancelled", booking: action.booking } };
  }
}

function slotOf(phase: Phase): PlacedSlot | null {
  return phase.name === "form" || phase.name === "submitting" ? phase.slot : null;
}

/** What is wrong with the fields, if anything. The email check is the shape only
 *  — whether an address receives mail is answered by the confirmation arriving. */
export function validate(form: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "required";
  if (!form.email.trim()) errors.email = "required";
  else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(form.email.trim())) errors.email = "invalid";
  return errors;
}
