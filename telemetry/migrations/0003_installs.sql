-- How many installs have ever reported a first run, day by day. The only number this
-- service answers a request with (#728), so it is a table of its own: the route reads one
-- row and never the events or a summary's JSON.
--
-- One row per day that has a summary, carrying that day's first runs and the running total
-- through it. Kept per day rather than as a single counter because the daily job rewrites a
-- day for as long as it can take late events — a counter that was only ever added to would
-- keep a correction out for good.

CREATE TABLE installs (
  day        TEXT PRIMARY KEY,
  -- Installs whose first run landed on this day.
  first_runs INTEGER NOT NULL,
  -- Every first run from the first day we hold through this one.
  total      INTEGER NOT NULL,
  written_at TEXT NOT NULL
);
