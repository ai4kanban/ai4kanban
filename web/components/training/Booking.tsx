"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { SectionHeading } from "@/components/SectionHeading";
import type { TrainingCopy } from "@/i18n/training/types";
import { BookingForm } from "./BookingForm";
import { BookingResult } from "./BookingResult";
import { BOOKING_ANCHOR } from "./Sections";
import { WeekGrid } from "./WeekGrid";
import {
  cancelBooking,
  newOpId,
  readAvailability,
  readBooking,
  submitBooking,
} from "./api";
import { initialState, reducer, validate } from "./state";
import type { PlacedSlot, Slot, Week } from "./week";
import { browserZone, currentWeek, weekLabel } from "./week";

// The page's one client island (#683): the week, the form, and the result.
//
// It is a client component for one reason — only the browser knows what zone it
// is being read in, and every hour on this page is drawn in that zone. Nothing
// concrete is drawn until it has answered: a server-rendered grid would be a
// grid in somebody else's day, and correcting it on hydration would move the
// hour a reader was about to press.
//
// The three things worth reading the code for:
//
//   the zone     detected, and asked for when the browser will not say. Until
//                one is settled the section is a placeholder, not a wrong week.
//   the week     recomputed on a timer, so a page left open past midnight on
//                Sunday shows the new week. What was typed survives that; a
//                selection the new week no longer offers does not.
//   the submit   `state.ts` holds the rule that a failure never costs what was
//                typed, and `api.ts` the rule that an answer we did not hear is
//                unknown rather than absent.

/** How often the page checks whether its week is still the current one. A minute
 *  is far more often than a week rolls over and cheap enough not to matter. */
const WEEK_TICK_MS = 60_000;

/** A short list, because it is a fallback and not a zone picker: one per broad
 *  region, plus UTC. A visitor whose browser will not say picks the nearest. */
const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type Load =
  | { name: "loading" }
  | { name: "ready"; slots: Slot[] }
  | { name: "failed" };

