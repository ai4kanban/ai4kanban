// The home page's pictures as WebP at the sizes they are drawn, beside their sources: the hero
// poster and the Board / Card deck from the CDN originals, and every JPEG the workflow previews
// show. The sources stay where they are; rerun when one changes.
//
//   node scripts/build-home-images.mjs
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const CDN = "https://cdn.ai4kanban.dev/home/";
const QUALITY = 80;

async function encode(input, out, width) {
  const img = sharp(input);
  await (width ? img.resize({ width }) : img).webp({ quality: QUALITY, effort: 6 }).toFile(join(PUBLIC, out));
  console.log(out);
}

const fetched = async (name) => Buffer.from(await (await fetch(CDN + name)).arrayBuffer());

await encode(await fetched("hero-demo-poster-v1.jpg"), "home/hero-demo-poster.webp");
for (const shot of ["board", "card"]) {
  const src = await fetched(`demo-${shot}-v1.jpg`);
  for (const width of [1200, 2400]) await encode(src, `home/demo-${shot}-${width}.webp`, width);
}

for (const entry of await readdir(join(PUBLIC, "home/drafts"), { recursive: true })) {
  if (entry.endsWith(".jpg")) await encode(join(PUBLIC, "home/drafts", entry), `home/drafts/${entry.replace(/\.jpg$/, ".webp")}`);
}
