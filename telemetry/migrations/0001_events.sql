-- The store, in two tables: what arrived, and what a day came to.
--
-- `events` is WITHOUT ROWID on (install_id, event_id). That primary key does three jobs at
-- once and costs one index: it is the de-duplication an app batch needs, it is the prefix
-- scan `npm run forget` deletes an install by, and holding the row in the key's own tree is
-- one row written per event rather than two. Every extra index would add a row to every
-- insert and every delete, which is why there is exactly one more.
--
-- `install_id` is '' rather than NULL on a site event: a WITHOUT ROWID key cannot be null,
-- and '' is the one value no sender can send.

CREATE TABLE events (
  install_id TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  -- The sending machine's own calendar date. Retention and every summary read this, never
  -- the time the batch arrived.
  day        TEXT NOT NULL,
  name       TEXT NOT NULL,
  surface    TEXT NOT NULL,
  version    TEXT NOT NULL DEFAULT '',
  -- Worked out from the address the request arrived from. The address itself is never here.
  country    TEXT NOT NULL DEFAULT '',
  -- #296's per-board id, on a board-numbers event. It sits on the same row as the install
  -- id, so forgetting that install takes it too.
  board_id   TEXT NOT NULL DEFAULT '',
  -- The declared fields that are not columns, as JSON. A summary reads them with
  -- json_extract, so a new field in the contract needs no migration.
  fields     TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (install_id, event_id)
) WITHOUT ROWID;

-- The one other index. A day's summary and the retention sweep both work a day at a time,
-- and without it either would scan the whole 90 days.
CREATE INDEX events_day ON events (day);

-- One row a day, kept indefinitely: this is the only copy of a day's numbers once the events
-- behind it are deleted. `numbers` is the whole of what the numbers command prints for that
-- day, as JSON, so a card that adds a number adds a key rather than a column.
CREATE TABLE daily (
  day        TEXT PRIMARY KEY,
  numbers    TEXT NOT NULL,
  -- 1 once the day can take no more late events, so it is never rewritten again.
  settled    INTEGER NOT NULL DEFAULT 0,
  written_at TEXT NOT NULL
);
