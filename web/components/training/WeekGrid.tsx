"use client";

import { useEffect, useRef } from "react";
import type { TrainingCopy } from "@/i18n/training/types";
import { apricot } from "./Sections";
import {
  clock,
  focusHour,
  hourRows,
  longDay,
  quietRuns,
  shortWeekday,
  type PlacedSlot,
  type Slot,
  type Week,
} from "./week";

// The visitor's own week, an hour to a row (#683).
//
// It draws all twenty-four hours of all seven days whether anything is on offer
// or not, so what a reader sees is a schedule rather than a set of buttons with
// no shape. What is offered is a button; what is taken says so; everything else
// is the wash and an accessible name, because a blank cell tells a screen reader
// nothing.
//
// The runs of empty hours at the top and bottom of the day fold behind a
// disclosure. Folded, not dropped — every hour is still reachable, and nothing
// that could be booked is ever behind one (`quietRuns` only folds runs with no
// slot in them at all).
//
// On a phone the grid scrolls sideways inside its frame with the hour column
// pinned, and opens on today and on the first hour that holds anything.

const CELL = "h-8 border-l border-t border-ink/10 p-0 align-middle";

export function WeekGrid({
  t,
  locale,
  week,
  zone,
  slots,
  onPick,
}: {
  t: TrainingCopy;
  locale: string;
  week: Week;
  zone: string;
  slots: readonly Slot[];
  onPick: (slot: PlacedSlot) => void;
}) {
  const rows = hourRows(slots, week, zone);
  const quiet = quietRuns(rows);
  const folded = new Set(quiet.flatMap((run) => range(run.from, run.to)));
  const focus = focusHour(rows, new Date(), zone);
  const scroller = useRef<HTMLDivElement>(null);
  const focusRow = useRef<HTMLTableRowElement>(null);
  const todayColumn = useRef<HTMLTableCellElement>(null);
  const today = week.days.findIndex((day) => day.today);

  // Open on the part of the day that has something in it, and — on a phone,
  // where the seven columns do not fit — on today. Both scroll the frame and
  // never the document: `scrollIntoView` would take the page with it, so the
  // horizontal one is set on the frame directly, and the vertical one is
  // `block: "nearest"`, which moves the nearest scrollable ancestor only.
  useEffect(() => {
    focusRow.current?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  useEffect(() => {
    const frame = scroller.current;
    const column = todayColumn.current;
    if (!frame || !column) return;
    // Centred rather than flush left, so yesterday and tomorrow are both half
    // in view and the row reads as a week rather than as a single day.
    const centred = column.offsetLeft - (frame.clientWidth - column.clientWidth) / 2;
    frame.scrollLeft = Math.max(0, centred);
  }, [today]);

  const dayLabel = (index: number) => {
    const day = week.days[index];
    if (!day) return "";
    return longDay(new Date(day.startsAt.getTime() + 12 * 3_600_000), zone, locale);
  };

  return (
    <>
      <div
        ref={scroller}
        className="mt-3 max-h-[520px] overflow-auto rounded-xl border-2 border-border bg-elev"
      >
        <table className="w-full min-w-[720px] table-fixed border-collapse text-center text-xs">
          <caption className="sr-only">{t.booking.gridLabel}</caption>
          <thead className="sticky top-0 z-20 bg-elev">
            <tr>
              <th scope="col" className="w-16 py-2 font-normal text-muted">
                {t.booking.timeColumn}
              </th>
              {week.days.map((day) => {
                const noon = new Date(day.startsAt.getTime() + 12 * 3_600_000);
                return (
                  <th
                    key={day.index}
                    scope="col"
                    ref={day.today ? todayColumn : undefined}
                    className={`py-2 font-normal ${day.today ? "text-ink" : "text-muted"}`}
                  >
                    {shortWeekday(noon, zone, locale)}
                    <span className={`ml-2 ${day.today ? "font-bold" : "font-semibold text-ink"}`}>
                      {day.day}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {quiet
              .filter((run) => run.from === 0)
              .map((run) => (
                <QuietRun key="head" t={t} run={run} rows={rows} />
              ))}

            {rows.map((row) =>
              folded.has(row.hour) ? null : (
                <tr key={row.hour} ref={row.hour === focus ? focusRow : undefined}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-elev py-1 font-mono font-normal text-muted"
                  >
                    {pad(row.hour)}:00
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={index}
                      className={`${CELL} ${cell.length > 0 ? "bg-elev" : "bg-band"}`}
                    >
                      {cell.length === 0 ? (
                        <span className="sr-only">{t.booking.unavailable}</span>
                      ) : (
                        <div className="flex h-8 items-stretch divide-x divide-ink/10">
                          {cell.map((slot) => (
                            <Cell
                              key={slot.at}
                              t={t}
                              slot={slot}
                              // Two slots in one cell is a repeated local hour on
                              // the day the zone falls back. The offset is what
                              // tells them apart, so it is shown then and only
                              // then.
                              showOffset={cell.length > 1}
                              day={dayLabel(index)}
                              time={clock(slot.startsAt, zone, locale)}
                              onPick={onPick}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ),
            )}

            {quiet
              .filter((run) => run.from !== 0)
              .map((run) => (
                <QuietRun key="tail" t={t} run={run} rows={rows} />
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={`inline-block h-3 w-3 ${apricot}`} />
          {t.booking.open}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 bg-code" />
          {t.booking.booked}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-ink/10 bg-band" />
          {t.booking.unavailable}
        </span>
        <span>{t.booking.legendHint}</span>
      </div>
    </>
  );
}

/** One hour on one day. Open is a button; taken is a label; nothing else gets
 *  here. The offset rides along only when the cell holds two of them. */
function Cell({
  t,
  slot,
  showOffset,
  day,
  time,
  onPick,
}: {
  t: TrainingCopy;
  slot: PlacedSlot;
  showOffset: boolean;
  day: string;
  time: string;
  onPick: (slot: PlacedSlot) => void;
}) {
  const named = (template: string) => template.replace("{day}", day).replace("{time}", time);

  if (slot.state === "booked") {
    return (
      <span
        className="flex flex-1 items-center justify-center bg-code text-[0.7rem] text-muted"
        title={showOffset ? slot.offsetLabel : undefined}
      >
        <span aria-hidden="true">{t.booking.booked}</span>
        <span className="sr-only">
          {named(t.booking.bookedAria)}
          {showOffset ? ` ${slot.offsetLabel}` : ""}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(slot)}
      aria-label={`${named(t.booking.openAria)}${showOffset ? ` ${slot.offsetLabel}` : ""}`}
      className={`flex flex-1 cursor-pointer items-center justify-center ${apricot} text-[0.7rem] font-semibold text-accent-deep transition-colors hover:bg-accent hover:text-elev focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
    >
      {showOffset ? slot.offsetLabel : t.booking.open}
    </button>
  );
}

/** A run of hours nothing is offered in, folded to one row. Open it and every
 *  hour in it is there, one line each — the schedule still covers the day. */
function QuietRun({
  t,
  run,
  rows,
}: {
  t: TrainingCopy;
  run: { from: number; to: number };
  rows: { hour: number }[];
}) {
  const label = t.booking.quietHours
    .replace("{from}", `${pad(run.from)}:00`)
    .replace("{to}", `${pad(run.to % 24)}:00`);

  return (
    <tr className="bg-band/60">
      <td colSpan={8} className="p-0">
        <details>
          <summary className="cursor-pointer py-1.5 pl-3 text-left text-muted">{label}</summary>
          <ul>
            {rows.slice(run.from, run.to).map((row) => (
              <li
                key={row.hour}
                className="flex items-center gap-3 border-t border-ink/10 py-1.5 pl-3 text-muted"
              >
                <span className="font-mono">{pad(row.hour)}:00</span>
                <span>{t.booking.unavailable}</span>
              </li>
            ))}
          </ul>
        </details>
      </td>
    </tr>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n < to; n += 1) out.push(n);
  return out;
}
