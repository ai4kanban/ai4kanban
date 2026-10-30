/**
 * The public pricing page (#2017), at `/pricing`, in Chinese and English, desktop and phone.
 * Every number comes from src/quota.ts and src/credits.ts. Subscribing signs in with GitHub through Supabase and
 * lands on Creem's checkout.
 */

import { RUNNER_DOWNLOAD_URL } from './config.ts'
import { CREDIT_RATES } from './credits.ts'
import type { Env } from './env.ts'
import { PLANS, PRICES } from './quota.ts'

export type Lang = 'zh' | 'en'

const size = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${bytes / 1024 ** 3} GB` : `${Math.round(bytes / 1024 ** 2)} MB`

const TEXT = {
  zh: {
    title: '定价 · WildCrane',
    eyebrow: '定价',
    titleA: '方案与',
    titleB: '定价',
    cta: '免费开始',
    other: 'English',
    limitsHead: '额度',
    featuresHead: '功能',
    labels: ['同时运行的任务', '云端存储', '单个文件上限', '保存时长', '加购存储'],
    tasks: (n: number) => `${n} 个`,
    days: (n: number) => `${n} 天`,
    extra: '按需加购',
    rates: ['语音合成（每分钟积分）', '图像生成（每张积分）', '音乐生成（每首积分）'],
    tiers: { economy: '经济', standard: '标准', premium: '高质' },
    shared: ['多 Agent 支持', '分阶段审核', '自定义工作流', '链接分享与访客审阅', '记住偏好与项目要求'],
    per: '/ 月',
    free: { name: 'Free', sub: '适合轻量使用', button: '免费开始' },
    pro: { name: 'Pro', badge: '推荐', sub: '适合日常创作', button: '订阅 Pro' },
    keptNote: '到期删除任务、历史和预览',
    notices: {
      done: 'Pro 已开通，感谢订阅。',
      trial: '已开始 7 天 Pro 免费试用。',
      subscribed: '你已订阅 Pro。',
      failed: '没能打开付款页面，请重试。',
    },
  },
  en: {
    title: 'Pricing · WildCrane',
    eyebrow: 'Pricing',
    titleA: 'Plans and ',
    titleB: 'pricing',
    cta: 'Start free',
    other: '中文',
    limitsHead: 'Limits',
    featuresHead: 'Features',
    labels: ['Tasks running at once', 'Cloud storage', 'Max file size', 'Kept for', 'Extra storage'],
    tasks: (n: number) => String(n),
    days: (n: number) => `${n} days`,
    extra: 'Buy as needed',
    rates: ['Text to speech (credits per minute)', 'Image generation (credits per image)', 'Music generation (credits per track)'],
    tiers: { economy: 'Economy', standard: 'Standard', premium: 'Premium' },
    shared: ['Multi-agent support', 'Review at each stage', 'Custom workflows', 'Review links and guest access', 'Personal & project memory'],
    per: '/ month',
    free: { name: 'Free', sub: 'For occasional use', button: 'Start free' },
    pro: { name: 'Pro', badge: 'Recommended', sub: 'For everyday creative work', button: 'Upgrade to Pro' },
    keptNote: 'Auto-deletes tasks, history & previews.',
    notices: {
      done: 'Pro is on. Thanks for subscribing.',
      trial: 'Your 7-day free Pro trial has started.',
      subscribed: 'You already have Pro.',
      failed: "Couldn't open checkout. Please try again.",
    },
  },
}

export const langOf = (request: Request, url: URL): Lang => {
  const asked = url.searchParams.get('lang')
  if (asked === 'zh' || asked === 'en') return asked
  return /^zh\b/i.test(request.headers.get('accept-language') ?? '') ? 'zh' : 'en'
}

export function pricingPage(request: Request, env: Env): Response {
  const url = new URL(request.url)
  return new Response(renderPricing(langOf(request, url), env.SUPABASE_URL), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', vary: 'accept-language' },
  })
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const CHECK = '<svg class="ck" viewBox="0 0 24 24" aria-label="✓"><path d="M20 6 9 17l-5-5"/></svg>'

function values(lang: Lang, plan: 'free' | 'pro'): string[] {
  const t = TEXT[lang]
  const p = PLANS[plan]
  return [t.tasks(p.tasks), size(p.storage), size(p.file), t.days(p.retentionDays), plan === 'pro' ? t.extra : '—']
}

/** Pro's credits per use (#87), one line per capability: `标准 160 · 高质 270`. Free has none. */
function rates(lang: Lang): string[] {
  const t = TEXT[lang]
  const tiered = (r: Record<string, number>) =>
    Object.entries(r).map(([tier, n]) => `${t.tiers[tier as keyof typeof t.tiers]} ${n}`).join(' · ')
  return [tiered(CREDIT_RATES.speech), tiered(CREDIT_RATES.image), String(CREDIT_RATES.music)]
}

const value = (v: string | true) =>
  v === true ? CHECK : `<span class="${v === '—' ? 'none' : 'v'}">${esc(v)}</span>`

/** `$19` with each digit on a wheel that rolls into place. */
function odometer(price: string): string {
  const digits = [...price]
    .map((ch, i) =>
      /\d/.test(ch)
        ? `<span class="wheel"><span class="digit" style="--to:-${10 + Number(ch)}em;animation-delay:${i * 90}ms">${Array.from({ length: 20 }, (_, n) => `<span>${n % 10}</span>`).join('')}</span></span>`
        : `<span>${esc(ch)}</span>`,
    )
    .join('')
  return `<span class="price"><span class="sr">${esc(price)}</span><span aria-hidden="true" class="odo">${digits}</span></span>`
}

function planHead(lang: Lang, plan: 'free' | 'pro'): string {
  const t = TEXT[lang]
  const p = t[plan]
  const badge = 'badge' in p ? `<span class="badge">${esc(p.badge)}</span>` : ''
  const action = plan === 'pro'
    ? `<button type="button" class="btn primary" data-checkout="pro">${esc(p.button)}</button>`
    : `<a class="btn" href="${RUNNER_DOWNLOAD_URL}">${esc(p.button)}</a>`
  return `<div class="head"><div class="name"><h2>${p.name}</h2>${badge}</div><p class="sub">${esc(p.sub)}</p>
