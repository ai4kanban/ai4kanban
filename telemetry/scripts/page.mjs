// The dashboard as one self-contained page: its own styles, no script, no request out. The
// day buttons are links, so a range is a URL the browser can go back through.

import { LIMITS } from '../contract.ts'
import { DAY_COLUMNS } from './dashboard.mjs'

const STYLE = `
:root{
  --bg:#fff; --band:#f8f5ef; --border:#24231f; --ink:#24231f; --muted:#635a4e;
  --accent:#dd4f1e; --growth:#2f6b46; --caution:#9e1b45; --line:#e7e1d6; --unknown:#b3aa9c;
  --sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:13px;line-height:1.5}
.page{max-width:1080px;margin:0 auto;padding:24px 28px 48px}
header{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:0;flex:1}
.seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff}
.seg a{font-size:12px;padding:5px 11px;background:#fff;border-right:1px solid var(--border);color:var(--muted);text-decoration:none}
.seg a:last-child{border-right:0}
.seg a[aria-current=page]{background:var(--ink);color:#fff}
.meta{margin:10px 0 0;color:var(--muted);font-family:var(--mono);font-size:11.5px}
.meta .dot{color:#c9c1b4;margin:0 6px}
.pill{display:inline-block;border:1px solid var(--accent);color:var(--accent);border-radius:999px;padding:0 7px;font-size:11px;font-family:var(--sans)}
.alarm{margin:14px 0 0;border:1px solid var(--caution);border-radius:8px;padding:10px 12px;color:var(--caution);background:#fdf5f7}
section{margin-top:26px}
.head{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.head h2{font-size:13px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.07em}
.head .through{color:var(--muted);font-family:var(--mono);font-size:11px;margin-left:auto}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}
.tile{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--band)}
.tile .k{color:var(--muted);font-size:11.5px}
.tile .v{font-family:var(--mono);font-size:26px;font-weight:600;letter-spacing:-0.02em;margin-top:2px}
.tile .v.un{font-size:18px;color:var(--unknown)}
.tile .d{font-size:11.5px;color:var(--muted)}
.tile .d b{font-weight:600}
.tile .d b.up{color:var(--growth)}
.tile .d b.down{color:var(--caution)}
.tile .d b.flat{color:var(--muted)}
.spark{display:flex;align-items:flex-end;gap:2px;height:28px;margin-top:8px}
.spark i{flex:1;background:#d8cfbf;border-radius:1px;min-height:1px}
.spark i.open{background:var(--accent);opacity:.45}
.spark i.un{background:repeating-linear-gradient(45deg,#ece6db,#ece6db 2px,transparent 2px,transparent 4px);height:100%}
table{width:100%;border-collapse:collapse;margin-top:12px;font-family:var(--mono);font-size:12px}
th{text-align:right;font-family:var(--sans);font-size:11px;font-weight:600;color:var(--muted);padding:4px 8px;border-bottom:1px solid var(--line)}
th:first-child,td:first-child{text-align:left}
td{text-align:right;padding:5px 8px;border-bottom:1px solid #f2ede4}
td.fail{color:var(--caution)}
td.un{color:var(--unknown)}
.note{margin:8px 0 0;color:var(--muted);font-size:11.5px}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:12px}
.colk{font-size:11px;font-weight:600;color:var(--muted);margin-bottom:2px}
.bar{display:flex;align-items:center;gap:8px;margin:5px 0;font-family:var(--mono);font-size:12px}
.bar span:first-child{width:96px;color:var(--ink);overflow:hidden;text-overflow:ellipsis}
.bar u{height:8px;background:var(--accent);opacity:.55;border-radius:2px;text-decoration:none;min-width:1px}
.bar em{color:var(--muted);font-style:normal;margin-left:auto}
footer{margin-top:32px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:11.5px;max-width:760px}
`

const DASH = '—'

export function pageOf(view) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>AI4Kanban usage — production, last ${view.days} days</title>
<style>${STYLE}</style></head>
<body><div class="page">
${header(view)}
${alarm(view)}
${overview(view)}
${runsAndCards(view)}
${site(view)}
${spread(view)}
${footer()}
</div></body></html>
`
}

function header(view) {
  const ranges = view.ranges
    .map(
      (days) =>
        `<a href="/?days=${days}"${days === view.days ? ' aria-current="page"' : ''}>${days}d</a>`,
    )
    .join('')
  const bits = [
    'Production',
    host(view.endpoint),
    `${view.from} &rarr; ${view.to}`,
    `read ${view.readAt}`,
  ]
  const open = view.openToday ? `<span class="dot">·</span><span class="pill">today not settled</span>` : ''
  return `<header>
  <h1>AI4Kanban usage</h1>
  <div class="seg">${ranges}</div>
</header>
<p class="meta">${bits.join('<span class="dot">·</span>')}${open}</p>`
}

const alarm = (view) =>
  view.readFailed
    ? `<p class="alarm">Could not read the production summaries. Every number below is unknown until this page is restarted.</p>`
    : ''

function overview(view) {
  const tiles = view.overview
    .map((tile) => {
      const value =
        tile.value === null
          ? `<div class="v un">unknown</div>`
          : `<div class="v">${number(tile.value)}</div>`
      const delta =
        tile.delta === null
          ? `<div class="d">nothing to compare</div>`
          : `<div class="d"><b class="${tone(tile.delta)}">${sign(tile.delta)}</b> avg vs previous ${view.days}d</div>`
      return `<div class="tile"><div class="k">${tile.label}</div>${value}${delta}${spark(tile.series, view)}</div>`
    })
    .join('\n    ')
  return `<section>
  <div class="head"><h2>Overview</h2><span class="through">${through(view)}</span></div>
  <div class="tiles">
    ${tiles}
  </div>
