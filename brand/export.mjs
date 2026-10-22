// Renders brand/'s PNGs and favicon.ico from its SVGs. Rerun after changing an SVG:
//   node brand/export.mjs
// sharp comes from web/ — run `npm install` there first.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const dir = path.dirname(new URL(import.meta.url).pathname);
const sharp = createRequire(path.join(dir, "../web/package.json"))("sharp");
const svg = (name) => fs.readFileSync(path.join(dir, name));

// The SVG drawn at 4× the box, then scaled down into it with `pad` px of room each side.
async function render(file, width, height, { pad = 0, bg } = {}) {
  const [, , w, h] = svg(file).toString().match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const art = await sharp(svg(file), { density: 72 * 4 * Math.min(width / w, height / h) })
    .resize(width - 2 * pad, height - 2 * pad, { fit: "contain", background: "#0000" })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 4, background: bg ?? "#0000" } })
    .composite([{ input: art }])
    .png()
    .toBuffer();
}

// A PNG-compressed .ico: a header, one 16-byte entry per size, then the PNGs.
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(size % 256, at);
    head.writeUInt8(size % 256, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const out = {
  "favicon-96x96.png": () => render("favicon.svg", 96, 96),
  // iOS fills a transparent home-screen icon with black, which would hide the ink crane.
  "apple-touch-icon.png": () => render("crane-glyph.svg", 180, 180, { pad: 20, bg: "#ffffff" }),
  "web-app-manifest-192x192.png": () => render("crane-glyph.svg", 192, 192, { pad: 8 }),
  "web-app-manifest-512x512.png": () => render("crane-glyph.svg", 512, 512, { pad: 20 }),
  "desktop-icon.png": () => render("desktop-icon.svg", 1024, 1024),
  "newsletter-logo.png": () => render("logo.svg", 600, 142, { pad: 8 }),
  "favicon.ico": async () =>
    ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await render("favicon.svg", size, size) })))),
};

for (const [name, make] of Object.entries(out)) {
  fs.writeFileSync(path.join(dir, name), await make());
  console.log(name);
}
