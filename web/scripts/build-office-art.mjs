#!/usr/bin/env node
// Build the two pictures ShotSessions.tsx draws the agent office from, out of
// the board's own art in kanban-ui/public/run-scene/:
//
//   office.webp  the room as one still — the view out of the windows, the room
//                over it, the eight desks (six awake, matching the shot's cast),
//                the clock at ten past ten.
//   bots.webp    one row of five 300px frames: the four typing ones, then the
//                seated one the sofa uses.
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
const SOFA = ["builder", "illustrator"];
/** bots.webp's rows, in the order ShotSessions.tsx's `LOOKS` reads them. */
const LOOKS = [...new Set([...DESKS, ...SOFA])];

/** One 48px cast frame drawn at 6x, nearest-neighbour. */
const CELL = 288;
const SCALE = CELL / 48;

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
  <img src="layers/window-day.png" style="left:264px;top:0;width:394px;height:197px">
  <img src="layers/window-day.png" style="left:879px;top:0;width:394px;height:197px">
  <img src="layers/office-base.png" style="left:0;top:0;width:1536px;height:1024px">
  <div id="desks"></div>
  <img src="layers/clock-face.png" style="left:732px;top:52px;width:72px;height:72px">
  <svg viewBox="0 0 72 72" style="position:absolute;left:732px;top:52px;width:72px;height:72px">
    <g transform="translate(36,36)">
      <g transform="rotate(305)"><rect x="-2.4" y="-16" width="4.8" height="19" rx="2" fill="#c8501d"/></g>
      <g transform="rotate(60)"><rect x="-1.8" y="-24" width="3.6" height="27" rx="1.8" fill="#c8501d"/></g>
      <circle r="2.6" fill="#3a3936"/>
    </g>
  </svg>
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
  #s{position:relative;width:${5 * CELL}px;height:${LOOKS.length * CELL}px}
  i{position:absolute;width:${CELL}px;height:${CELL}px;display:block;image-rendering:pixelated;${SHEET}}
</style>
<div id="s"></div>
<script>
  const s=document.getElementById('s');
  ${JSON.stringify(LOOKS.map((look) => [0, 1, 2, 3].map((n) => frame(`${look}/type-${n}`)).concat(frame(`${look}/sit-0`))))}
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

// The room is lossy at a quality that holds every pixel edge at 3x; the bots
// keep their alpha lossless, which is the only part a smear would show in.
const room = await shoot("still", OFFICE, 1536, 1024, false);
await encode(room, join(OUT, "office.webp"), ["-q", "88"]);
const bots = await shoot("bots", BOTS, 5 * CELL, LOOKS.length * CELL, true);
await encode(bots, join(OUT, "bots.webp"), ["-q", "92", "-alpha_q", "100"]);

console.log(`wrote ${OUT}office.webp and ${OUT}bots.webp`);
