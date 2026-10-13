// A `.md`/`.mdx` asset drawn as an article (#1651). Client-safe: the server reads the file,
// the page parses it.

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
