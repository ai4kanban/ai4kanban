// A contract as the review page draws it: each piece as HTML, each `<Asset>` drawn.

import crypto from "node:crypto";
import { Marked } from "marked";
import { renderMermaidSVG } from "beautiful-mermaid";
import { countNotes, parseContract, slice } from "./contract.mjs";
import { renderAsset } from "./render.mjs";

const ASSET_LINE = /^\s*<Asset\b([^>]*?)\/?>\s*$/;
const ATTR = /(\w+)\s*=\s*"([^"]*)"/g;

const MERMAID = {
  bg: "var(--df-paper)",
  fg: "var(--df-ink)",
  accent: "var(--df-accent)",
  transparent: true,
  padding: 8,
};

function mermaid(code) {
  try {
    const svg = renderMermaidSVG(code, MERMAID);
    if (!svg.includes('class="node"')) return null;
    return svg.replace(/^\s*@import[^\n]*\n/m, "").replace(/^\s*text \{[^}]*\}\n/m, "");
  } catch {
    return null;
  }
}

const PEN =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function markdown() {
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      code({ text, lang }) {
        if (lang === "mermaid") {
          const svg = mermaid(text);
          if (svg) return `<div class="df-mermaid">${svg}</div>`;
        }
        return `<pre><code>${escape(text)}</code></pre>`;
      },
      blockquote({ tokens }) {
        const html = this.parser.parse(tokens);
        const note = /^<p>Note:\s*([\s\S]*)<\/p>\s*$/.exec(html.trim());
        return note ? `<div class="df-note">${PEN}<span>${note[1]}</span></div>` : `<blockquote>${html}</blockquote>`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ""} target="_blank" rel="noreferrer">${text}</a>`;
      },
    },
  });
  return md;
}

export async function contractModel(draftDir, slug, text) {
  const c = parseContract(text);
  const md = markdown();
  const assets = [];
  const problems = [];

  const html = (source) =>
    md.parse(
      source
        .split("\n")
        .map((line) => {
          const m = ASSET_LINE.exec(line);
          if (!m) return line;
          const attrs = Object.fromEntries([...m[1].matchAll(ATTR)].map(([, k, v]) => [k, v]));
          assets.push(attrs);
          return `<div class="df-asset" data-asset="${assets.length - 1}"></div>`;
        })
        .join("\n"),
    );

  const sections = c.sections.map((s) => ({
    id: s.id,
    title: s.title,
    leadHtml: html(slice(c, s.lead)),
    drafts: s.drafts.map((d) => {
      const body = d.heading === null ? slice(c, d) : slice(c, { start: d.start + 1, end: d.end });
      const first = /<Asset\b[^>]*\bsrc="([^"]*)"/.exec(body)?.[1];
      return { id: d.id, heading: d.heading, src: first?.split("/").pop() ?? null, html: html(body) };
    }),
  }));

  let agent = null;
  if (c.agent) {
    const items = new Set(c.agent.items.flatMap((it) => Array.from({ length: it.end - it.start }, (_, k) => it.start + k)));
    const rest = c.lines
      .slice(c.agent.start + 1)
      .filter((_, k) => !items.has(c.agent.start + 1 + k) && !/^## /.test(c.lines[c.agent.start + 1 + k]))
      .join("\n");
    agent = {
      items: c.agent.items.map((it) => ({
        id: it.id,
        html: html(slice(c, it).replace(/^[-*] /, "")),
      })),
      restHtml: html(rest.trim()),
    };
  }

  if (!c.title) problems.push("The contract has no `#` title.");
  if (!sections.length) problems.push("The contract has no `##` section — with no key part, build directly instead.");
  if (!c.agent) problems.push("The contract has no `<!-- agent -->` line.");

  const drawn = await Promise.all(assets.map((a) => renderAsset(draftDir, a)));
  for (const a of drawn) if (a.kind === "error") problems.push(`${a.src}: ${a.error}`);

  return {
    slug,
    file: `.draft-first/${slug}.md`,
    version: crypto.createHash("sha1").update(text).digest("hex"),
    status: c.status,
    title: c.title || slug,
    introHtml: html(slice(c, c.intro)),
    sections,
    agent,
    notes: countNotes(text),
    assets: drawn,
    problems,
  };
}
