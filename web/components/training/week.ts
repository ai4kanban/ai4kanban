// Projecting the coach's hours into the week the visitor is actually in (#683).
//
// The service answers with absolute instants and knows nothing about where they
// will be read. Everything here is the other half: given a browser's IANA zone,
// which local week is "this week", and which cell of a seven-day by twenty-four
// hour grid each instant lands in.
//
// It is deliberately pure — no React, no `fetch`, no `document`. Daylight saving
// is the whole reason it exists as its own file: a week is not always 168 hours,
// a local midnight does not always exist, and a local hour is sometimes two
// different instants. Each of those is a test in `web/test/week.test.mts`.

/** Monday is 1 and Sunday is 7, the visitor's own week. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SlotState = "open" | "booked";

/** One hour the service offered, as it came off the wire. */
export type Slot = { at: string; state: SlotState };

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
};

const PARTS = new Map<string, Intl.DateTimeFormat>();

function partsFormat(zone: string): Intl.DateTimeFormat {
  let held = PARTS.get(zone);
  if (!held) {
    held = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    PARTS.set(zone, held);
  }
  return held;
}

const WEEKDAYS: Record<string, Weekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** What an instant reads as on a clock in `zone`. */
export function localParts(at: Date, zone: string): LocalParts {
  const found: Record<string, string> = {};
  for (const part of partsFormat(zone).formatToParts(at)) found[part.type] = part.value;
  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    // A zone whose midnight is written "24" — `hour12: false` does that in some
    // runtimes — is the start of the day, not the end of it.
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
    weekday: WEEKDAYS[found.weekday ?? "Mon"] ?? 1,
  };
}

/** The zone's offset from UTC at this instant, in minutes. Positive east. */
export function offsetMinutes(at: Date, zone: string): number {
  const p = localParts(at, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // Both sides truncated to the minute: no zone offset has a sub-minute part,
  // and comparing a whole-minute local reading against an instant carrying
  // seconds would put the difference a minute out.
  const atMinute = Math.floor(at.getTime() / 60_000) * 60_000;
  return (asUtc - atMinute) / 60_000;
}

/**
 * The instant a wall-clock time in `zone` really is.
 *
 * Converting the other way needs the offset in force at the answer, which you do
 * not have until you have the answer — so this makes two candidates, one from
 * the offset at the naive UTC reading and one from the offset there, and keeps
 * whichever reads back as the time that was asked for.
 *
 * When neither does, the time does not exist: a spring-forward jump skipped it,
 * and in some zones the hour it skips is midnight. The later candidate is then
 * the instant the clock jumps to, which for a day boundary is exactly right —
 * that is when that day starts. Returning the earlier one would put the start of
 * Sunday in Saturday evening.
 */
export function instantOf(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour);
  const first = new Date(naive - offsetMinutes(new Date(naive), zone) * 60_000);
  const second = new Date(naive - offsetMinutes(first, zone) * 60_000);

  // `naive` normalises a day of 0 or 32 for us, so compare against what it means
  // rather than against the arguments.
  const wanted = new Date(naive);
  const reads = (at: Date) => {
    const p = localParts(at, zone);
    return (
      p.year === wanted.getUTCFullYear() &&
      p.month === wanted.getUTCMonth() + 1 &&
      p.day === wanted.getUTCDate() &&
      p.hour === wanted.getUTCHours()
    );
  };

  const earlier = first <= second ? first : second;
  const later = first <= second ? second : first;
  if (reads(earlier)) return earlier;
  if (reads(later)) return later;
  return later;
}

export type Week = {
  /** Monday 00:00 in the visitor's zone, as an instant. */
  from: Date;
  /** The following Monday 00:00, exclusive. */
  to: Date;
  /** The seven days, in order. */
  days: WeekDay[];
};

export type WeekDay = {
  /** 0–6 from Monday — the column. */
  index: number;
  weekday: Weekday;
  year: number;
  month: number;
  day: number;
  /** Monday 00:00 local for this day, as an instant. */
  startsAt: Date;
  /** Whether this is the day the visitor is reading on. */
  today: boolean;
};

/**
 * The visitor's current week: Monday 00:00 local through the next Monday 00:00.
 *
 * The card's boundary, not a rolling seven days — a person reading on Sunday
 * evening is looking at the week that is nearly over, and the page says so
 * rather than quietly showing them next Thursday as if it were this one.
 */
export function currentWeek(now: Date, zone: string): Week {
  const today = localParts(now, zone);
  const from = instantOf(
    zone,
    today.year,
    today.month,
    today.day - (today.weekday - 1),
  );

  const days: WeekDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    // Stepped through noon rather than midnight: a day whose midnight is skipped
    // by a DST jump still has a noon, so the calendar date is never ambiguous.
    const noon = new Date(from.getTime() + index * 86_400_000 + 12 * 3_600_000);
    const p = localParts(noon, zone);
    days.push({
      index,
      weekday: p.weekday,
      year: p.year,
      month: p.month,
      day: p.day,
      startsAt: instantOf(zone, p.year, p.month, p.day),
      today: p.year === today.year && p.month === today.month && p.day === today.day,
    });
  }

  const last = days[6];
  const to = last
    ? instantOf(zone, last.year, last.month, last.day + 1)
    : new Date(from.getTime() + 7 * 86_400_000);

  return { from, to, days };
}

