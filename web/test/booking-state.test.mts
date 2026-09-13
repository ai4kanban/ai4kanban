// What happens to what a visitor typed (#683).
//
// The rule the booking flow lives or dies by is that nothing short of a booking
// clears the form: going back to the week, losing the hour to somebody else, and
// a submit whose answer never arrived all keep every field. The reducer is where
// that is written down, so it is where it is checked.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_FORM,
  initialState,
  reducer,
  validate,
  type State,
} from "../components/training/state.ts";
import type { PlacedSlot } from "../components/training/week.ts";

const slotAt = (at: string): PlacedSlot => ({
  at,
  state: "open",
  dayIndex: 4,
  hour: 22,
  startsAt: new Date(at),
  endsAt: new Date(new Date(at).getTime() + 3_600_000),
  offsetLabel: "UTC+8",
});

const FRIDAY = slotAt("2026-09-18T14:00:00Z");
const WEDNESDAY = slotAt("2026-09-16T14:00:00Z");

const TYPED = {
  name: "Lin Chen",
  email: "lin@example.com",
  project: "A subscription product.",
  service: "monthly" as const,
};

/** A visitor who has picked Friday and filled the form in. */
function filled(): State {
  let state = reducer(initialState, { type: "pick", slot: FRIDAY, opId: "op-1" });
  state = reducer(state, { type: "edit", patch: TYPED });
  return state;
}

const BOOKING = {
  reference: "TR-8K42C1",
  slot_at: FRIDAY.at,
  service: "monthly" as const,
  price_cents: 34900,
  name: TYPED.name,
  email: TYPED.email,
  timezone: "America/New_York",
  project: TYPED.project,
  state: "booked" as const,
};

const MANAGE = { reference: "TR-8K42C1", token: "a-token", url: "https://x/?booking=1" };

describe("picking an hour", () => {
  it("opens the form on it and mints a submission id", () => {
    const state = reducer(initialState, { type: "pick", slot: FRIDAY, opId: "op-1" });

    assert.equal(state.phase.name, "form");
    assert.equal(state.opId, "op-1");
    assert.deepEqual(state.form, EMPTY_FORM);
  });

  it("carries what was already typed onto a different hour", () => {
    const state = reducer(filled(), { type: "pick", slot: WEDNESDAY, opId: "op-2" });

    assert.deepEqual(state.form, TYPED);
    // A different hour is a different submission, so a retry of the first one
    // can never be answered with this one.
    assert.equal(state.opId, "op-2");
  });
});

describe("going back to the week", () => {
  it("keeps every field", () => {
    const state = reducer(filled(), { type: "back" });

    assert.equal(state.phase.name, "week");
    assert.deepEqual(state.form, TYPED);
  });

  it("and picking again puts them back in front of the reader", () => {
    let state = reducer(filled(), { type: "back" });
    state = reducer(state, { type: "pick", slot: WEDNESDAY, opId: "op-2" });

    assert.deepEqual(state.form, TYPED);
  });
});

describe("submitting", () => {
  it("stays on the form and names the fields when something is missing", () => {
    const state = reducer(reducer(initialState, { type: "pick", slot: FRIDAY, opId: "op-1" }), {
      type: "submit",
      fields: { name: "required", email: "required" },
    });

    assert.equal(state.phase.name, "form");
    assert.deepEqual(
      state.phase.name === "form" ? state.phase.fields : null,
      { name: "required", email: "required" },
    );
  });

  it("goes in flight when nothing is, and the button can be disabled on it", () => {
    const state = reducer(filled(), { type: "submit", fields: {} });

    assert.equal(state.phase.name, "submitting");
  });

  it("clears the complaint about a field as soon as it is typed in", () => {
    let state = reducer(filled(), { type: "submit", fields: { email: "invalid" } });
    state = reducer(state, { type: "edit", patch: { email: "lin@example.com" } });

    assert.equal(state.phase.name === "form" && state.phase.fields, undefined);
  });
});

