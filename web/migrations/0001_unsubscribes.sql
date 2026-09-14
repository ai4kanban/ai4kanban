-- Who asked to stop getting the newsletter, as one row per unsubscribe token.
--
-- A token is an HMAC of the address, computed on the machine that holds the list. The site
-- never learns whose it is, so this table is the whole of what the newsletter stores here:
-- no address, no name, no list.
--
-- WITHOUT ROWID on the token: every read is the full scan the sender does before a send, and
-- every write is one upsert keyed by the token, so the key's own tree is the only index
-- either needs.
--
-- `at` is the *first* time the token arrived. A reader who clicks twice, or whose client
-- prefetches the link and then sends the one-click POST, must still count as one unsubscribe
-- — `ON CONFLICT DO NOTHING` in functions/unsubscribe.ts is what keeps this row untouched.
CREATE TABLE unsubscribes (
  token TEXT NOT NULL,
  at    TEXT NOT NULL,
  PRIMARY KEY (token)
) WITHOUT ROWID;
