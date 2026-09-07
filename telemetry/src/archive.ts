/**
 * A day's raw events, written out as one file before the sweep deletes them.
 *
 * The daily summary keeps totals per dimension and never the rows, so a crossing nobody
 * thought to store is unanswerable once the sweep takes the day. The file is the answer: one
 * object per row, everything the row carried, read years later with DuckDB's `read_json` and
 * never by the Worker.
 *
 * Keys sort by the day they hold, and the archive is written oldest first and never skips a
 * day — which is what makes the newest key the frontier, and `day < frontier` the whole of
 * "this day may be swept".
 */

import { LIMITS } from '../contract.ts'
import { shift } from './take.ts'

const SUFFIX = '.jsonl'
export const PREFIX = 'events/'

export const keyOf = (day: string) => `${PREFIX}${day}${SUFFIX}`
export const dayOf = (key: string) => key.slice(PREFIX.length, -SUFFIX.length)

/**
 * One chunk of a day, as rows SQLite has already turned into JSON text — the Worker only
 * joins them with newlines. Building the JSON row by row would not fit ten milliseconds, and
 * asking for a whole day as one value would not fit D1's 2 MB cap on a single string.
 *
 * `?2`/`?3` are the last row the previous chunk returned, so a day is walked along its own
 * primary key rather than by an offset that rescans what is already written.
 */
export const ARCHIVE_PAGE = `
SELECT install_id AS i,
       event_id AS e,
       json_object('install_id', install_id, 'event_id', event_id, 'day', day,
                   'name', name, 'surface', surface, 'version', version,
                   'country', country, 'board_id', board_id,
                   'fields', json(fields)) AS line
  FROM events
 WHERE day = ?1 AND (install_id > ?2 OR (install_id = ?2 AND event_id > ?3))
 ORDER BY install_id, event_id
 LIMIT ?4`

export interface ArchiveRow {
  i: string
  e: string
  line: string
}

/** A day's file. Empty for a day the service saw nothing on, so absence means unwritten. */
export const fileOf = (lines: string[]) => (lines.length === 0 ? '' : `${lines.join('\n')}\n`)

/** The lines of one file, as `fileOf` wrote them. */
export const linesOf = (file: string) => file.split('\n').filter((line) => line !== '')

/** The first day the archive has no file for. */
export async function frontier(bucket: R2Bucket): Promise<string> {
  let newest: string | undefined
  let cursor: string | undefined
  for (;;) {
    const page: R2Objects = await bucket.list({ prefix: PREFIX, limit: 1000, cursor })
    newest = page.objects.at(-1)?.key ?? newest
    if (!page.truncated || page.cursor === undefined) break
    cursor = page.cursor
  }
  return newest === undefined ? LIMITS.archiveFrom : shift(dayOf(newest), 1)
}
