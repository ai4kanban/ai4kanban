/**
 * Putting a batch away. However many events it carries, it is one statement: the rows go in
 * as a single JSON parameter and `json_each` unpacks them, because D1 allows a hundred bound
 * parameters per query and a run only fifty queries.
 */

import type { Row } from './take.ts'

export const INSERT = `
INSERT OR IGNORE INTO events
  (install_id, event_id, day, name, surface, version, country, board_id, fields)
SELECT ?2,
       json_extract(value, '$.e'),
       json_extract(value, '$.d'),
       json_extract(value, '$.n'),
       json_extract(value, '$.s'),
       json_extract(value, '$.v'),
       ?3,
       json_extract(value, '$.b'),
       json_extract(value, '$.f')
  FROM json_each(?1)
`

export interface Stored {
  /** False when the day's allowance is spent. The sender is told nothing either way. */
  stored: boolean
  rowsWritten: number
  rowsRead: number
}

/**
 * `INSERT OR IGNORE` is the de-duplication: an event id already stored for that install id
 * is ignored rather than counted a second time.
 *
 * Every failure here is answered the same way — the batch is dropped and the caller answers
 * as if it had been stored. A sender that gets an error retries, and retries on the busiest
 * day of the year make that day worse; losing part of one day's events costs less than the
 * numbers being unreadable for it.
 */
export async function store(db: D1Database, install: string, country: string, rows: Row[]): Promise<Stored> {
  if (rows.length === 0) return { stored: true, rowsWritten: 0, rowsRead: 0 }
  try {
    const result = await db.prepare(INSERT).bind(JSON.stringify(rows), install, country).run()
    return { stored: true, rowsWritten: result.meta.rows_written, rowsRead: result.meta.rows_read }
  } catch (error) {
    console.error('telemetry: batch dropped', error)
    return { stored: false, rowsWritten: 0, rowsRead: 0 }
  }
}
