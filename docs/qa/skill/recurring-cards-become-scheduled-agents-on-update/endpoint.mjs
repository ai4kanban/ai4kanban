// Stands in for a triage endpoint: answers every GET with two made-up items.
// usage: node endpoint.mjs <port>
import http from 'node:http'

const signals = [
  { title: 'Export the board as CSV', summary: 'Two teams asked for a spreadsheet of open cards.', source_type: 'reddit', source_id: 'qa-1' },
  { title: 'Dark mode flickers on load', summary: 'The page flashes white before the dark theme applies.', source_type: 'x', source_id: 'qa-2' },
]
http
  .createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ signals }))
  })
  .listen(Number(process.argv[2]), '127.0.0.1')
