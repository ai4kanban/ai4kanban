#!/usr/bin/env node
// Build the pictures ShotSessions.tsx draws the agent office from, out of the
// board's own art in kanban-ui/public/run-scene/:
//
//   office.webp          the room as one still — panes transparent, the eight
//                        desks (six awake, matching the shot's cast), the clock
//                        face without its hands.
//   bots.webp            one row of nine frames per costume: four typing, four
//                        walking, then the seated one the sofa uses.
//   window-<period>.webp the city through the glass, cropped to the panes.
//   clouds-<period>.webp the band of sky drifting over it.
//
//   node scripts/build-office-art.mjs
//
// Composited in headless Chrome at world scale, then encoded with cwebp
// (`brew install webp`). Rerun when the board's art moves; the output is
// committed under web/public/run-scene/.

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ART = new URL("../../kanban-ui/public/run-scene/", import.meta.url).pathname;
const OUT = new URL("../public/run-scene/", import.meta.url).pathname;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Who works at each awake desk, and who rests on the sofa — the same seats as
 *  `CAST` in ShotSessions.tsx. */
const DESKS = ["builder", "builder", "ui-designer", "builder", "software-planner", "copywriting"];
/** The still's sofa, then the homepage's loop: a copywriter on the left. */
const SOFA = ["builder", "illustrator", "copywriting"];
/** bots.webp's rows, in the order ShotSessions.tsx's `LOOKS` reads them. */
const LOOKS = [...new Set([...DESKS, ...SOFA])];

/** One 48px cast frame drawn at 6x, nearest-neighbour. */
const CELL = 288;
const SCALE = CELL / 48;

/** Each row of bots.webp, in ShotSessions.tsx's frame order. */
const POSES = ["type-0", "type-1", "type-2", "type-3", "walk-0", "walk-1", "walk-2", "walk-3", "sit-0"];
const FRAMES = POSES.length;

const PERIODS = ["dawn", "day", "dusk", "night"];
/** `SCENERY` in kanban-ui/lib/run-scene.ts is 394×197; both windows' glass lies in
 *  this part of it (layers/layout.json), so nothing outside is shipped. */
const GLASS = { x: 20, y: 24, w: 354, h: 133 };
/** World pixels to one shipped window pixel: enough for a 2x screen at the
 *  homepage's width. */
const GLASS_SCALE = 2;

const cast = JSON.parse(await readFile(join(ART, "cast.json"), "utf8"));
const frame = (name) => cast.frames[name].frame;
const SHEET = `background-image:url(cast.png);background-size:${cast.meta.size.w * SCALE}px ${cast.meta.size.h * SCALE}px`;

/** `DESK_SCREEN` in kanban-ui/lib/run-scene.ts, from a desk's corner. */
const SCREEN = { x: 105, y: 19, w: 76, h: 42 };
const shows = DESKS.flatMap((look, i) => {
  const kind = cast.meta.screens[look];
  return kind ? [{ i, ...frame(`screen/${kind}-0`) }] : [];
});

const OFFICE = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  #w{position:relative;width:1536px;height:1024px;overflow:hidden}
  #w *{image-rendering:pixelated}
  #w img,#w div{position:absolute}
  .desk{width:284px;height:184px;background-repeat:no-repeat}
  .sleep{background-image:url(layers/desk-sleep.png);background-size:284px 184px}
  .work{background-image:url(layers/desk-work.png);background-size:1136px 184px}
  .show{width:${SCREEN.w}px;height:${SCREEN.h}px;background-image:url(cast.png)}
</style>
<div id="w">
  <img src="layers/office-base.png" style="left:0;top:0;width:1536px;height:1024px">
  <div id="desks"></div>
  <img src="layers/clock-face.png" style="left:732px;top:52px;width:72px;height:72px">
