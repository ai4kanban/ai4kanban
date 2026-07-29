import fs from "node:fs";
import { metricsPath } from "./paths";

// The board's daily numbers — docs/kanban/metrics.csv, one row per day:
// completed, created, rejected. The script owns the file; this is read-only.
//
// Three things the reader has to get right. Dates are stamped in UTC by the
// script (`new Date().toISOString().slice(0,10)`), so the window is counted in
// UTC too — in a local timezone the newest day would slip in or out. The
// columns are read by header name, not by position: the file's order is
// `completed,created,rejected`, the reverse of how we say it, and a file
// written by another version shouldn't be silently mis-plotted. And a file we
// can't read or make sense of is reported as an error, never as an empty
// board — telling a user with a damaged file that they have no activity would
// read as their history being gone.

/** How many days the view covers, ending today. */
export const WINDOW_DAYS = 30;

/** One day in the window. `date` is `YYYY-MM-DD`, UTC. A day the file doesn't
 *  mention is filled in with zeros, so every day has a point. */
export interface MetricsDay {
  date: string;
  completed: number;
  created: number;
  rejected: number;
}

export interface MetricsView {
  days: MetricsDay[];
  totals: { completed: number; created: number; rejected: number };
  /** True when the board has no numbers at all — no file, or a header alone.
   *  A file whose rows all fall outside the window is NOT empty: a board that
   *  went quiet is real progress, and shows a chart flat at zero. */
  empty: boolean;
}

/** What one read gives back. The two outcomes are kept apart on purpose, so
 *  the view can't fall back to the "no activity" note on a failure. */
export type MetricsResult = { ok: true; view: MetricsView } | { ok: false; error: string };

const DATE = "date";
const COUNTS = ["completed", "created", "rejected"] as const;
type Count = (typeof COUNTS)[number];

/** `YYYY-MM-DD` for a day offset from today, counted in UTC. */
function utcDay(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** A count the same way the script writes it: anything missing or non-numeric
 *  reads as zero. One odd cell isn't a damaged file — the script itself is
 *  this tolerant when it re-reads its own rows. */
function count(cell: string | undefined): number {
  const n = Number((cell ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** The 30-day window, every day at zero. */
function blankDays(): Map<string, MetricsDay> {
  const days = new Map<string, MetricsDay>();
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const date = utcDay(-i);
    days.set(date, { date, completed: 0, created: 0, rejected: 0 });
  }
  return days;
}

function view(days: Map<string, MetricsDay>, empty: boolean): MetricsResult {
  const list = [...days.values()];
  const totals = { completed: 0, created: 0, rejected: 0 };
  for (const day of list) for (const c of COUNTS) totals[c] += day[c];
  return { ok: true, view: { days: list, totals, empty } };
}

export function readMetrics(): MetricsResult {
  const file = metricsPath();

  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    // No file at all is the one honest empty: a board that has never recorded
    // anything. A directory in its place, no permission to read it, bad bytes —
    // those are failures, and the user needs to know which file to look at.
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return view(blankDays(), true);
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not read ${file} — ${why}` };
  }

  const rows = text.trim().split("\n").filter(Boolean);
  if (rows.length === 0) {
    return { ok: false, error: `${file} is empty — it has no header row.` };
  }

  // Read the columns by name. A header that doesn't name them is not something
  // to guess at: guessing by position is exactly the silent mis-plotting that
  // reading by name exists to prevent.
  const header = rows[0].split(",").map((h) => h.trim().toLowerCase());
  const at = {} as Record<Count, number>;
  const missing: string[] = [];
  for (const name of [DATE, ...COUNTS]) {
    const i = header.indexOf(name);
    if (i < 0) missing.push(name);
    else if (name !== DATE) at[name as Count] = i;
  }
  const dateAt = header.indexOf(DATE);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `${file} does not name its ${missing.join(", ")} column${
        missing.length > 1 ? "s" : ""
      } in the header row — the numbers can't be read without guessing which is which.`,
    };
  }

  const days = blankDays();
  const body = rows.slice(1);
  for (const line of body) {
    const cells = line.split(",");
    const day = days.get((cells[dateAt] ?? "").trim());
    if (!day) continue; // outside the window, or not a date
    for (const c of COUNTS) day[c] += count(cells[at[c]]);
  }

  // A header alone is a board that has recorded nothing yet — the script writes
  // the header the first time it touches the file.
  return view(days, body.length === 0);
}
