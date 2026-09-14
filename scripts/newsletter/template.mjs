// The newsletter's one email template: an issue in, `{ subject, html, text }` out.
//
// Table layout and inline styles only — no <style> block, no web font, no background
// image. Every image carries alt text that says what it showed, and the plain-text
// alternative carries it as words, so the issue reads without its pictures. Colours and
// type follow `web/design.md`.

const INK = '#24231f'
const MUTED = '#635a4e'
const ACCENT = '#dd4f1e'
const ACCENT_DEEP = '#b83a12'
const RULE = '#e5dfd5'
const QUIET = '#8a8a8a'
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

export const SITE_URL = 'https://ai4kanban.dev'
export const POSTAL_ADDRESS =
  'NULLREACH LTD · Office 15285 Initial Business Centre, Unit 7 Wilson Business Park, Manchester, M40 8WN, United Kingdom'

/** An image already hosted somewhere else. Anything else is a path under the site. */
export function isAbsolute(src) {
  return /^https?:\/\//i.test(String(src))
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Every issue field the template reads, checked before a send can touch the list. */
export function validateIssue(issue) {
  const problems = []
  const text = (key, value) => {
    if (typeof value !== 'string' || !value.trim()) problems.push(`${key} is missing`)
  }
  text('subject', issue?.subject)
  text('preheader', issue?.preheader)
  text('eyebrow', issue?.eyebrow)
  text('headline', issue?.headline)
  text('intro', issue?.intro)
  text('cta.label', issue?.cta?.label)
  text('cta.href', issue?.cta?.href)

  if (issue?.hero) {
    text('hero.src', issue.hero.src)
    text('hero.alt', issue.hero.alt)
  }
  if (issue?.releaseNotes) {
    text('releaseNotes.label', issue.releaseNotes.label)
    text('releaseNotes.href', issue.releaseNotes.href)
  }

  const highlights = Array.isArray(issue?.highlights) ? issue.highlights : []
  if (highlights.length === 0) problems.push('highlights is empty')
  highlights.forEach((h, i) => {
    text(`highlights[${i}].label`, h?.label)
    text(`highlights[${i}].title`, h?.title)
    text(`highlights[${i}].body`, h?.body)
    if (h?.image) {
      text(`highlights[${i}].image.src`, h.image.src)
      text(`highlights[${i}].image.alt`, h.image.alt)
    }
  })

  // The words a reader sees are English; a stray translation would ship half a sentence
  // in a language the list was never built for.
  for (const [key, value] of readableStrings(issue)) {
    if (/[㐀-鿿぀-ヿ가-힯]/.test(value)) problems.push(`${key} is not English`)
  }
  return problems
}

function* readableStrings(issue) {
  yield ['subject', issue?.subject ?? '']
  yield ['preheader', issue?.preheader ?? '']
  yield ['eyebrow', issue?.eyebrow ?? '']
  yield ['headline', issue?.headline ?? '']
  yield ['intro', issue?.intro ?? '']
  yield ['cta.label', issue?.cta?.label ?? '']
  if (issue?.hero) yield ['hero.alt', issue.hero.alt ?? '']
  if (issue?.releaseNotes) yield ['releaseNotes.label', issue.releaseNotes.label ?? '']
  for (const [i, h] of (issue?.highlights ?? []).entries()) {
    yield [`highlights[${i}].label`, h?.label ?? '']
    yield [`highlights[${i}].title`, h?.title ?? '']
    yield [`highlights[${i}].body`, h?.body ?? '']
    if (h?.image) yield [`highlights[${i}].image.alt`, h.image.alt ?? '']
  }
}

function row(inner) {
  return `<tr><td>${inner}</td></tr>`
}

function cell(padding, inner) {
  return `<tr><td style="padding:${padding};">${inner}</td></tr>`
}

function hairline() {
  return cell('0 24px', `<div style="height:1px;line-height:1px;font-size:0;background:${RULE};">&nbsp;</div>`)
}

function highlight(item, image) {
  // No border-radius: the corner is baked into the picture, and a second one on top
  // would clip the mat the picture is mounted on.
  const picture = item.image
    ? `<img src="${escapeHtml(image(item.image.src))}" width="552" alt="${escapeHtml(item.image.alt)}" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:16px 0 0;">`
    : ''
  return cell(
    '32px 24px 0',
    `<p style="margin:0 0 10px;font-size:11px;line-height:18px;letter-spacing:1.6px;color:${ACCENT_DEEP};font-weight:700;">${escapeHtml(item.label)}</p>` +
      `<h2 style="margin:0;font-size:23px;line-height:30px;letter-spacing:-.5px;font-weight:700;color:${INK};">${escapeHtml(item.title)}</h2>` +
      `<p style="margin:10px 0 0;font-size:16px;line-height:26px;color:${MUTED};">${escapeHtml(item.body)}</p>` +
      picture,
  )
}

/**
 * Build the issue.
 *
 * `resolveImage` turns an issue's site-root path into the address the reader's client
 * loads. Sending hands back an absolute HTTPS URL; the local preview hands back a data URI
 * so the page is readable before the site carries the image.
 */
export function renderIssue(issue, { unsubscribeUrl, siteUrl = SITE_URL, resolveImage } = {}) {
  const image = resolveImage ?? ((src) => (isAbsolute(src) ? src : `${siteUrl}${src}`))
  const logo = image('/newsletter/logo.png')
  const rows = []

  rows.push(
    cell(
      '32px 24px 24px',
      `<a href="${escapeHtml(siteUrl)}" style="text-decoration:none;"><img src="${escapeHtml(logo)}" alt="AI4Kanban" width="150" height="35" style="display:block;border:0;width:150px;height:auto;margin:0;"></a>`,
    ),
  )
  rows.push(hairline())
  rows.push(
    cell(
      '32px 24px 28px',
      `<p style="margin:0 0 16px;font-size:11px;line-height:18px;letter-spacing:1.7px;color:${ACCENT_DEEP};font-weight:700;">${escapeHtml(issue.eyebrow)}</p>` +
        `<h1 style="margin:0;font-size:40px;line-height:44px;letter-spacing:-1.7px;font-weight:750;color:${INK};">${escapeHtml(issue.headline)}</h1>` +
        `<p style="margin:10px 0 0;font-size:16px;line-height:26px;color:${MUTED};">${escapeHtml(issue.intro)}</p>`,
    ),
  )

  if (issue.hero) {
    rows.push(
      cell(
        '0 24px',
        `<img src="${escapeHtml(image(issue.hero.src))}" width="552" alt="${escapeHtml(issue.hero.alt)}" style="display:block;width:100%;max-width:552px;height:auto;border:0;">`,
      ),
    )
  }

  for (const item of issue.highlights) rows.push(highlight(item, image))

  const notes = issue.releaseNotes
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:22px;"><a href="${escapeHtml(issue.releaseNotes.href)}" style="color:${MUTED};">${escapeHtml(issue.releaseNotes.label)}</a></p>`
    : ''
  rows.push(
    cell(
      '32px 24px',
      `<a href="${escapeHtml(issue.cta.href)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:6px;">${escapeHtml(issue.cta.label)} &nbsp; &#8599;</a>${notes}`,
    ),
  )

  rows.push(hairline())
  rows.push(
    `<tr><td align="center" style="padding:24px 24px 40px;text-align:center;">` +
      `<a href="${escapeHtml(siteUrl)}" style="text-decoration:none;"><img src="${escapeHtml(logo)}" alt="AI4Kanban" width="110" height="26" style="display:block;border:0;width:110px;height:auto;margin:0 auto;"></a>` +
      `<p style="margin:14px 0 16px;font-size:13px;line-height:1.5;color:${QUIET};"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${QUIET};text-decoration:underline;">Unsubscribe</a></p>` +
      `<p style="margin:0;font-size:11px;line-height:1.5;color:${QUIET};">${escapeHtml(POSTAL_ADDRESS)}</p>` +
      `</td></tr>`,
  )

  // Kept off screen but inside the body: this is the line the inbox list shows beside the
  // subject, and without it the client picks the first words it finds — the alt text on
  // the logo.
  const preheader =
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(issue.preheader)}</div>` +
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`

  const html =
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `<title>${escapeHtml(issue.subject)}</title></head>\n` +
    `<body style="margin:0;padding:0;background:#fff;color:${INK};font-family:${SANS};">\n` +
    preheader +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;">` +
    row(
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;margin:0 auto;text-align:left;">${rows.join('')}</table>`,
    ) +
    `</table>\n</body></html>\n`

  return { subject: issue.subject, html, text: renderText(issue, { unsubscribeUrl, siteUrl }) }
}

/** The plain-text alternative. Same words, same order — a reader on a text-only client
 *  gets the whole issue, not an apology. */
export function renderText(issue, { unsubscribeUrl, siteUrl = SITE_URL } = {}) {
  const lines = [issue.eyebrow, '', issue.headline, '', issue.intro, '']
  if (issue.hero) lines.push(`[${issue.hero.alt}]`, '')
  for (const item of issue.highlights) {
    lines.push(`${item.label} — ${item.title}`, item.body)
    if (item.image) lines.push(`[${item.image.alt}]`)
    lines.push('')
  }
  lines.push(`${issue.cta.label}: ${issue.cta.href}`)
  if (issue.releaseNotes) lines.push(`${issue.releaseNotes.label}: ${issue.releaseNotes.href}`)
  lines.push('', '—', siteUrl, `Unsubscribe: ${unsubscribeUrl}`, POSTAL_ADDRESS, '')
  return lines.join('\n')
}

/** What a client with images turned off shows: the pictures gone, the words untouched. The
 *  template itself never sends this — it is the preview that proves the issue survives
 *  without its pictures. */
export function withoutImages(html) {
  return html.replace(/<img\b[^>]*>/gi, '')
}