<p class="cost">${odometer(`$${plan === 'pro' ? PRICES.pro : 0}`)}<span class="per">${esc(t.per)}</span></p>${action}</div>`
}

function label(lang: Lang, text: string, i: number, limits: boolean): string {
  const note = limits && i === 3 ? `<span class="note">${esc(TEXT[lang].keptNote)}</span>` : ''
  return `<span class="label">${esc(text)}${note}</span>`
}

function compare(lang: Lang): string {
  const t = TEXT[lang]
  const free = values(lang, 'free')
  const pro = values(lang, 'pro')
  const row = (l: string, a: string | true, b: string | true, i: number, limits: boolean, kind = 'row') =>
    `<div class="${kind}">${label(lang, l, i, limits)}<span class="cell">${value(a)}</span><span class="cell pro">${value(b)}</span></div>`
  const group = (title: string) => `<div class="row group"><span class="label">${esc(title)}</span><span class="cell"></span><span class="cell pro"></span></div>`
  return `<div class="compare">
<div class="row top"><div class="intro"><span class="tag"><i></i>${esc(t.eyebrow)}</span><h1 class="${lang}">${esc(t.titleA)}<span class="mark">${esc(t.titleB)}</span></h1></div>
<div class="cell">${planHead(lang, 'free')}</div><div class="cell pro">${planHead(lang, 'pro')}</div></div>
${group(t.limitsHead)}${t.labels.map((l, i) => row(l, free[i]!, pro[i]!, i, true)).join('')}${rates(lang).map((r, i) => row(t.rates[i]!, '—', r, i, false, 'row tiers')).join('')}
${group(t.featuresHead)}${t.shared.map((l, i) => row(l, true, true, i, false)).join('')}
</div>`
}

function phonePlan(lang: Lang, plan: 'free' | 'pro'): string {
  const t = TEXT[lang]
  const v = values(lang, plan)
  const items = [
    ...t.labels.map((l, i) => `<li>${label(lang, l, i, true)}${value(v[i]!)}</li>`),
    ...rates(lang).map((r, i) => `<li>${label(lang, t.rates[i]!, i, false)}${value(plan === 'pro' ? r : '—')}</li>`),
    ...t.shared.map((l, i) => `<li>${label(lang, l, i, false)}${value(true)}</li>`),
  ]
  return `<section class="plan ${plan}"><div class="top">${planHead(lang, plan)}</div><ul>${items.join('')}</ul></section>`
}

const LANES = [70, 88, 76, 94, 82, 72, 90, 80, 86]
const FLOW = ['#cfe9d9', '#f3cdb8', '#ddd3f5', '#cfe9d9', '#cfe2f5', '#f3cdb8']
const WIDTHS = [64, 44, 80, 52, 72, 40]

/** Blank task cards gliding along faint lanes, behind everything. Still under reduced motion. */
function board(): string {
  const lanes = LANES.map((dur, lane) => {
    const cards = Array.from({ length: 8 }, (_, i) => (lane * 2 + i) % FLOW.length)
    const card = (n: number) =>
      `<span class="card"><span class="chip" style="background:${FLOW[n]}"></span><span class="lines"><span style="width:${WIDTHS[n]}px"></span>${n % 2 === 0 ? `<span class="faint" style="width:${WIDTHS[n]! * 0.6}px"></span>` : ''}</span></span>`
    return `<div class="lane" style="--dur:${dur}s;animation-delay:-${lane * 7}s">${[...cards, ...cards].map(card).join('')}</div>`
  })
  return `<div class="board" aria-hidden="true">${lanes.join('')}</div>`
}

const LOGO = `<svg class="mark-svg" viewBox="2 4 56 52" aria-hidden="true"><path d="M2 55.75C2 55.69 2.69 55.09 3.55 54.37L5.09 53.1L6.61 53.1L8.13 53.1L12.49 49.87C14.9 48.07 16.83 46.58 16.77 46.53C16.75 46.47 15.56 46.64 14.15 46.89C12.74 47.13 11.55 47.3 11.53 47.24C11.47 47.19 12.02 46.22 12.71 45.06L14.01 42.96L18.21 41.34C20.53 40.45 22.41 39.65 22.41 39.57C22.41 39.49 21.27 38.55 19.92 37.5C15.92 34.4 13.13 31.31 10.86 27.47L10.01 26.01L10.53 26.18C10.84 26.26 12.96 27.2 15.28 28.25C17.6 29.32 19.53 30.12 19.59 30.07C19.64 30.01 17.68 28.69 15.25 27.11C12.8 25.57 10.56 23.97 10.31 23.58C9.15 21.95 7.25 17.5 7.25 16.46C7.25 16.26 10.01 17.95 13.38 20.18C16.77 22.45 19.73 24.38 19.95 24.49C20.42 24.74 20.25 24.57 13.9 19.02L9.18 14.88L8.6 13.36C7.72 10.96 6.97 7.54 6.97 5.77L6.97 4.14L9.4 6.46C12.66 9.61 15.56 12.01 23.57 18.25C27.32 21.18 30.5 23.72 30.64 23.91C30.8 24.08 31.68 26.51 32.6 29.3L34.28 34.35L35.72 35.65C37.54 37.3 37.98 37.47 36.85 36.09L35.96 35.01L37.12 34.71C39.11 34.21 40.16 33.52 42.54 31.12L44.8 28.8L46.02 28.96C46.71 29.07 47.56 29.07 47.95 28.96L48.67 28.8L48.67 28.25L48.67 27.69L49.27 27.69C49.63 27.69 50.1 27.58 50.32 27.42L50.71 27.17L51.01 27.42C51.18 27.56 52.78 27.86 54.58 28.08C56.37 28.3 57.86 28.52 57.94 28.58C58 28.63 56.73 28.85 55.13 29.05C53.53 29.24 50.96 29.77 49.44 30.21C47.92 30.65 46.57 31.01 46.43 31.01C46.29 31.01 44.22 32.97 41.85 35.37C37.57 39.62 34.42 42.14 30.83 44.15L29.14 45.09L25.97 45.73L22.77 46.39L14.59 51.11L6.42 55.86L4.21 55.86C2.99 55.86 2 55.8 2 55.75Z" fill="currentColor"/><path d="M44.97 27.45C44.61 26.89 46.57 25.76 47.87 25.76C48.72 25.76 50.6 26.7 50.6 27.14C50.6 27.64 45.27 27.97 44.97 27.45Z" fill="#dd4f1e"/></svg><svg class="word" viewBox="319.3 121.9 589.3 93.4" role="img" aria-label="WildCrane"><path d="M337.7 213.6 319.3 131.1H338.8L350.9 197.7H352L366.1 131.1H388.6L402.8 197.7H404L416.2 131.1H434.7L416.1 213.6H391L377.5 147.4H376.6L363.1 213.6ZM442.1 213.6V148H460V213.6ZM451 139.3Q445.8 139.3 443 137.1Q440.2 134.9 440.2 130.6Q440.2 126.3 443 124.1Q445.8 121.9 451 121.9Q456.4 121.9 459.2 124.2Q461.9 126.4 461.9 130.6Q461.9 134.8 459.2 137Q456.4 139.3 451 139.3ZM472.3 213.6V125H490V213.6ZM526 215.3Q518 215.3 512 211.2Q506 207.1 502.6 199.3Q499.2 191.6 499.2 180.6Q499.2 170.2 502.2 162.5Q505.2 154.9 511 150.6Q516.8 146.4 525.1 146.4Q531.5 146.4 535.8 148.8Q540.2 151.2 543 156Q545.8 160.7 547.3 167.7H549.7Q548.9 163.5 548.3 159.6Q547.6 155.6 547.2 152.1Q546.8 148.5 546.8 145.6V125H564.9V183.5V213.6H549.7L549.8 194.1H547.7Q546.3 201.2 543.4 205.9Q540.6 210.7 536.2 213Q531.8 215.3 526 215.3ZM532 200.7Q535.7 200.7 538.5 199Q541.3 197.3 543.2 194.5Q545.1 191.7 546 188.4Q546.9 185.1 546.9 181.8V179.8Q546.9 177.2 546.3 174.5Q545.6 171.9 544.3 169.4Q543.1 167 541.2 165.1Q539.3 163.2 537 162.2Q534.6 161.1 531.7 161.1Q527.3 161.1 524.3 163.6Q521.2 166.1 519.5 170.6Q517.8 175.1 517.8 181Q517.8 186.7 519.6 191.2Q521.3 195.7 524.5 198.2Q527.6 200.7 532 200.7ZM615.5 215.3Q605.8 215.3 598.3 212.4Q590.8 209.6 585.7 204.1Q580.5 198.6 577.9 190.8Q575.3 183 575.3 173.1Q575.3 163 578 154.9Q580.7 146.9 585.8 141.1Q590.9 135.4 598.1 132.4Q605.4 129.4 614.5 129.4Q621.9 129.4 627.8 131.4Q633.7 133.4 637.9 137Q642.1 140.6 644.3 145.7Q646.6 150.7 646.5 156.9L629.9 160.7Q629.9 155.2 627.7 151.6Q625.6 148 622 146.1Q618.4 144.1 613.9 144.1Q610.1 144.1 606.5 145.7Q602.9 147.3 600.1 150.6Q597.4 154 595.7 159.2Q594 164.5 594 172.1Q594 181.8 596.8 188.1Q599.5 194.5 604.5 197.5Q609.5 200.6 615.9 200.6Q622.5 200.6 626.3 197.8Q630.1 195 631.8 190.4Q633.5 185.8 633.5 180.5L649.5 182.8Q649.6 189.6 647.8 195.5Q646 201.3 641.9 205.8Q637.8 210.3 631.4 212.8Q624.9 215.3 615.5 215.3ZM657.6 213.6V181.1V148H672.7L672.6 171.6H674.7Q675.6 162.7 677.9 157.2Q680.3 151.6 684.4 149.1Q688.5 146.5 694.5 146.5Q695.9 146.5 697.5 146.7Q699 146.9 700.9 147.5L700.2 166.7Q698 165.7 695.7 165.3Q693.4 164.9 691.7 164.9Q686.9 164.9 683.5 167.2Q680.2 169.5 678.2 173.9Q676.2 178.3 675.6 184.8V213.6ZM722 215.3Q716.8 215.3 712.5 213.2Q708.1 211.2 705.6 207.1Q703.1 203.1 703.1 196.8Q703.1 191.3 705.3 187.6Q707.4 184 711.4 181.7Q715.4 179.3 720.9 178Q726.5 176.6 733.2 175.5Q738 174.7 740.7 174.1Q743.5 173.5 744.7 172.3Q746 171.1 746 168.7Q746 165 743.4 162.5Q740.7 160.1 735.4 160.1Q732 160.1 728.9 161.4Q725.9 162.6 723.8 165.2Q721.6 167.7 721 171.9L705 168Q706.1 162.2 708.9 158.1Q711.6 154 715.7 151.4Q719.8 148.8 724.9 147.5Q730.1 146.3 735.9 146.3Q745.4 146.3 751.5 149.4Q757.6 152.6 760.6 159.1Q763.6 165.6 763.6 175.5V186.8Q763.6 191.2 763.7 195.7Q763.8 200.2 764.1 204.7Q764.3 209.2 764.7 213.6H748.9Q748.5 209.9 748.2 205.7Q747.9 201.4 747.7 196.9H745.9Q744.5 202.1 741.2 206.3Q738 210.4 733.1 212.9Q728.2 215.3 722 215.3ZM729.5 202.2Q732 202.2 734.5 201.3Q737 200.4 739.3 198.7Q741.6 196.9 743.5 194.3Q745.4 191.6 746.2 188L746.1 179.6L749 179.8Q747.1 181.5 744.2 182.4Q741.4 183.3 738.2 183.9Q735 184.5 731.9 185Q728.7 185.6 726.2 186.6Q723.6 187.6 722.1 189.3Q720.6 191.1 720.6 194.1Q720.6 197.9 723.1 200.1Q725.6 202.2 729.5 202.2ZM775.1 213.6V174.8V148H789.9L789.8 169.9H791.8Q793.2 161.9 796.1 156.6Q798.9 151.4 803.5 148.8Q808.2 146.3 814.7 146.3Q825.9 146.3 831.6 154.1Q837.4 161.9 837.4 178.3V213.6H819.4V180.3Q819.4 170.5 816.5 166Q813.7 161.5 807.9 161.5Q803.2 161.5 799.9 164.5Q796.6 167.6 794.8 173Q793.1 178.5 793.1 185.8V213.6ZM879.3 215.3Q871 215.3 864.7 212.9Q858.4 210.6 854.1 206.3Q849.9 201.9 847.7 195.8Q845.5 189.6 845.5 182Q845.5 174.3 847.6 167.9Q849.7 161.4 853.9 156.5Q858 151.6 864.1 148.9Q870.2 146.3 878 146.3Q885.7 146.3 891.6 148.8Q897.4 151.4 901.3 156.2Q905.1 161.1 906.7 168.1Q908.4 175.1 907.7 183.8L857.1 184.3V174.5L896.4 174L891.1 179.2Q891.8 172.8 890.3 168.6Q888.7 164.4 885.5 162.3Q882.3 160.2 878.2 160.2Q873.3 160.2 869.9 162.8Q866.5 165.4 864.6 170.1Q862.7 174.8 862.7 181.5Q862.7 192.1 867.2 197.1Q871.6 202.1 879.3 202.1Q882.8 202.1 885.2 201.1Q887.6 200.2 889.1 198.6Q890.7 197.1 891.5 195.1Q892.3 193.1 892.7 191.1L908.6 193.8Q907.9 198.3 905.9 202.3Q903.9 206.2 900.4 209.1Q896.8 211.9 891.6 213.6Q886.5 215.3 879.3 215.3Z" fill="currentColor"/></svg>`

export function renderPricing(lang: Lang, supabaseUrl: string): string {
  const t = TEXT[lang]
  const other: Lang = lang === 'zh' ? 'en' : 'zh'
  const script = {
    lang,
    supabase: supabaseUrl.replace(/\/+$/, ''),
    notices: t.notices,
  }
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title><link rel="alternate" hreflang="${other}" href="/pricing?lang=${other}"><style>${CSS}</style></head>
<body><header class="bar"><a class="logo" href="/pricing?lang=${lang}">${LOGO}</a>
<a class="lang" href="/pricing?lang=${other}" hreflang="${other}">${esc(t.other)}</a>
<a class="cta" href="${RUNNER_DOWNLOAD_URL}">${esc(t.cta)}</a></header>
<p class="notice" role="status" hidden></p>
<main>${board()}
<div class="wide">${compare(lang)}</div>
<div class="narrow"><div class="intro"><span class="tag"><i></i>${esc(t.eyebrow)}</span><h1>${esc(t.titleA)}<span class="mark">${esc(t.titleB)}</span></h1></div>
${phonePlan(lang, 'free')}${phonePlan(lang, 'pro')}</div>
</main>
<script>const PAGE = ${JSON.stringify(script).replace(/</g, '\\u003c')};
${SCRIPT}</script></body></html>`
}

