// 卡片正文里的资源引用与文件类型；此模块不依赖 Node 或浏览器。
/** A file the card body names, with the types a JSON file there may be. */
export type Source = { src: string; types: string[] };
const STORYBOARD = ['storyboard'];
const WORKFLOW = ['workflow'];
const COMPARE = ['storyboard', 'compare'];
// Any other JSON stays a plain file.
const ASSET = ['spritesheet', 'asset'];
export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function bodyReferences(body: string): Source[] {
  const lines = body.replace(/<!--[^]*?-->/g, '').split(/\r?\n/);
  let fence = '';
  let inTag = false;
  const out: Source[] = [];
  const visible: string[] = [];
  for (const line of lines) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (delimiter && delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = '';
      visible.push(''); continue;
    }
    if (delimiter) { fence = delimiter; visible.push(''); continue; }
    const kept = inTag || !/^(?: {4}|\t)/.test(line);
    visible.push(kept ? line : '');
    if (kept && /^ {0,3}<(?:Asset|Mockup|Compare|Storyboard|Workflow)\b/.test(line)) inTag = true;
    if (line.includes('/>')) inTag = false;
  }
  const text = visible.join('\n').replace(/(`+)[^]*?\1/g, '');
  const tag = /<(Asset|Mockup|Compare|Storyboard|Workflow)\b([^<>]*?)\/>/g;
  const blocks = text.matchAll(/^ {0,3}(?:<(?:Asset|Mockup|Compare|Storyboard|Workflow)\b[^<>]*?\/>[ \t]*(?:\n[ \t]*)?)+$/gm);
  for (const block of blocks) {
    const tags = [...block[0].matchAll(tag)];
    for (const m of tags) {
      const a: Record<string, string> = {};
      for (const p of m[2]!.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[p[1]!] = (p[2] ?? p[3])!;
      if (m[1] === 'Compare') {
        if (!a.a || !a.b) continue;
        for (const k of ['a', 'b', 'shots']) if (a[k]) out.push({ src: a[k]!, types: COMPARE });
      } else if (a.src) {
        out.push({ src: a.src, types: m[1] === 'Storyboard' ? STORYBOARD : m[1] === 'Workflow' ? WORKFLOW : m[1] === 'Asset' ? ASSET : [] });
        if (a.variants) {
          try {
            const v: unknown = JSON.parse(a.variants);
            if (isObject(v)) for (const src of Object.values(v)) if (typeof src === 'string' && src) out.push({ src, types: m[1] === 'Asset' ? ASSET : [] });
          } catch { /* 无效 variants 沿用普通 src。 */ }
        }
      }
    }
  }
  for (const m of text.replace(tag, '').matchAll(/\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^]*?["'])?\s*\)/g)) out.push({ src: m[1]!, types: [] });
  return out;
}
export const bodySources = (body: string): string[] => [...new Set(bodyReferences(body).map(r => r.src))];

export const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
  '.html': 'text/html', '.md': 'text/markdown', '.mdx': 'text/markdown', '.mov': 'video/quicktime', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json', '.txt': 'text/plain',
  '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.css': 'text/css',
  '.tmx': 'application/xml', '.tmj': 'application/json', '.tsj': 'application/json',
};
export type Kind = 'html' | 'markdown' | 'image' | 'video' | 'asset' | 'storyboard' | 'compare' | 'workflow' | 'tiled' | 'spritesheet';
export function kindOf(ext: string): Kind {
  if (ext === '.tsx' || ext === '.html') return 'html';
  if (ext === '.md' || ext === '.mdx') return 'markdown';
  if (ext === '.tmx' || ext === '.tmj' || ext === '.tsj') return 'tiled';
  const type = TYPES[ext] ?? '';
  if (type.startsWith('image/')) return 'image';
  return type.startsWith('video/') || type.startsWith('audio/') ? 'video' : 'asset';
}