export function Booking({ t, locale }: { t: TrainingCopy; locale: string }) {
  const [zone, setZone] = useState<string | null>(null);
  const [zoneAsked, setZoneAsked] = useState(false);
  const [week, setWeek] = useState<Week | null>(null);
  const [load, setLoad] = useState<Load>({ name: "loading" });
  const [state, dispatch] = useReducer(reducer, initialState);
  const [cancelling, setCancelling] = useState(false);
  const [manageState, setManageState] = useState<"none" | "loading" | "failed">("none");

  // 1. What zone is this being read in? Effect rather than render, because the
  //    server has no answer and the two must not disagree.
  useEffect(() => {
    const found = browserZone();
    if (found) setZone(found);
    setZoneAsked(true);
  }, []);

  // 2. A manage link. `?booking=…&token=…` opens that one booking instead of the
  //    week — the link from the confirmation email, and the only way in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("booking");
    const token = params.get("token");
    if (!reference || !token) return;

    setManageState("loading");
    let live = true;
    void readBooking(reference, token).then((booking) => {
      if (!live) return;
      if (!booking) {
        setManageState("failed");
        return;
      }
      setManageState("none");
      dispatch({ type: "restore", booking, manage: { reference, token, url: window.location.href } });
    });
    return () => {
      live = false;
    };
  }, []);

  // 3. Which week is it, here? Rechecked on a timer so a page open across the
  //    boundary moves with it.
  useEffect(() => {
    if (!zone) return;
    const settle = () => {
      const next = currentWeek(new Date(), zone);
      setWeek((held) => (held && held.from.getTime() === next.from.getTime() ? held : next));
    };
    settle();
    const timer = setInterval(settle, WEEK_TICK_MS);
    return () => clearInterval(timer);
  }, [zone]);

  // 4. What is open in it.
  const fetchWeek = useCallback(
    (target: Week) => {
      setLoad({ name: "loading" });
      let live = true;
      void readAvailability(target.from, target.to)
        .then((answer) => {
          if (!live) return;
          setLoad({ name: "ready", slots: answer.slots });
          // A week that rolled over may no longer offer the hour that was
          // chosen. The choice goes; what was typed stays.
          dispatch({
            type: "weekChanged",
            stillOpen: new Set(answer.slots.filter((s) => s.state === "open").map((s) => s.at)),
          });
        })
        .catch(() => {
          if (live) setLoad({ name: "failed" });
        });
      return () => {
        live = false;
      };
    },
    [],
  );

  useEffect(() => {
    if (!week) return;
    return fetchWeek(week);
  }, [week, fetchWeek]);

  // A tab left open is a week that stopped being true a while ago. Re-read when
  // the reader comes back to it, rather than letting them press an hour that was
  // taken an hour earlier and find out only at the submit.
  useEffect(() => {
    if (!week) return;
    const refresh = () => {
      if (document.visibilityState === "visible") fetchWeek(week);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [week, fetchWeek]);

  const label = useMemo(
    () => (week && zone ? weekLabel(week, zone, locale) : ""),
    [week, zone, locale],
  );

  const onPick = (slot: PlacedSlot) => dispatch({ type: "pick", slot, opId: newOpId() });

  const onSubmit = async () => {
    if (state.phase.name !== "form" || !zone) return;
    const slot = state.phase.slot;
    const fields = validate(state.form);
    dispatch({ type: "submit", fields });
    if (Object.keys(fields).length > 0) return;

    const result = await submitBooking({
      opId: state.opId,
      slotAt: slot.at,
      timezone: zone,
      form: state.form,
    });

    if (result.ok) {
      dispatch({ type: "booked", booking: result.booking, manage: result.manage });
      // This page's own copy of the week is stale the moment the hold lands.
      if (week) fetchWeek(week);
      return;
    }
    dispatch({ type: "problem", problem: result.problem });
    // A conflict means somebody else's booking is now in the week. Re-read it so
    // going back shows what is really left.
    if (result.problem.kind === "conflict" && week) fetchWeek(week);
  };

  const onCancel = async () => {
    if (state.phase.name !== "done" || !state.phase.manage) return;
    const { reference, token } = state.phase.manage;
    setCancelling(true);
    dispatch({ type: "cancelling" });
    const booking = await cancelBooking(reference, token);
    setCancelling(false);
    if (booking) {
      dispatch({ type: "cancelled", booking });
      if (week) fetchWeek(week);
    }
  };

  const backToWeek = () => {
    // Leaving the manage link behind, so a refresh does not reopen a booking
    // that is no longer there. The week is re-read on the way: somebody else may
    // have taken an hour while this reader was on the form.
    window.history.replaceState(null, "", window.location.pathname);
    dispatch({ type: "back" });
    if (week) fetchWeek(week);
  };

  return (
    <section id={BOOKING_ANCHOR} className="mt-14 scroll-mt-24">
      <SectionHeading num="05" eyebrow={t.booking.heading.eyebrow} title={t.booking.heading.title} />

      {manageState === "loading" && <Placeholder>{t.result.manageLoading}</Placeholder>}
      {manageState === "failed" && (
        <p role="status" className="mt-4 rounded-lg bg-band px-4 py-3 text-sm">
          {t.result.manageFailed}
        </p>
      )}

      {state.phase.name === "done" || state.phase.name === "cancelling" ? (
        <BookingResult
          t={t}
          locale={locale}
          booking={state.phase.booking}
          manage={state.phase.manage}
          cancelling={cancelling}
          onCancel={onCancel}
          onBackToWeek={backToWeek}
        />
      ) : state.phase.name === "cancelled" ? (
        <BookingResult
          t={t}
          locale={locale}
          booking={state.phase.booking}
          cancelling={false}
          onCancel={onCancel}
          onBackToWeek={backToWeek}
        />
      ) : state.phase.name === "form" || state.phase.name === "submitting" ? (
        <BookingForm
          t={t}
          locale={locale}
          zone={zone ?? "UTC"}
          slot={state.phase.slot}
          form={state.form}
          problem={state.phase.name === "form" ? state.phase.problem : undefined}
          fields={state.phase.name === "form" ? state.phase.fields : undefined}
          submitting={state.phase.name === "submitting"}
          onEdit={(patch) => dispatch({ type: "edit", patch })}
          onSubmit={() => void onSubmit()}
          onBack={backToWeek}
        />
      ) : !zoneAsked ? (
        <Placeholder>{t.booking.loading}</Placeholder>
      ) : !zone ? (
        // The browser would not say. Rather than guessing — and drawing a week
        // in the wrong day — the reader picks.
        <div className="mt-4 max-w-md rounded-xl bg-band px-5 py-4">
          <p className="text-sm">{t.booking.zonePrompt}</p>
          <label className="mt-3 block text-sm font-semibold">
            {t.booking.zoneLabel}
            <select
              className="mt-2 w-full rounded-lg border-2 border-border bg-elev px-3 py-2 text-sm"
              defaultValue=""
              onChange={(event) => event.target.value && setZone(event.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {FALLBACK_ZONES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : !week || load.name === "loading" ? (
        <Placeholder>{t.booking.loading}</Placeholder>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-2xl font-bold tracking-tight">
              {label}
              <span className="ml-3 text-sm font-normal text-muted">{t.booking.thisWeek}</span>
            </h3>
            <p className="text-sm text-muted">{t.booking.zoneNote.replace("{zone}", zone)}</p>
          </div>

          {/* A failed read is said in place, above the grid it belongs to. It is
              never drawn as an empty week: "nothing is open" and "we could not
              find out" are different sentences and only one of them is true. */}
          {load.name === "failed" ? (
            <div role="alert" className="mt-4 rounded-lg bg-code px-4 py-3 text-sm">
              <p>{t.booking.failed}</p>
              <button
                type="button"
                onClick={() => fetchWeek(week)}
                className="mt-2 cursor-pointer font-semibold underline underline-offset-4"
              >
                {t.booking.retry}
              </button>
            </div>
          ) : (
            <>
              {load.slots.every((slot) => slot.state !== "open") && (
                <p role="status" className="mt-4 rounded-lg bg-band px-4 py-3 text-sm">
                  {t.booking.empty}
                </p>
              )}
              <WeekGrid
                t={t}
                locale={locale}
                week={week}
                zone={zone}
                slots={load.slots}
                onPick={onPick}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

/** The section's own height while it has nothing true to draw yet, so the page
 *  does not jump once the zone comes back. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="mt-4 flex h-40 items-center justify-center rounded-xl bg-band text-sm text-muted"
    >
      {children}
    </div>
  );
}
