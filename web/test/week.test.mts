// Projecting the coach's hours into the reader's week (#683).
//
// The service hands the page absolute instants and says nothing about where they
// will be read. Everything checked here is the other half of that — and it is
// the half daylight saving breaks, so most of these are a zone on the day its
// clock moves.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  currentWeek,
  hourRows,
  instantOf,
  localParts,
  offsetMinutes,
  quietRuns,
  focusHour,
  type Slot,
} from "../components/training/week.ts";

// The sample schedule as instants: Monday 10:00, Wednesday 22:00 and Friday
// 22:00 in UTC+8 (see cloud/src/training-schedule.ts).
const MONDAY_10 = "2026-09-14T02:00:00Z";
const WEDNESDAY_22 = "2026-09-16T14:00:00Z";
const FRIDAY_22 = "2026-09-18T14:00:00Z";

const open = (at: string): Slot => ({ at, state: "open" });
const booked = (at: string): Slot => ({ at, state: "booked" });

describe("reading an instant on somebody else's clock", () => {
  it("reports the offset a zone is on, on both sides of a transition", () => {
    // New York is UTC-4 in September and UTC-5 in December.
    assert.equal(offsetMinutes(new Date("2026-09-18T14:00:00Z"), "America/New_York"), -240);
    assert.equal(offsetMinutes(new Date("2026-12-18T14:00:00Z"), "America/New_York"), -300);
    assert.equal(offsetMinutes(new Date("2026-09-18T14:00:00Z"), "Asia/Shanghai"), 480);
    // A zone with a half-hour offset, because rounding to whole hours is a bug
    // waiting to happen.
    assert.equal(offsetMinutes(new Date("2026-09-18T14:00:00Z"), "Asia/Kolkata"), 330);
  });

  it("is not thrown off by an instant carrying seconds", () => {
    assert.equal(offsetMinutes(new Date("2026-09-18T14:37:41.512Z"), "Europe/Berlin"), 120);
  });

  it("names midnight as hour zero, never as twenty-four", () => {
    const midnight = instantOf("Europe/Berlin", 2026, 9, 14);
    assert.equal(localParts(midnight, "Europe/Berlin").hour, 0);
  });
});

describe("this week, where the reader is", () => {
  it("runs Monday 00:00 to the next Monday 00:00, in local time", () => {
    // Wednesday afternoon in New York.
    const week = currentWeek(new Date("2026-09-16T18:00:00Z"), "America/New_York");

    assert.equal(week.from.toISOString(), "2026-09-14T04:00:00.000Z");
    assert.equal(week.to.toISOString(), "2026-09-21T04:00:00.000Z");
    assert.deepEqual(
      week.days.map((d) => d.day),
      [14, 15, 16, 17, 18, 19, 20],
    );
    assert.deepEqual(
      week.days.map((d) => d.today),
      [false, false, true, false, false, false, false],
    );
  });

  it("puts a Sunday reader in the week that is ending, not the one starting", () => {
    // Sunday 23:00 in Berlin is 21:00 UTC on the 20th.
    const week = currentWeek(new Date("2026-09-20T21:00:00Z"), "Europe/Berlin");

    assert.equal(week.days[0]?.day, 14);
    assert.equal(week.days[6]?.day, 20);
    assert.equal(week.days[6]?.today, true);
  });

  it("crosses a month boundary without renumbering the days", () => {
    const week = currentWeek(new Date("2026-10-01T12:00:00Z"), "Europe/London");

    assert.deepEqual(
      week.days.map((d) => `${d.month}-${d.day}`),
      ["9-28", "9-29", "9-30", "10-1", "10-2", "10-3", "10-4"],
    );
  });

  it("crosses a year boundary too", () => {
    const week = currentWeek(new Date("2026-12-31T12:00:00Z"), "Europe/London");

    assert.equal(week.days[0]?.year, 2026);
    assert.equal(week.days[6]?.year, 2027);
    assert.deepEqual(
      week.days.map((d) => d.day),
      [28, 29, 30, 31, 1, 2, 3],
    );
  });

  it("is 167 hours long the week a zone springs forward", () => {
    // Europe/Berlin loses an hour at 02:00 local on Sunday 2027-03-28.
    const week = currentWeek(new Date("2027-03-24T12:00:00Z"), "Europe/Berlin");

    assert.equal((week.to.getTime() - week.from.getTime()) / 3_600_000, 167);
    assert.equal(week.days.length, 7);
  });

  it("is 169 hours long the week a zone falls back", () => {
    // Europe/Berlin gains an hour at 03:00 local on Sunday 2026-10-25.
    const week = currentWeek(new Date("2026-10-20T12:00:00Z"), "Europe/Berlin");

    assert.equal((week.to.getTime() - week.from.getTime()) / 3_600_000, 169);
  });

  it("starts a day whose local midnight the clock skips at the hour it jumps to", () => {
    // Chile moves its clock forward at midnight: 2026-09-06 has no 00:00 local.
    const week = currentWeek(new Date("2026-09-02T12:00:00Z"), "America/Santiago");
    const sunday = week.days[6];

    assert.equal(sunday?.day, 6);
    // The day still starts, an hour late, and the week still holds seven of them.
    assert.equal(localParts(sunday!.startsAt, "America/Santiago").day, 6);
    assert.equal(localParts(sunday!.startsAt, "America/Santiago").hour, 1);
  });
});