</div>
<script>
  const X=[203,523,838,1160], Y=[323,558], awake=${DESKS.length};
  const box=document.getElementById('desks');
  const at=Y.flatMap((y)=>X.map((x)=>({x,y})));
  at.forEach(({x,y},i)=>{
    const d=document.createElement('div');
    d.className='desk '+(i<awake?'work':'sleep');
    d.style.left=x+'px'; d.style.top=y+'px';
    box.append(d);
  });
  ${JSON.stringify(shows)}.forEach(({i,x,y})=>{
    const d=document.createElement('div');
    d.className='show';
    d.style.left=at[i].x+${SCREEN.x}+'px'; d.style.top=at[i].y+${SCREEN.y}+'px';
    d.style.backgroundPosition=(-x)+'px '+(-y)+'px';
    box.append(d);
  });
</script>`;

const BOTS = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  #s{position:relative;width:${FRAMES * CELL}px;height:${LOOKS.length * CELL}px}
  i{position:absolute;width:${CELL}px;height:${CELL}px;display:block;image-rendering:pixelated;${SHEET}}
</style>
<div id="s"></div>
<script>
  const s=document.getElementById('s');
  ${JSON.stringify(LOOKS.map((look) => POSES.map((name) => frame(`${look}/${name}`))))}
    .forEach((row,r)=>row.forEach(({x,y},c)=>{
      const e=document.createElement('i');
      e.style.left=c*${CELL}+'px'; e.style.top=r*${CELL}+'px';
      e.style.backgroundPosition=(-x*${SCALE})+'px '+(-y*${SCALE})+'px';
      s.append(e);
    }));
</script>`;

const work = join(tmpdir(), "ai4kanban-office-art");
await mkdir(work, { recursive: true });
await mkdir(OUT, { recursive: true });

/** Screenshot one page at its own size. Chrome does not always exit on its own
 *  after `--screenshot`, so it is given its time and then stopped. */
async function shoot(name, html, width, height, transparent) {
  const page = join(ART, `_${name}.html`);
  const shot = join(work, `${name}.png`);
  await writeFile(page, html);
  await rm(shot, { force: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      ...(transparent ? ["--default-background-color=00000000"] : []),
      `--window-size=${width},${height}`,
      `--screenshot=${shot}`,
      `--user-data-dir=${join(work, `profile-${name}`)}`,
      `file://${page}`,
    ],
    { stdio: "ignore" },
  );
  await new Promise((r) => setTimeout(r, 20000));
  chrome.kill();
  await rm(page, { force: true });
  return shot;
}

function encode(png, out, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("cwebp", [...args, "-m", "6", png, "-o", out], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`cwebp exited ${code}`))));
  });
}

// The room is lossy at a quality that holds every pixel edge at 3x, its panes'
// alpha lossless; the bots are flat pixel blocks, which lossless packs smallest.
const [room, bots] = await Promise.all([
  shoot("still", OFFICE, 1536, 1024, true),
  shoot("bots", BOTS, FRAMES * CELL, LOOKS.length * CELL, true),
]);
await encode(room, join(OUT, "office.webp"), ["-q", "88", "-alpha_q", "100"]);
await encode(bots, join(OUT, "bots.webp"), ["-lossless", "-z", "9"]);

// The window art is 1774×887 for a 394×197 box; crop in its own pixels.
const WINDOW_SCALE = 1774 / 394;
const crop = [GLASS.x, GLASS.y, GLASS.w, GLASS.h].map((v) => String(Math.round(v * WINDOW_SCALE)));
for (const p of PERIODS) {
  await encode(join(ART, `layers/window-${p}.png`), join(OUT, `window-${p}.webp`), [
    "-q", "80", "-crop", ...crop, "-resize", String(GLASS.w * GLASS_SCALE), String(GLASS.h * GLASS_SCALE),
  ]);
  await encode(join(ART, `layers/clouds-${p}.png`), join(OUT, `clouds-${p}.webp`), ["-q", "85", "-alpha_q", "100"]);
}

console.log(`wrote office, bots, window-* and clouds-* under ${OUT}`);
