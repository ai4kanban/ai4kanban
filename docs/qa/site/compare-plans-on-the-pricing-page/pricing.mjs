import { open, byText } from './cdp.mjs'
const D = '/tmp/qa-site/pricing/'
const p = await open()
await p.send('Storage.clearDataForOrigin', { origin: 'http://localhost:3761', storageTypes: 'all' })
await p.nav('http://localhost:3761/pricing', 5000)
const plans = `(()=>{const a=${byText('main a', 'Get Pro')};let e=a;while(e&&!(e.getBoundingClientRect().width>900))e=e.parentElement;return e})()`
const area = async () => p.ev(`(()=>{const e=${plans};const t=${byText('main button, main [role=radio], main [role=tab]', 'Monthly')};const r=e.getBoundingClientRect();const tr=t.getBoundingClientRect();return {y:Math.min(r.y,tr.y)+scrollY,bottom:r.bottom+scrollY,text:e.innerText}})()`)
await p.ev(`(${plans}).scrollIntoView({block:'center'})`); await p.sleep(500)
let a = await area()
await p.shot(D + '01-yearly.png', { x: 150, y: a.y - 30, width: 980, height: a.bottom - a.y + 60 })
const hrefs = async (label) => `${label}\n` + await p.ev(`[...document.querySelectorAll('main a')].filter(a=>/Get Pro|Download|waitlist/i.test(a.textContent)).map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n')`) + '\n' + a.text.split('\n').filter(l=>/\\$|¥|€|\/ ?mo|year|month/i.test(l)).join('\n')
let log = await hrefs('# Yearly (as the page opens)')
await p.click(byText('main button, main [role=radio], main [role=tab]', 'Monthly'))
await p.ev(`(${plans}).scrollIntoView({block:'center'})`); await p.sleep(2500)
a = await area()
await p.shot(D + '02-monthly.png', { x: 150, y: a.y - 30, width: 980, height: a.bottom - a.y + 60 })
log += '\n\n' + await hrefs('# After clicking Monthly')
console.log(log)
await p.close()
