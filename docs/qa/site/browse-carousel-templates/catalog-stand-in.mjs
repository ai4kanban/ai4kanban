// Stands in for Cloud's catalog at http://127.0.0.1:$PORT/v1/catalog: answers 503 while the site
// builds (so its snapshot is empty, like a build that could not read Cloud), then, once
// `touch $LIVE` exists, passes each read on to api.ai4kanban.dev.
// Usage: PORT=4915 LIVE=/tmp/live NODE_USE_ENV_PROXY=1 node catalog-stand-in.mjs
import http from 'node:http'
import fs from 'node:fs'
const { PORT = 4915, LIVE = '/tmp/catalog-live' } = process.env
http.createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' }
  if (!fs.existsSync(LIVE)) { console.log('503', req.url); res.writeHead(503, cors); return res.end('{}') }
  const r = await fetch(`https://api.ai4kanban.dev${req.url}`).catch(() => null)
  console.log(r?.status ?? 'failed', req.url)
  res.writeHead(r?.status ?? 502, cors); res.end(r ? await r.text() : '{}')
}).listen(PORT, '127.0.0.1')
