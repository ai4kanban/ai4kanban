// A `.md`/`.mdx` asset drawn as an article (#1651). Client-safe: the server finds the files,
// the page reads them.

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** One top-level `key: value` scalar off the header, quotes taken off. */
function scalar(head: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(head);
  const raw = m?.[1]?.trim();
  if (!raw) return undefined;
  const q = /^"((?:[^"\\]|\\.)*)"$/.exec(raw);
  if (q) return q[1]!.replace(/\\(.)/g, "$1");
  const s = /^'((?:[^']|'')*)'$/.exec(raw);
  if (s) return s[1]!.replace(/''/g, "'");
  return raw.replace(/\s+#.*$/, "");
}

/** Lines outside fenced blocks that MDX runs rather than shows. */
function dropMdxLines(body: string): string {
  let fence: string | null = null;
  return body
    .split("\n")
    .filter((line) => {
      const f = /^\s*(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (!fence) fence = f[1]!;
        else if (f[1]!.startsWith(fence)) fence = null;
        return true;
      }
      return fence !== null || !/^(?:import|export)\s/.test(line);
    })
    .join("\n");
}

/** The article a file holds: its header's title and dek, and the Markdown under the header. */
export function parseArticle(text: string, mdx: boolean): { title?: string; dek?: string; body: string } {
  const m = FRONTMATTER.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  return {
    title: m ? scalar(m[1]!, "title") : undefined,
    dek: m ? scalar(m[1]!, "dek") : undefined,
    body: mdx ? dropMdxLines(body) : body,
  };
}

/** A language as it names itself — `English`, `中文` — or `null` for a code that is none. */
export function languageName(code: string): string | null {
  try {
    const name = new Intl.DisplayNames([code], { type: "language", fallback: "none" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : null;
  } catch {
    return null;
  }
}

/** `copy.en.md` → `{ base: "copy", lang: "en", ext: "md" }`; a name with no language suffix
 *  has `lang: null`. */
export function articleName(fileName: string): { base: string; lang: string | null; ext: string } | null {
  const m = /^(.+?)(?:\.([a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*))?\.(mdx?)$/i.exec(fileName);
  if (!m) return null;
  const lang = m[2] && languageName(m[2].replace("_", "-")) ? m[2] : null;
  return lang ? { base: m[1]!, lang, ext: m[3]!.toLowerCase() } : { base: fileName.replace(/\.mdx?$/i, ""), lang: null, ext: m[3]!.toLowerCase() };
}