</section>`
}

/** One bar a day, oldest on the left. A day with no summary is hatched rather than drawn at
 *  zero, and the day still taking events is drawn in the accent so it is not read as a fall. */
function spark(series, view) {
  const most = Math.max(1, ...series.map((one) => one.value ?? 0))
  const bars = series
    .map(({ day, value }) => {
      if (value === null) return `<i class="un" title="${day}: no summary"></i>`
      const open = day === view.to && view.openToday ? ' open' : ''
      return `<i class="${open.trim()}" style="height:${Math.max(2, Math.round((100 * value) / most))}%" title="${day}: ${number(value)}"></i>`
    })
    .join('')
  return `<div class="spark">${bars}</div>`
}

function runsAndCards(view) {
  const head = ['day', ...DAY_COLUMNS].map((label) => `<th>${label}</th>`).join('')
  const rows = view.daily
    .map((row) => {
      const cells = row.cells
        .map((cell) =>
          cell.value === null
            ? `<td class="un">${DASH}</td>`
            : `<td${cell.tone && cell.value ? ` class="${cell.tone}"` : ''}>${number(cell.value)}</td>`,
        )
        .join('')
      return `    <tr><td>${row.day}</td>${cells}</tr>`
    })
    .join('\n')
  return `<section>
  <div class="head"><h2>Runs and cards</h2><span class="through">${view.days} days, ${through(view)}</span></div>
  <table>
    <tr>${head}</tr>
${rows}
  </table>
  <p class="note">${DASH} is a day with no summary, not a day nobody used it.</p>
</section>`
}

function site(view) {
  const head = ['page', 'views', 'presses', 'rate', ...view.site.languages]
  const rows = view.site.rows.map(
    (row) =>
      `    <tr><td>${escaped(row.page)}</td>${cell(row.views)}${cell(row.presses)}` +
      `<td${row.rate === null ? ' class="un"' : ''}>${percent(row.rate)}</td>` +
      `${row.byLanguage.map((one) => `<td${one === null ? ' class="un"' : ''}>${percent(one)}</td>`).join('')}</tr>`,
  )
  return `<section>
  <div class="head"><h2>Site</h2><span class="through">views and download presses · ${view.site.knownDays} of ${view.days} days have a summary · written ${view.writtenAt ?? 'unknown'}</span></div>
  <table>
    <tr>${head.map((label) => `<th>${escaped(label)}</th>`).join('')}</tr>
${rows.join('\n')}
  </table>
  <p class="note">A press is a button pressed, not a download finished or an app installed.</p>
</section>`
}

function spread(view) {
  if (!view.spread) {
    return `<section>
  <div class="head"><h2>Spread</h2><span class="through">no summary in this range</span></div>
  <p class="note">A spread is read from one day. No day in this range has a summary — pick a longer one.</p>
</section>`
  }
  const columns = view.spread.columns
    .map((column) => {
      const bars = column.bars.length
        ? column.bars
            .map(
              (bar) =>
                `<div class="bar"><span>${escaped(bar.key)}</span><u style="width:${Math.round(100 * bar.share)}%"></u><em>${number(bar.n)}</em></div>`,
            )
            .join('')
        : `<p class="note">${DASH}</p>`
      return `    <div><div class="colk">${column.label}</div>${bars}</div>`
    })
    .join('\n')
  return `<section>
  <div class="head"><h2>Spread</h2><span class="through">${view.spread.day} only — one day, never a range</span></div>
  <div class="cols">
${columns}
  </div>
  <p class="note">Installs are counted once a day, so adding days together would count the same machine twice.</p>
</section>`
}

const footer = () => `<footer>
  App numbers cover installs with usage reporting on; site numbers cover browsers that ran the
  counter on the two pages carrying a download button. Neither is the whole product's use, and
  no bot is filtered out of either. Raw events are kept ${LIMITS.retentionDays} days, so an
  install away longer than that counts as new again. The day's own plan usage cannot be
  measured on this account, so it is not shown here.
</footer>`

/** What a section's numbers were read through, and when that summary was written. */
const through = (view) =>
  view.through
    ? `through ${view.through} · summary written ${view.writtenAt ?? 'unknown'}`
    : 'no summary for any day in this range'

const cell = (n) => (n === null ? `<td class="un">${DASH}</td>` : `<td>${number(n)}</td>`)
const host = (endpoint) => escaped(endpoint.replace(/^https?:\/\//, ''))
const number = (n) => n.toLocaleString('en-US')
const sign = (n) => (n < 0 ? `−${Math.abs(n)}%` : `+${n}%`)
const tone = (n) => (n < 0 ? 'down' : n > 0 ? 'up' : 'flat')
const percent = (n) => (n === null ? `${DASH}` : `${n.toFixed(1)}%`)

const escaped = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (one) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[one],
  )
