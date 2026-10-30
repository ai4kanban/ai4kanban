/** The email a guest gets when invited to review a task (#2055), in the inviter's language. */

import type { Message } from '../mail.ts'

export type Lang = 'zh' | 'en'

export interface Invite {
  inviter: string
  title: string
  expires_at: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const until = (at: string, lang: Lang) => {
  const d = new Date(at)
  return lang === 'zh'
    ? `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const COPY = {
  zh: {
    preview: '打开链接查看，评论、确认或打回。',
    heading: (who: string, title: string) => `${who} 邀请你审核「${title}」`,
    body: (email: string) => `用 ${email} 登录后，可以查看内容、评论，并确认或打回。`,
    button: '打开审核',
    footer: (date: string, who: string) => `链接 ${date}前有效。如果你不认识 ${who}，忽略这封邮件即可。`,
  },
  en: {
    preview: 'Open the link to view, comment, approve or send back.',
    heading: (who: string, title: string) => `${who} invited you to review "${title}"`,
    body: (email: string) => `Sign in with ${email} to view it, comment, and approve or send it back.`,
    button: 'Open review',
    footer: (date: string, who: string) => `The link works until ${date}. If you don't know ${who}, you can ignore this email.`,
  },
}

/** `site` is WildCrane Web, where the link opens; its logo is served from there too. */
export function guestInvite(to: string, invite: Invite, url: string, site: string, lang: Lang): Message {
  const t = COPY[lang]
  const heading = t.heading(invite.inviter, invite.title)
  const footer = t.footer(until(invite.expires_at, lang), invite.inviter)
  return {
    to,
    subject: heading,
    text: [lang === 'en' ? heading.toUpperCase() : heading, '', t.body(to), '', `${t.button} ${url}`, '', footer].join('\n'),
    html: [
      `<!doctype html><html dir="ltr" lang="${lang}"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head>`,
      '<body style="background:#f4f3ef;margin:0;padding:0">',
      `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${esc(t.preview)}</div>`,
      '<table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr>',
      '<td style="background:#f4f3ef;font-family:-apple-system,\'Segoe UI\',\'PingFang SC\',Helvetica,Arial,sans-serif;margin:0;padding:40px 16px">',
      '<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;width:100%"><tbody><tr><td>',
      `<img alt="WildCrane" height="30" width="128" src="${esc(site)}/email-logo.png" style="display:block;outline:none;border:none;text-decoration:none;margin:0 0 24px 4px"/>`,
      '<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;padding:36px 32px"><tbody><tr><td>',
      `<h1 style="color:#24231f;font-size:22px;line-height:30px;margin:0;font-weight:700">${esc(heading)}</h1>`,
      `<p style="font-size:15px;line-height:24px;color:#6b6a64;margin:8px 0 28px">${esc(t.body(to))}</p>`,
      `<a href="${esc(url)}" target="_blank" style="display:inline-block;text-decoration:none;background:#24231f;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;line-height:120%;padding:12px 22px">${esc(t.button)}</a>`,
      '</td></tr></tbody></table>',
      `<p style="font-size:13px;line-height:20px;color:#6b6a64;margin:20px 4px 0">${esc(footer)}</p>`,
      '</td></tr></tbody></table></td></tr></tbody></table></body></html>',
    ].join(''),
  }
}
