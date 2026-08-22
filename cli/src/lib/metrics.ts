// docs/kanban/metrics.csv — one row per day: completed, created, rejected. The day is the
// local one (see `formatDay`), so an evening's work is filed under the evening it happened.

import fs from 'node:fs'

import { formatDay } from './cadence'
import { METRICS } from './paths'

const COLUMNS = ['completed', 'created', 'rejected'] as const

type MetricKind = (typeof COLUMNS)[number]
type Row = { date: string } & Record<MetricKind, number>

export function bumpMetric(kind: MetricKind, amount = 1): void {
  const day = formatDay()
  let rows: Row[] = []
  if (fs.existsSync(METRICS)) {
    rows = fs
      .readFileSync(METRICS, 'utf8')
      .trim()
      .split('\n')
      .slice(1) // drop header
      .filter(Boolean)
      .map((line) => {
        const [date, ...counts] = line.split(',')
        const row = { date: date ?? '' } as Row
        COLUMNS.forEach((c, i) => (row[c] = Number(counts[i] || 0)))
        return row
      })
  }
  let row = rows.find((r) => r.date === day)
  if (!row) {
    row = { date: day, completed: 0, created: 0, rejected: 0 }
    rows.push(row)
  }
  row[kind] += amount
  const out = ['date,' + COLUMNS.join(',')]
  for (const r of rows) out.push([r.date, ...COLUMNS.map((c) => r[c])].join(','))
  fs.writeFileSync(METRICS, out.join('\n') + '\n')
}
