-- What a person wrote to us (#603), in two tables kept apart from `events` the whole way
-- down: the body is retained indefinitely, its attachments are swept on the same 90 days a
-- raw event gets, and neither is written into the daily archive.
--
-- Both are WITHOUT ROWID on (install_id, feedback_id), for the reasons `events` is: it
-- de-duplicates a submission the sender posted twice, and it is the prefix scan
-- `npm run forget` deletes an install by. `install_id` is '' on feedback from a machine with
-- usage reporting off, which carries no id at all.

CREATE TABLE feedback (
  install_id  TEXT NOT NULL,
  feedback_id TEXT NOT NULL,
  -- The sending machine's own calendar date, as every day in this database is.
  day         TEXT NOT NULL,
  received_at TEXT NOT NULL,
  -- `task` — the block on New task — or `board`, the Feedback button.
  source      TEXT NOT NULL,
  surface     TEXT NOT NULL,
  version     TEXT NOT NULL DEFAULT '',
  -- Worked out from the address the request arrived from. The address itself is never here.
  country     TEXT NOT NULL DEFAULT '',
  -- The archived card this is about, as its number on that board. NULL when none was linked.
  card_id     INTEGER,
  body        TEXT NOT NULL,
  PRIMARY KEY (install_id, feedback_id)
) WITHOUT ROWID;

CREATE INDEX feedback_day ON feedback (day);

-- The diagnostic attachments, one row per part, deleted 90 days on. Their own table so the
-- sweep can take them without touching the body beside them.
CREATE TABLE feedback_files (
  install_id  TEXT NOT NULL,
  feedback_id TEXT NOT NULL,
  part        TEXT NOT NULL,
  day         TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  content     TEXT NOT NULL,
  PRIMARY KEY (install_id, feedback_id, part)
) WITHOUT ROWID;

CREATE INDEX feedback_files_day ON feedback_files (day);
