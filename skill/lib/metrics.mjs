// docs/kanban/metrics.csv — one row per day: completed, created, rejected.

import fs from 'node:fs'

import { METRICS } from './paths.mjs'

const COLUMNS = ['completed', 'created', 'rejected']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function bumpMetric(kind, amount = 1) {
  const day = today()
  let rows = []
  if (fs.existsSync(METRICS)) {
    rows = fs
      .readFileSync(METRICS, 'utf8')
      .trim()
      .split('\n')
      .slice(1) // drop header
      .filter(Boolean)
      .map((line) => {
        const [date, ...counts] = line.split(',')
        const row = { date }
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