// Subscribing: sign in with GitHub, come back here with a token in the fragment, start the
// checkout. The token is used once and never stored.
const SCRIPT = String.raw`
const notice = document.querySelector('.notice')
const say = (text) => { notice.textContent = text; notice.hidden = false }
const here = new URL(location.href)
const token = new URLSearchParams(location.hash.slice(1)).get('access_token')
const call = (path, body, bearer) => fetch(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(bearer ? { authorization: 'Bearer ' + bearer } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw j; return j })

async function checkout(bearer) {
  const { billing } = await fetch('/v1/billing', { headers: { authorization: 'Bearer ' + bearer } }).then((r) => r.json())
  if (billing && billing.mayTrial) {
    await call('/v1/billing/trial', {}, bearer)
    return say(PAGE.notices.trial)
  }
  if (billing && billing.plan === 'pro' && billing.state !== 'free' && billing.state !== 'expired') return say(PAGE.notices.subscribed)
  const { url } = await call('/v1/billing/checkout', { item: 'pro', period: 'monthly', source: 'pricing' }, bearer)
  location.href = url
}

if (here.searchParams.get('checkout') === 'done') say(PAGE.notices.done)
if (token && here.searchParams.get('checkout') === 'pro') {
  history.replaceState(null, '', '/pricing?lang=' + PAGE.lang)
  checkout(token).catch(() => say(PAGE.notices.failed))
}

for (const button of document.querySelectorAll('[data-checkout]')) {
  button.addEventListener('click', () => {
    const back = new URL('/pricing?lang=' + PAGE.lang + '&checkout=pro', location.origin)
    const signin = new URL(PAGE.supabase + '/auth/v1/authorize')
    signin.searchParams.set('provider', 'github')
    signin.searchParams.set('redirect_to', back.href)
    location.href = signin.href
  })
}
`