/** One slot as the grid holds it: where it goes, and how to name it. */
export type PlacedSlot = Slot & {
  /** Column, 0–6 from Monday. */
  dayIndex: number;
  /** Row, 0–23 in the visitor's own clock. */
  hour: number;
  /** `14:00`–`15:00` in the visitor's zone. */
  startsAt: Date;
  endsAt: Date;
  /** The zone's offset at this instant, e.g. `UTC-4`. Only ever shown when two
   *  slots share one cell, which is what a fall-back repeated hour looks like. */
  offsetLabel: string;
};

export type HourRow = {
  hour: number;
  /** Seven cells, each holding the slots that land in it. Empty is "not
   *  available" — the grid draws every hour whether anything is offered or not. */
  cells: PlacedSlot[][];
};

const SESSION_MS = 60 * 60_000;

function offsetLabel(at: Date, zone: string): string {
  const minutes = offsetMinutes(at, zone);
  const sign = minutes < 0 ? "-" : "+";
  const whole = Math.abs(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/**
 * Every hour of the week as a row, with each slot dropped into the day and hour
 * a clock in `zone` puts it at.
 *
 * A cell is a list rather than one slot because on the day a zone falls back,
 * one local hour happens twice — two real instants, both "01:00", and a visitor
 * must be able to book either. They are told apart by their UTC offset, which is
 * the only thing that differs.
 */
export function hourRows(slots: readonly Slot[], week: Week, zone: string): HourRow[] {
  const rows: HourRow[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    rows.push({ hour, cells: [[], [], [], [], [], [], []] });
  }

  for (const slot of slots) {
    const startsAt = new Date(slot.at);
    if (startsAt < week.from || startsAt >= week.to) continue;
    const p = localParts(startsAt, zone);
    const dayIndex = week.days.findIndex(
      (d) => d.year === p.year && d.month === p.month && d.day === p.day,
    );
    if (dayIndex === -1) continue;
    rows[p.hour]?.cells[dayIndex]?.push({
      ...slot,
      dayIndex,
      hour: p.hour,
      startsAt,
      endsAt: new Date(startsAt.getTime() + SESSION_MS),
      offsetLabel: offsetLabel(startsAt, zone),
    });
  }

  return rows;
}

/**
 * The runs of hours at the top and bottom of the day that hold nothing at all.
 *
 * They are collapsed behind a disclosure rather than dropped: the grid still
 * covers 00:00–24:00, and expanding shows every hour in the run. Only leading
 * and trailing runs — a gap in the middle of the day is between two hours that
 * are offered, and folding it would hide the shape of the week.
 */
export function quietRuns(rows: readonly HourRow[]): { from: number; to: number }[] {
  const busy = rows.map((row) => row.cells.some((cell) => cell.length > 0));
  const first = busy.indexOf(true);
  if (first === -1) return [];
  const last = busy.lastIndexOf(true);

  const runs: { from: number; to: number }[] = [];
  // At least three hours: folding one or two saves nothing and costs a tap.
  if (first >= 3) runs.push({ from: 0, to: first });
  if (rows.length - 1 - last >= 3) runs.push({ from: last + 1, to: rows.length });
  return runs;
}

/** The hour the grid should be scrolled to when it opens: the first one holding
 *  anything, so a week whose hours are all at 22:00 does not open on an empty
 *  midnight. Falls back to the visitor's own current hour. */
export function focusHour(rows: readonly HourRow[], now: Date, zone: string): number {
  const first = rows.findIndex((row) => row.cells.some((cell) => cell.length > 0));
  return first === -1 ? localParts(now, zone).hour : first;
}

// --- naming a time to a reader ------------------------------------------------

const LOCALES: Record<string, string> = { en: "en-GB", zh: "zh-CN" };

/** `14:00`. Always 24-hour: the grid's rows are hours and a stray am/pm in one
 *  cell would break the column. */
export function clock(at: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(LOCALES[locale] ?? "en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** `Friday 18 September` / `9月18日星期五` — the day, named for a reader. */
export function longDay(at: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(LOCALES[locale] ?? "en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

/** `Mon` / `周一` — the column header. */
export function shortWeekday(at: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(LOCALES[locale] ?? "en-GB", {
    timeZone: zone,
    weekday: "short",
  }).format(at);
}

/** `8–14 September` / `9月8日–14日` — the week, over the grid. */
export function weekLabel(week: Week, zone: string, locale: string): string {
  const first = week.days[0];
  const last = week.days[6];
  if (!first || !last) return "";
  const format = new Intl.DateTimeFormat(LOCALES[locale] ?? "en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "long",
  });
  const startsAt = new Date(first.startsAt.getTime() + 12 * 3_600_000);
  const endsAt = new Date(last.startsAt.getTime() + 12 * 3_600_000);
  return `${format.format(startsAt)} – ${format.format(endsAt)}`;
}

/** `Friday 18 September, 14:00–15:00` — the chosen hour, restated in full. */
export function slotLabel(at: Date, zone: string, locale: string): string {
  const ends = new Date(at.getTime() + SESSION_MS);
  return `${longDay(at, zone, locale)}, ${clock(at, zone, locale)}–${clock(ends, zone, locale)}`;
}

/** The browser's own zone, or nothing when it will not say. A visitor whose
 *  browser gives no zone picks one rather than being shown somebody else's. */
export function browserZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone ? zone : null;
  } catch {
    return null;
  }
}
