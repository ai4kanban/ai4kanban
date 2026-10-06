import { getAllPosts, postPath } from "@/lib/blog";
import { BASE_URL } from "@/lib/site";

// Required for `output: export` — emit the feed at build time.
export const dynamic = "force-static";

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function GET() {
  const items = getAllPosts()
    .map((p) => {
      const url = `${BASE_URL}${postPath(p)}`;
      return `    <item>
      <title>${escape(p.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${escape(p.excerpt)}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI4Kanban Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Notes on planning and shipping software with coding agents, from the team behind AI4Kanban.</description>
    <language>en</language>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
