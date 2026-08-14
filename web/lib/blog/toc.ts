import GithubSlugger from "github-slugger";

// "On this page", built by walking the post's Markdown for its H2s and H3s.
//
// The ids are generated with github-slugger, which is the same library
// `rehype-slug` uses to put `id`s on the rendered headings — including the
// `-1`, `-2` it appends to a repeated heading. Two different slug functions
// would agree until the day a post says "Why" twice, so there is only one.

export type TocItem = {
  id: string;
  text: string;
  depth: 2 | 3;
};

// Reduce a heading to the text rehype-slug will see: no emphasis markers, no
// code ticks, a link or an image down to its visible label.
function plainText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

export function extractToc(body: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  // A `#` inside a fenced block is a comment, not a heading.
  let fence = "";

  for (const line of body.split("\n")) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1][0];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker === fence) fence = "";
      continue;
    }
    if (fence) continue;

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;

    const text = plainText(heading[2]);
    if (!text) continue;
    items.push({ id: slugger.slug(text), text, depth: heading[1].length as 2 | 3 });
  }

  return items;
}
