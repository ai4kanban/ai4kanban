// What the app's installCommand does on macOS: one symlink in ~/.local/bin to the launcher.
import http from 'node:http'
import fs from 'node:fs'
const LINK = '/tmp/qa-lui-r63/cmdhome/.local/bin/akb', TARGET = '/tmp/qa-lui-r63/bin/akb'
http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  if (req.method === 'POST') { fs.mkdirSync('/tmp/qa-lui-r63/cmdhome/.local/bin', { recursive: true }); fs.rmSync(LINK, { force: true }); fs.symlinkSync(TARGET, LINK) }
  res.end(JSON.stringify({ points: TARGET }))
}).listen(4894, '127.0.0.1')