describe("dropping the hours into the grid", () => {
  const zone = "Asia/Shanghai";
  const week = currentWeek(new Date("2026-09-16T04:00:00Z"), zone);

  it("puts each hour on the day and row a local clock reads it at", () => {
    const rows = hourRows([open(MONDAY_10), booked(WEDNESDAY_22), open(FRIDAY_22)], week, zone);

    // In UTC+8 the coach's own hours land exactly where they were written.
    assert.equal(rows[10]?.cells[0]?.[0]?.state, "open");
    assert.equal(rows[22]?.cells[2]?.[0]?.state, "booked");
    assert.equal(rows[22]?.cells[4]?.[0]?.state, "open");
  });

  it("moves the same hours into a western reader's own evening", () => {
    const ny = "America/New_York";
    const nyWeek = currentWeek(new Date("2026-09-16T18:00:00Z"), ny);
    const rows = hourRows([open(MONDAY_10), open(FRIDAY_22)], nyWeek, ny);

    // Monday 10:00 +08 is Sunday 22:00 in New York — the last column of the week
    // before, which for this reader is the last column of theirs.
    assert.equal(rows[22]?.cells[6]?.length, 0, "that Sunday is next week's, not this one's");
    // Friday 22:00 +08 is Friday 10:00 in New York.
    assert.equal(rows[10]?.cells[4]?.[0]?.state, "open");
  });

  it("leaves an hour outside the week out of the grid entirely", () => {
    const rows = hourRows([open("2026-09-28T02:00:00Z")], week, zone);

    assert.equal(
      rows.every((row) => row.cells.every((cell) => cell.length === 0)),
      true,
    );
  });

  it("keeps both halves of a repeated local hour, told apart by their offset", () => {
    // Berlin falls back at 03:00 local on 2026-10-25: 00:00Z and 01:00Z are both
    // "02:00" on the wall. Two real hours, and a visitor may book either.
    const berlin = "Europe/Berlin";
    const berlinWeek = currentWeek(new Date("2026-10-21T12:00:00Z"), berlin);
    const rows = hourRows(
      [open("2026-10-25T00:00:00Z"), open("2026-10-25T01:00:00Z")],
      berlinWeek,
      berlin,
    );

    const cell = rows[2]?.cells[6] ?? [];
    assert.equal(cell.length, 2, "one of the two repeated hours was lost");
    assert.deepEqual(
      cell.map((slot) => slot.offsetLabel),
      ["UTC+2", "UTC+1"],
    );
  });

  it("has no row at all for a local hour the clock skips", () => {
    // Berlin springs forward at 02:00 local on 2027-03-28: there is no 02:xx.
    const berlin = "Europe/Berlin";
    const berlinWeek = currentWeek(new Date("2027-03-24T12:00:00Z"), berlin);
    const rows = hourRows([open("2027-03-28T01:00:00Z")], berlinWeek, berlin);

    // 01:00Z is 03:00 local, because 02:00 does not exist that morning.
    assert.equal(rows[2]?.cells[6]?.length, 0);
    assert.equal(rows[3]?.cells[6]?.length, 1);
  });

  it("draws all twenty-four hours whether anything is on offer or not", () => {
    const rows = hourRows([], week, zone);

    assert.equal(rows.length, 24);
    assert.deepEqual(
      rows.map((row) => row.cells.length),
      Array.from({ length: 24 }, () => 7),
    );
  });
});

describe("folding the hours nothing is offered in", () => {
  const zone = "Asia/Shanghai";
  const week = currentWeek(new Date("2026-09-16T04:00:00Z"), zone);

  it("folds the empty run before the first hour and after the last", () => {
    const rows = hourRows([open(MONDAY_10), open(FRIDAY_22)], week, zone);

    // Something at 10:00 and something at 22:00, so 00–09 and 23 are the runs —
    // and 23 alone is too short to be worth folding.
    assert.deepEqual(quietRuns(rows), [{ from: 0, to: 10 }]);
  });

  it("never folds an hour that holds anything", () => {
    const rows = hourRows([booked(MONDAY_10), open(FRIDAY_22)], week, zone);
    const folded = new Set(
      quietRuns(rows).flatMap((run) =>
        Array.from({ length: run.to - run.from }, (_, i) => run.from + i),
      ),
    );

    for (const row of rows) {
      if (row.cells.some((cell) => cell.length > 0)) {
        assert.equal(folded.has(row.hour), false, `hour ${row.hour} was folded away`);
      }
    }
  });

  it("folds nothing at all when the week holds nothing", () => {
    // An empty week keeps its grid — the page says so in words above it rather
    // than collapsing the whole day into one disclosure.
    assert.deepEqual(quietRuns(hourRows([], week, zone)), []);
  });

  it("leaves a gap in the middle of the day alone", () => {
    const rows = hourRows(
      [open("2026-09-14T00:00:00Z"), open("2026-09-14T15:00:00Z")],
      week,
      zone,
    );

    // 08:00 and 23:00 local: the eight hours between them are between two hours
    // that ARE offered, so they stay as rows.
    assert.deepEqual(quietRuns(rows), [{ from: 0, to: 8 }]);
  });

  it("opens on the first hour that holds something", () => {
    const rows = hourRows([open(FRIDAY_22)], week, zone);

    assert.equal(focusHour(rows, new Date("2026-09-16T04:00:00Z"), zone), 22);
  });

  it("opens on the reader's own hour when the week is empty", () => {
    const rows = hourRows([], week, zone);

    assert.equal(focusHour(rows, new Date("2026-09-16T04:00:00Z"), zone), 12);
  });
});
