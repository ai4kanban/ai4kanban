/**
 * When the coach is free, and what an hour costs (#683).
 *
 * This is configuration, not data: it is deployed with the Worker, so no route can write it
 * and the page carries no editor for it. The database holds the other half of the answer —
 * which hours are already taken — and the open set is this schedule minus what has passed,
 * what a dated exception closes, and what is booked.
 *
 * Everything here is written in the coach's own wall clock, UTC+8, which has no daylight
 * saving. That is the only place UTC+8 appears: an hour becomes an absolute instant the
 * moment it leaves this file, and the visitor's side of the world never sees it.
 */

/** The coach's fixed offset from UTC, in minutes. 中国标准时间, no DST, ever. */
export const AUTHOR_OFFSET_MINUTES = 8 * 60

/** How long one session runs. Both services book a 60-minute hour. */
export const SESSION_MINUTES = 60

/** Monday is 1 and Sunday is 7 — ISO weekday numbering, in the coach's own week. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface WeeklyHour {
  weekday: Weekday
  /** The hour the session starts, 0–23, in UTC+8. */
  hour: number
}

/**
 * The week the coach keeps open. Three hours spread across the week so each one falls in
 * somebody's daytime — Monday morning UTC+8 for Asia-Pacific, and two late evenings that are
 * afternoon in Europe and morning in the Americas.
 *
 * This is a schedule, not a quota. Nothing counts these or shows their number: what a visitor
 * sees is the hours still open after the subtraction, and no page says how many there were.
 */
export const WEEKLY_HOURS: readonly WeeklyHour[] = [
  { weekday: 1, hour: 10 },
  { weekday: 3, hour: 22 },
  { weekday: 5, hour: 22 },
]

/**
 * The exceptions to that week, each written as a UTC+8 calendar date.
 *
 * - `closedDays` takes a whole day out — a trip, a holiday.
 * - `closedHours` takes one hour out of an otherwise open day.
 * - `openHours` adds an hour the weekly pattern does not offer.
 *
 * An hour named in both `closedHours` and `openHours` stays closed: an exception that removes
 * an hour is a commitment already made elsewhere, and it outranks one that offers it.
 */
export interface Exceptions {
  /** `YYYY-MM-DD`, UTC+8. */
  closedDays: readonly string[]
  /** `YYYY-MM-DDTHH`, UTC+8. */
  closedHours: readonly string[]
  /** `YYYY-MM-DDTHH`, UTC+8. */
  openHours: readonly string[]
}

export const EXCEPTIONS: Exceptions = {
  closedDays: [],
  closedHours: [],
  openHours: [],
}

/** The two services, and what each costs. The server settles the price; a form never sends one. */
export const SERVICES = {
  single: { priceCents: 9900 },
  monthly: { priceCents: 34900 },
} as const

export type ServiceId = keyof typeof SERVICES

export const isServiceId = (value: unknown): value is ServiceId =>
  typeof value === 'string' && Object.hasOwn(SERVICES, value)

// --- turning the schedule into instants ---------------------------------------

/** The UTC+8 civil fields of an instant. Pure arithmetic: the offset is fixed, so there is no
 *  zone database to consult and no ambiguous hour to resolve. */
function authorFields(at: Date): { y: number; m: number; d: number; hour: number; weekday: Weekday } {
  const shifted = new Date(at.getTime() + AUTHOR_OFFSET_MINUTES * 60_000)
  // `getUTC*` on the shifted instant reads the coach's wall clock.
  const isoWeekday = shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay()
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: isoWeekday as Weekday,
  }
}

/** The instant a UTC+8 wall-clock hour starts. */
function instantOf(y: number, m: number, d: number, hour: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hour) - AUTHOR_OFFSET_MINUTES * 60_000)
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const hourKey = (y: number, m: number, d: number, hour: number) => `${dayKey(y, m, d)}T${pad(hour)}`

/**
 * Every hour the schedule opens inside `[from, to)`, as absolute instants, in order.
 *
 * The window is the VISITOR's week, which is why the sweep runs over the coach's calendar days
 * a day either side of it: a Monday 10:00 in UTC+8 is the Sunday before in New York, so a
 * visitor's week can contain hours from two of the coach's weeks. Widening the sweep and
 * filtering on the instant is what makes that fall out rather than needing a case.
 */
export function scheduledHours(
  from: Date,
  to: Date,
  { exceptions = EXCEPTIONS, weekly = WEEKLY_HOURS }: { exceptions?: Exceptions; weekly?: readonly WeeklyHour[] } = {},
): Date[] {
  const closedDays = new Set(exceptions.closedDays)
  const closedHours = new Set(exceptions.closedHours)
  const openHours = new Set(exceptions.openHours)

  const out: Date[] = []
  const seen = new Set<number>()
  const start = authorFields(new Date(from.getTime() - 24 * 3600_000))
  const end = to.getTime()

  for (let day = 0; day <= 9; day += 1) {
    const noon = instantOf(start.y, start.m, start.d + day, 12)
    const { y, m, d, weekday } = authorFields(noon)
    if (closedDays.has(dayKey(y, m, d))) continue

    const hours = new Set<number>()
    for (const slot of weekly) if (slot.weekday === weekday) hours.add(slot.hour)
    for (let hour = 0; hour < 24; hour += 1) {
      if (openHours.has(hourKey(y, m, d, hour))) hours.add(hour)
    }

    for (const hour of hours) {
      if (closedHours.has(hourKey(y, m, d, hour))) continue
      const at = instantOf(y, m, d, hour)
      const ms = at.getTime()
      if (ms < from.getTime() || ms >= end || seen.has(ms)) continue
      seen.add(ms)
      out.push(at)
    }
  }

  return out.sort((a, b) => a.getTime() - b.getTime())
}

export interface Slot {
  /** The instant the hour starts, ISO 8601 in UTC. */
  at: string
  state: 'open' | 'booked'
}

/**
 * What the page draws: the schedule inside the window, each hour marked open or already taken,
 * with everything that has passed dropped.
 *
 * An hour the schedule no longer offers is not listed even when it holds a booking — a slot
 * the coach closed after somebody booked it is that person's appointment, not a square anyone
 * else needs to see.
 */
export function availability(
  from: Date,
  to: Date,
  bookedAt: readonly string[],
  now: Date,
  options?: { exceptions?: Exceptions; weekly?: readonly WeeklyHour[] },
): Slot[] {
  const booked = new Set(bookedAt.map((iso) => new Date(iso).getTime()))
  return scheduledHours(from, to, options)
    .filter((at) => at.getTime() > now.getTime())
    .map((at) => ({
      at: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      state: booked.has(at.getTime()) ? ('booked' as const) : ('open' as const),
    }))
}

/** Whether the schedule still offers this exact instant. What a submit is re-checked against,
 *  so a form held open across a configuration change cannot book an hour that closed. */
export function isScheduled(at: Date, options?: { exceptions?: Exceptions; weekly?: readonly WeeklyHour[] }): boolean {
  const hours = scheduledHours(new Date(at.getTime() - 1000), new Date(at.getTime() + 1000), options)
  return hours.some((hour) => hour.getTime() === at.getTime())
}