const CSS = `
:root{--ink:#24231f;--soft:#565550;--accent:#dd4f1e;--accent-soft:#f7ddce;--accent-deep:#b83a12;--rule:rgba(36,35,31,.1);--pro:rgba(251,240,233,.55);
--mint-soft:#e4f3ea;--mint-ink:#2f6b46}
[hidden]{display:none!important}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:var(--ink);overflow-x:clip}
body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}h1,h2,p{margin:0}ul{margin:0;padding:0;list-style:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.nowrap{white-space:nowrap}
.bar{position:relative;z-index:2;display:flex;align-items:center;gap:24px;height:56px;padding:0 40px;border-bottom:1px solid var(--rule);background:#fff}
.logo{display:inline-flex;align-items:center;gap:8px}.mark-svg{width:32px;height:30px}.word{height:13.5px;width:85px}
.lang{margin-left:auto;font-size:14px}
.cta{display:inline-flex;align-items:center;height:36px;padding:0 16px;border:1.5px solid var(--ink);border-radius:11px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;box-shadow:3px 3px 0 0 var(--ink);transition:transform .12s,box-shadow .12s}
.cta:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--ink)}.cta:active{transform:translate(1px,1px);box-shadow:1px 1px 0 0 var(--ink)}
.notice{position:relative;z-index:2;margin:16px auto 0;width:min(960px,calc(100% - 40px));padding:12px 16px;border-radius:10px;background:var(--mint-soft);color:var(--mint-ink);font-size:14px;font-weight:600}
main{position:relative;padding:56px 0 80px}
.board{position:absolute;inset:0;display:flex;flex-direction:column;gap:64px;padding-top:40px;overflow:hidden;opacity:.15;pointer-events:none;
-webkit-mask-image:linear-gradient(transparent,rgba(0,0,0,.35) 22%,#000 42%,#000 70%,transparent);mask-image:linear-gradient(transparent,rgba(0,0,0,.35) 22%,#000 42%,#000 70%,transparent)}
.lane{display:flex;gap:48px;width:max-content;flex-shrink:0;animation:lane var(--dur) linear infinite}
.card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--rule);border-radius:8px;background:#fff;flex-shrink:0}
.chip{width:28px;height:12px;border-radius:4px}.lines{display:flex;flex-direction:column;gap:6px}.lines span{height:6px;border-radius:9px;background:rgba(36,35,31,.1)}.lines .faint{background:rgba(36,35,31,.06)}
@keyframes lane{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes roll{from{transform:translateY(0)}to{transform:translateY(var(--to))}}
.wide{position:relative;width:960px;margin:0 auto}
.compare{overflow:hidden;border:1px solid var(--rule);border-radius:12px;background:#fff}
.row{display:grid;grid-template-columns:1fr 300px 300px;min-height:48px;border-top:1px solid var(--rule);font-size:14.5px;line-height:48px}
.row.top{border-top:0;line-height:normal}.row.group{min-height:0;line-height:normal}
.row.group .label{padding:24px 28px 8px;font-size:12.5px;font-weight:700;color:var(--ink)}
.label{padding:0 28px;color:var(--soft)}.cell{padding:0 28px;border-left:1px solid var(--rule);font-variant-numeric:tabular-nums}.cell.pro{background:var(--pro)}
.row.top .cell,.intro{padding:28px}
.note{display:block;margin-top:-10px;padding-bottom:12px;font-size:12.5px;line-height:1.45;color:rgba(86,85,80,.8)}
.v{font-weight:600;color:var(--ink)}.none{color:rgba(36,35,31,.35)}
.ck{width:16px;height:16px;vertical-align:-3px;fill:none;stroke:var(--ink);stroke-width:2.75;stroke-linecap:round;stroke-linejoin:round}
.tag{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;line-height:1;text-transform:uppercase;letter-spacing:.12em}
.tag i{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.intro h1{margin-top:16px;font-size:36px;font-weight:800;line-height:1.12;letter-spacing:-.03em}.intro h1.zh{font-size:38px}
.mark{background-image:linear-gradient(color-mix(in srgb,var(--accent) 42%,transparent),color-mix(in srgb,var(--accent) 42%,transparent));background-repeat:no-repeat;background-size:100% .26em;background-position:0 90%;padding:0 1px}
.name{display:flex;align-items:center;gap:8px;min-height:24px;flex-wrap:wrap}.name h2{font-size:17px;font-weight:700}
.badge{padding:2px 8px;border-radius:99px;background:var(--accent-soft);color:var(--accent-deep);font-size:11.5px;font-weight:700}
.sub{margin-top:4px;font-size:13.5px;color:var(--soft)}
.cost{display:flex;align-items:baseline;gap:6px;margin:20px 0}.per{font-size:13.5px;color:var(--soft)}
.price{font-size:44px;font-weight:800;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.odo{display:inline-flex}.wheel{display:inline-block;height:1em;overflow:hidden}
.digit{display:flex;flex-direction:column;animation:roll 1.1s cubic-bezier(.2,.9,.25,1) both}.digit span{height:1em}
.btn{display:inline-flex;align-items:center;justify-content:center;width:100%;height:40px;border:1px solid rgba(36,35,31,.2);border-radius:8px;background:#fff;color:var(--ink);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer}
.btn.primary{border-color:var(--accent);background:var(--accent);color:#fff}.btn.primary:hover{background:var(--accent-deep)}
.narrow{display:none}
@media (max-width:999px){
.bar{padding:0 20px;gap:16px}main{padding:36px 20px 48px}.wide{display:none}
.narrow{position:relative;display:flex;flex-direction:column;gap:20px}.narrow .intro{padding:0 0 12px;text-align:center}.narrow .intro h1{margin-top:12px;font-size:32px}
.plan{overflow:hidden;border:1px solid var(--rule);border-radius:12px;background:#fff}.plan .top{padding:20px}.plan.pro .top{background:var(--pro)}
.plan ul{padding:0 20px 6px}.plan li{display:flex;justify-content:space-between;gap:16px;min-height:44px;border-top:1px solid var(--rule);font-size:14px;line-height:44px}
.plan li .label{padding:0;min-width:0}.plan li>.ck{flex-shrink:0;margin-top:14px}.plan li .note{margin-top:-8px}}
.plan li .v{text-align:right;line-height:1.4;padding:12px 0}.row.tiers{line-height:1.45}.row.tiers>span{padding-top:14px;padding-bottom:14px}
@media (prefers-reduced-motion:reduce){.lane,.digit{animation:none}.digit{transform:translateY(var(--to))}}
`
