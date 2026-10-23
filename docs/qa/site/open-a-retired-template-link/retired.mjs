// Usage: SITE=http://127.0.0.1:4594 CDP_PORT=9594 node retired.mjs <proof dir> <step>
// Steps 4 and 5 open the live site and log to live.log.
// Logs the status the browser got for the page, then shoots what it shows.
import fs from 'node:fs'
import { open } from './cdp.mjs'
const [D, step] = process.argv.slice(2)
const steps = {
  1: ['/templates/motion/logo-build', '01-retired-en.png'],
  2: ['/zh/templates/motion/logo-build', '02-retired-zh.png'],
  3: ['/templates/motion/card-widen', '03-new-template.png'],
  4: ['/templates/motion/logo-build', '04-live-en.png', 'https://wildcrane.ai', 'live.log'],
  5: ['/zh/templates/motion/logo-build', '05-live-zh.png', 'https://wildcrane.ai', 'live.log'],
}
const [path, shot, live, logName = 'retired.log'] = steps[step]
const B = live || process.env.SITE || 'http://127.0.0.1:4594'
const p = await open(1280, 800)
let status = ''
p.on((d) => { if (d.method === 'Network.responseReceived' && d.params.type === 'Document') status = d.params.response.status })
await p.nav(B + path, 7000)
const log = `# ${step}. Open ${path}\nHTTP status: ${status}\ntitle: ${await p.ev('document.title')}\nrobots: ${await p.ev(`document.querySelector('meta[name=robots]')?.content`)}\nmain: ${await p.ev(`document.querySelector('main').innerText.replace(/\\n+/g,' | ').slice(0,400)`)}\n\n`
fs.appendFileSync(D + '/' + logName, log)
await p.shot(D + '/' + shot, { x: 0, y: 0, width: 1280, height: 800 })
await p.close()