describe("a submit that did not go through", () => {
  it("keeps the form when somebody else took the hour", () => {
    let state = reducer(filled(), { type: "submit", fields: {} });
    state = reducer(state, { type: "problem", problem: { kind: "conflict" } });

    assert.equal(state.phase.name, "form");
    assert.deepEqual(state.form, TYPED);
    assert.deepEqual(state.phase.name === "form" ? state.phase.problem : null, {
      kind: "conflict",
    });
  });

  it("keeps the form and the submission id when the answer never arrived", () => {
    let state = reducer(filled(), { type: "submit", fields: {} });
    state = reducer(state, { type: "problem", problem: { kind: "unknown" } });

    assert.deepEqual(state.form, TYPED);
    // The same id, so trying again is the same submission — the service answers
    // a repeat with the booking it already made rather than making a second.
    assert.equal(state.opId, "op-1");
    assert.equal(state.phase.name === "form" && state.phase.slot.at, FRIDAY.at);
  });

  it("retrying after an unknown result is the same submission, not a new one", () => {
    let state = reducer(filled(), { type: "submit", fields: {} });
    state = reducer(state, { type: "problem", problem: { kind: "unknown" } });
    const retried = reducer(state, { type: "submit", fields: {} });

    assert.equal(retried.phase.name, "submitting");
    assert.equal(retried.opId, "op-1");
  });

  it("shows the service's own sentence when it refused for a reason of its own", () => {
    let state = reducer(filled(), { type: "submit", fields: {} });
    state = reducer(state, {
      type: "problem",
      problem: { kind: "refused", message: "Too many booking attempts from here." },
    });

    assert.deepEqual(state.phase.name === "form" ? state.phase.problem : null, {
      kind: "refused",
      message: "Too many booking attempts from here.",
    });
    assert.deepEqual(state.form, TYPED);
  });
});

describe("the week rolling over while the page is open", () => {
  it("drops a selection the new week no longer offers, and keeps the typing", () => {
    const state = reducer(filled(), {
      type: "weekChanged",
      stillOpen: new Set([WEDNESDAY.at]),
    });

    assert.equal(state.phase.name, "week");
    assert.deepEqual(state.form, TYPED);
  });

  it("leaves a selection the new week still offers exactly where it was", () => {
    const state = reducer(filled(), { type: "weekChanged", stillOpen: new Set([FRIDAY.at]) });

    assert.equal(state.phase.name, "form");
    assert.equal(state.phase.name === "form" && state.phase.slot.at, FRIDAY.at);
  });

  it("leaves a conflict on screen when its own re-read of the week arrives", () => {
    // The component re-reads the week the moment a conflict comes back, and that
    // read reports the hour as gone — which is what the sentence on screen says.
    // Clearing the form on it would answer the reader by vanishing.
    let state = reducer(filled(), { type: "submit", fields: {} });
    state = reducer(state, { type: "problem", problem: { kind: "conflict" } });
    state = reducer(state, { type: "weekChanged", stillOpen: new Set([WEDNESDAY.at]) });

    assert.equal(state.phase.name, "form");
    assert.deepEqual(state.phase.name === "form" ? state.phase.problem : null, {
      kind: "conflict",
    });
    assert.deepEqual(state.form, TYPED);
  });

  it("never interrupts a submit that is already in flight", () => {
    const flight = reducer(filled(), { type: "submit", fields: {} });
    const state = reducer(flight, { type: "weekChanged", stillOpen: new Set() });

    assert.equal(state.phase.name, "submitting");
  });
});

describe("a booking that landed", () => {
  it("shows the result, with the manage link the confirmation carries", () => {
    const state = reducer(filled(), { type: "booked", booking: BOOKING, manage: MANAGE });

    assert.equal(state.phase.name, "done");
    assert.deepEqual(state.phase.name === "done" ? state.phase.manage : null, MANAGE);
  });

  it("opens straight to the result when a manage link is followed", () => {
    const state = reducer(initialState, { type: "restore", booking: BOOKING, manage: MANAGE });

    assert.equal(state.phase.name, "done");
  });

  it("cancels in two presses and reports the cancelled booking", () => {
    let state = reducer(initialState, { type: "restore", booking: BOOKING, manage: MANAGE });
    state = reducer(state, { type: "cancelling" });
    assert.equal(state.phase.name, "cancelling");

    state = reducer(state, { type: "cancelled", booking: { ...BOOKING, state: "cancelled" } });
    assert.equal(state.phase.name, "cancelled");
    assert.equal(state.phase.name === "cancelled" && state.phase.booking.state, "cancelled");
  });

  it("cannot be cancelled without the token that opened it", () => {
    const state = reducer(initialState, { type: "booked", booking: BOOKING });

    assert.equal(reducer(state, { type: "cancelling" }).phase.name, "done");
  });
});

describe("what counts as filled in", () => {
  it("asks for a name and an address, and checks the shape of the address", () => {
    assert.deepEqual(validate(EMPTY_FORM), { name: "required", email: "required" });
    assert.deepEqual(validate({ ...TYPED, email: "lin@example" }), { email: "invalid" });
    assert.deepEqual(validate({ ...TYPED, name: "   " }), { name: "required" });
    assert.deepEqual(validate(TYPED), {});
  });

  it("does not ask for a project note", () => {
    assert.deepEqual(validate({ ...TYPED, project: "" }), {});
  });
});
