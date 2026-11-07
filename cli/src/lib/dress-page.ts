// 网页样稿上传前的页面：审阅框架不按路径加载任何文件，样式表内联、加上内容安全策略。

import fs from 'node:fs'
import path from 'node:path'

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; " +
  "media-src data: blob:; font-src data: blob:; worker-src 'none'; base-uri 'none'; form-action 'none'"

export const head = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><meta charset="utf-8">` +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><style>html{overflow-x:hidden;overscroll-behavior:contain}</style>'

/** An `.html` mockup keeps its own markup; a stylesheet it links from its folder is inlined on
 *  the `<link>`'s line, its `url()`s rebased onto the page, since the review's frame loads nothing by path. */
export function dressPage(file: string): string {
  const folder = path.dirname(file)
  const html = fs.readFileSync(file, 'utf8').replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag) || !href || /^[a-z][\w+.-]*:|^\/\//i.test(href)) return tag
    const at = path.resolve(folder, href)
    if (!at.startsWith(folder + path.sep) || !fs.existsSync(at)) return tag
    const css = fs.readFileSync(at, 'utf8').replace(/url\(\s*(["']?)([^"')]+?)\1\s*\)/gi, (whole, quote: string, src: string) =>
      /^(?:[a-z][\w+.-]*:|\/|#)/i.test(src) ? whole : `url(${quote}${path.relative(folder, path.resolve(path.dirname(at), src)).split(path.sep).join('/')}${quote})`)
    return `<style>${css.replace(/\r?\n/g, ' ').replace(/<\/style/gi, '<\\/style')}</style>`
  })
  const at = /^\uFEFF?\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\b[^>]*>)?/i.exec(html)![0].length
  return /<!doctype\b|<html[\s>]|<head[\s>]/i.test(html) ? html.slice(0, at) + head + html.slice(at) : `<!doctype html><html><head>${head}</head><body>${html}</body></html>`
}

/** The text a file's references are read from: an `.html` page as it goes up. */
export const referenceText = (file: string): string => (/\.html$/i.test(file) ? dressPage(file) : fs.readFileSync(file, 'utf8'))
