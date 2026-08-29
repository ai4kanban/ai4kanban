// The first thing you see when no project is open (#289).
//
// Before this, a launch with nothing remembered opened a native folder dialog
// over an empty screen — a file picker with no app behind it, which says
// nothing about what it is for. This is the app instead, in two columns: a
// full-height piece of artwork on the left, and on the right the one move there
// is — Open Folder — over the projects opened before.
//
// It is a page in the same window, not a second window: picking a project loads
// that board's URL over it, and the window the user arranged stays the window.
//
// The page is carried as a string and loaded as a `data:` URL rather than as a
// file on disk. `tsc` copies no HTML into out/, so a file would need a build
// step and a line in the packager's file list to reach a shipped app; this
// reaches it by being code. The preload script runs here exactly as it does on
// the board, so `window.ai4kanban` is the same bridge (../preload.ts).

import fs from "node:fs";
import { getCopy, type DesktopCopy } from "./copy";
import type { LanguageChoice } from "./rules";
import { bundledResource } from "./resources";

/** Everything the page can't ask for, because it is true before it loads. */
export interface LauncherOptions {
  /** macOS, where the window has no title bar of its own and the page has to
   *  leave a drag strip and room for the traffic lights. */
  mac: boolean;
  /** The language this machine reads in (#339) — what `<html lang>` carries, which
   *  entry the switcher marks, and which of the page's two languages it is written in
   *  (#336). */
  language: string;
  /** What the switcher offers, each written in its own name. Empty draws no
   *  switcher: a build whose bundled rules predate the setting cannot save a
   *  pick, and a control that cannot save is worse than no control. */
  languages: LanguageChoice[];
}

export function launcherUrl(options: LauncherOptions): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(page(options))}`;
}

/** A sentence the page finishes: written here, where the path isn't known yet, and put
 *  together in the browser around this mark. A private-use codepoint, so no path or folder
 *  name can be mistaken for it. */
const FILLS_IN = "\uE000";

/** A folder name is whoever made it's, and so is nothing here — but the page is
 *  built as a string, so everything put into one goes through this. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Languages the app doesn't speak yet. They sit on the menu, greyed and marked
 *  Soon, so "is mine coming?" is answered where it is asked rather than nowhere.
 *  A row here is a promise — nothing goes on the list that isn't being written. */
const SOON: LanguageChoice[] = [
  { code: "fr", name: "Français", tag: "fr" },
  { code: "es", name: "Español", tag: "es" },
  { code: "ja", name: "日本語", tag: "ja" },
];

/** The switcher, top right: the language in force on a button, and the rest on a
 *  menu under it. A row of chips was the whole list on screen at once, which
 *  stops working the moment the list is longer than the two that work — so the
 *  closed control says one thing and the open one says everything.
 *
 *  Nothing at all when there is nothing that could save a pick. */
function switcher(language: string, languages: LanguageChoice[], c: DesktopCopy["launcher"]): string {
  if (languages.length < 2) return "";
  const now = languages.find((l) => l.code === language) ?? { code: language, name: language, tag: language };
  const rows = languages
    .map((l) => {
      const current = l.code === language;
      return `<button type="button" class="lang" role="menuitemradio" aria-checked="${current}" lang="${escapeHtml(l.tag)}" data-lang="${escapeHtml(l.code)}">${escapeHtml(l.name)}${current ? CHECK_ICON : ""}</button>`;
    })
    .join("");
  const soon = SOON.map(
    (l) =>
      `<div class="lang soon" aria-disabled="true" lang="${escapeHtml(l.tag)}">${escapeHtml(l.name)}<span class="tag">${escapeHtml(c.soon)}</span></div>`,
  ).join("");
  return `<div class="langs">
  <details id="langs">
    <summary class="current" title="${escapeHtml(c.language)}">${GLOBE_ICON}<span lang="${escapeHtml(now.tag)}">${escapeHtml(now.name)}</span>${CHEVRON_ICON}</summary>
    <div class="menu" role="menu">${rows}<div class="rule"></div>${soon}</div>
  </details>
</div>`;
}

/** The artwork down the left, as a tag ready to drop in the page.
 *
 *  A PNG at `resources/art/launcher.png` is the picture; it is read here and
 *  inlined, because a `data:` page can't load a file off the disk. Drop a new
 *  one in and the next launch shows it — nothing else to change. Without one,
 *  the panel below is drawn instead, so the app never opens onto a hole. */
function artwork(): string {
  const file = bundledResource("art", "launcher.png");
  try {
    const png = fs.readFileSync(file).toString("base64");
    return `<img class="art-img" src="data:image/png;base64,${png}" alt="">`;
  } catch {
    return DRAWN_ART;
  }
}

// The board's own colours and shapes (kanban-ui/app/globals.css): cream canvas,
// ink outlines, one ember accent, a hard offset shadow that presses down. This
// screen is the app's front door, so it has to be the same object as the board
// behind it.
function page({ mac, language, languages }: LauncherOptions): string {
  const c = getCopy(language).launcher;
  const tag = languages.find((l) => l.code === language)?.tag ?? "en";
  return `<!doctype html>
<html lang="${escapeHtml(tag)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>AI4Kanban</title>
<style>
  :root {
    --ink: #24231f;
    --ink-soft: #565550;
    --cream: #f7f7f4;
    --paper: #ffffff;
    --accent: #dd4f1e;
    --accent-soft: #f7ddce;
    --accent-deep: #b83a12;
    --mint-ink: #2f6b46;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    background: var(--cream);
    color: var(--ink);
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    cursor: default;
    user-select: none;
  }
  /* The top strip is the window's title bar on macOS: nothing is drawn there,
     and dragging it moves the window. */
  .titlebar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 43px;
    -webkit-app-region: ${mac ? "drag" : "no-drag"};
  }

  /* The picture: full height, edge to edge, cropped rather than squashed
     whatever shape the window is pulled into. */
  .art {
    position: relative;
    flex: 0 0 38%;
    min-width: 260px;
    max-width: 460px;
    overflow: hidden;
    background: var(--ink);
    border-right: 1.5px solid var(--ink);
  }
  .art-img, .art svg { display: block; width: 100%; height: 100%; object-fit: cover; }
  /* A window dragged narrow is all board and no gallery. */
  @media (max-width: 760px) { .art { display: none; } }

  /* The picture breathes. Only the drawn one — a PNG dropped in is whatever it
     is — and only opacity and transform, so the compositor carries it and no
     frame is repainted: an app sitting on its front door should not be warm.
     Every cycle is slow enough to be noticed rather than watched; the eye
     belongs on Open Folder. */
  .halo { animation: glow 11s ease-in-out infinite; }
  /* The sun rises. A hair of it over eleven seconds — enough that a window left
     open is not the same picture it was, and not enough to watch. */
  .sun { transform-box: view-box; transform-origin: 240px 300px; animation: rise 11s ease-in-out infinite; }
  /* The sun coming apart on the water: each glint widens and fades on its own
     count, so the light never repeats as a block. Four counts, dealt round, is
     what keeps them from breathing together. */
  .reflection ellipse { transform-box: fill-box; transform-origin: center; animation: ripple 6s ease-in-out infinite; }
  .reflection ellipse:nth-child(4n + 2) { animation-duration: 7.5s; animation-delay: -1.2s; }
  .reflection ellipse:nth-child(4n + 3) { animation-duration: 5.5s; animation-delay: -2.6s; }
  .reflection ellipse:nth-child(4n) { animation-duration: 8.5s; animation-delay: -3.4s; }
  /* The swell runs, alternate lines the other way, over half a minute — a tide,
     not a current. */
  .swell ellipse { animation: drift-out 34s ease-in-out infinite; }
  .swell ellipse:nth-child(even) { animation: drift-in 46s ease-in-out infinite; }
  .beacon { animation: blink 5s ease-in-out infinite; }
  @keyframes glow { 50% { opacity: 0.8; } }
  @keyframes rise { 50% { transform: translateY(-4px) scale(1.01); } }
  @keyframes ripple { 50% { transform: scaleX(1.09); opacity: 0.72; } }
  @keyframes drift-out { 50% { transform: translateX(-18px); } }
  @keyframes drift-in { 50% { transform: translateX(14px); } }
  @keyframes blink { 50% { opacity: 0.3; } }
  /* A reader who has asked for stillness gets the drawing, held. */
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }

  main {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 0;
    padding: 56px 44px 44px;
  }
  /* The column is centred, and so is everything in it — the list is the one
     thing that keeps its own left edge, because a path is read from the start. */
  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 340px;
  }

  .lockup { display: flex; align-items: center; gap: 13px; }
  h1 { margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.015em; }

  .open {
    -webkit-app-region: no-drag;
    margin-top: 30px;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 12px 22px;
    border: 1.5px solid var(--ink);
    border-radius: 12px;
    background: var(--accent);
    box-shadow: 3px 3px 0 0 var(--ink);
    color: var(--paper);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }
  .open:hover { background: var(--accent-deep); }
  .open:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--ink); }
  .open:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

  /* The projects you have opened before. Absent on a first launch, which is
     the launch this screen was drawn for. */
  .recent { align-self: stretch; margin-top: 46px; }
  .recent[hidden] { display: none; }
  /* The label rides on a rule rather than floating under the button: without
     the line the two read as one stack, and the eye can't tell where the offer
     ends and the history begins. */
  .recent h2 {
    position: relative;
    margin: 0 0 12px;
    text-align: center;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .recent h2::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: color-mix(in srgb, var(--ink) 15%, transparent);
  }
  .recent h2 span { position: relative; padding: 0 10px; background: var(--cream); }
  .rows { max-height: 34vh; overflow-y: auto; margin: 0 -10px; padding: 0; list-style: none; }
  .item { position: relative; }
  .row {
    -webkit-app-region: no-drag;
    display: block;
    width: 100%;
    padding: 7px 32px 7px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .row:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
  /* A folder that has gone stays on the list — it is how you find the line and
     take it off — but it is dimmed, does nothing, and keeps its ✕ on show. */
  .row[data-missing] { opacity: 0.42; cursor: default; }
  .row[data-missing]:hover { background: transparent; }
  .name { font-size: 13.5px; font-weight: 700; }
  .path {
    display: block;
    margin-top: 1px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    color: var(--ink-soft);
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
  }
  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    border-radius: 50%;
    background: var(--mint-ink);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 50% { opacity: 0.35; } }
  .forget {
    -webkit-app-region: no-drag;
    position: absolute;
    top: 50%;
    right: 4px;
    transform: translateY(-50%);
    padding: 4px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--ink-soft);
    line-height: 0;
    opacity: 0;
    cursor: pointer;
  }
  .item:hover .forget, .forget:focus-visible, .item.gone .forget { opacity: 1; }
  .forget:hover { color: var(--ink); }

  /* The language switcher (#339). Framed like window chrome in the corner rather
     than set under the column: this is the one screen with no header to reach
     Configuration from, so a guess the app got wrong has to be one click to undo
     on the way in. Below the drag strip, and small enough that Open Folder stays
     the one thing the page leads with. */
  .langs {
    -webkit-app-region: no-drag;
    position: fixed;
    top: 55px;
    right: 28px;
  }
  .langs details { position: relative; }
  .current {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 9px;
    border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    border-radius: 10px;
    background: var(--paper);
    color: var(--ink-soft);
    font-size: 11.5px;
    font-weight: 700;
    list-style: none;
    cursor: pointer;
  }
  .current::-webkit-details-marker { display: none; }
  .current:hover, details[open] .current { color: var(--ink); }
  details[open] .chev { transform: rotate(180deg); }
  .current:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

  /* The menu is a block the way everything else here is: ink outline, hard
     shadow, the same 12px corner as the button it drops from. */
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 176px;
    padding: 4px;
    border: 1.5px solid var(--ink);
    border-radius: 12px;
    background: var(--paper);
    box-shadow: 3px 3px 0 0 var(--ink);
  }
  .lang {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 6px 9px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .lang:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .lang[aria-checked="true"] { background: var(--accent-soft); color: var(--accent-deep); cursor: default; }
  .lang:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
  .rule { margin: 4px 9px; border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); }
  /* Written but not shipped yet: on the list so the question is answered, dimmed
     and inert so it is never mistaken for a pick. */
  .lang.soon { color: var(--ink-soft); cursor: default; }
  .lang.soon:hover { background: transparent; }
  .tag {
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
</head>
<body>
<div class="titlebar"></div>
${switcher(language, languages, c)}
<aside class="art">${artwork()}</aside>
<main>
  <div class="inner">
    <div class="lockup">${MARK}<h1>AI4Kanban</h1></div>
    <button type="button" class="open" id="open" autofocus>${FOLDER_ICON} ${escapeHtml(c.openFolder)}</button>
    <section class="recent" id="recent" hidden>
      <h2><span>${escapeHtml(c.recent)}</span></h2>
      <ul class="rows" id="rows"></ul>
    </section>
  </div>
</main>
<script>
${script(c)}
</script>
</body>
</html>`;
}

// The app's own mark (web/public/logo-mark.svg), inline so the page needs
// nothing off disk.
const MARK = `<svg width="34" height="34" viewBox="0 0 78 78" role="img" aria-label="AI4Kanban">
      <rect x="10" y="10" width="68" height="68" rx="17" fill="#24231f"/>
      <rect x="5" y="5" width="68" height="68" rx="17" fill="#b83a12"/>
      <rect x="2" y="2" width="64" height="64" rx="15" fill="#dd4f1e" stroke="#24231f" stroke-width="4"/>
      <g transform="translate(12.9 12.9) scale(0.703)" fill="#ffffff">
        <rect x="5" y="8" width="12" height="44" rx="3.5"/>
        <rect x="24" y="8" width="12" height="35" rx="3.5"/>
        <rect x="43" y="8" width="12" height="26" rx="3.5"/>
      </g>
    </svg>`;

const FOLDER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

const CLOSE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

// The switcher's own three marks: what the control is, that it opens, and which
// row is in force.
const GLOBE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg>`;

const CHEVRON_ICON = `<svg class="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>`;

// The panel that stands in for the picture until there is one.
//
// Sunrise over open water: the sun half out of the sea, cloud bands lying across
// it, and its light running down the water to the bottom of the frame. The board
// is already named an inch to the right, so this says the other half — the start
// of a working day. Geometry only, so it costs a paint and nothing else: no
// font, no file, nothing to load.
//
// ── What makes it read as a place ───────────────────────────────────────────
// Three things, and each of them was missing when this was a disc on a field:
//
// - The sun SITS ON the horizon, cut by it, rather than floating above a
//   waterline drawn somewhere else. Sun and sea meet at y=300, and that contact
//   is the whole picture; nothing may be laid between them.
// - Sky and sea are separate ramps. Two different gradients meeting on a line is
//   what a horizon is — one ramp behind everything reads as a wall.
// - The light on the water WIDENS as it comes toward you. A glitter path is a
//   perspective, so it opens out; drawn narrowing it becomes a triangle pointing
//   nowhere, which is what it was.
// - Nothing that lies flat has an end. Every band, glint and swell line is
//   filled with a gradient that fades to nothing at both edges, so the shapes
//   sit IN the water. Hard-ended strips at low opacity read as ruled lines over
//   the picture, and a screenful of them reads as dirt.
//
// Kept centred on purpose. The frame is cropped to cover (`slice`), so a window
// dragged narrow shows only the middle half of this width — anything that has to
// be seen lives between x=130 and x=350.
const DRAWN_ART = `<svg viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <!-- Night still at the top, warming all the way down to the water. -->
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300">
          <stop offset="0" stop-color="#13151f"/>
          <stop offset="0.4" stop-color="#2a1c22"/>
          <stop offset="0.72" stop-color="#5c2c1c"/>
          <stop offset="0.93" stop-color="#a03d1a"/>
          <stop offset="1" stop-color="#c4471b"/>
        </linearGradient>
        <!-- The sea takes the sky at its far edge and loses it within a few
             strokes: water off the light path is nearly black, which is what
             lets the path be the brightest thing under the horizon. -->
        <linearGradient id="sea" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="900">
          <stop offset="0" stop-color="#5c2814"/>
          <stop offset="0.05" stop-color="#2a170f"/>
          <stop offset="0.22" stop-color="#15120d"/>
          <stop offset="1" stop-color="#0b0a08"/>
        </linearGradient>
        <!-- Brightest where it meets the water, the way a sun coming up is. -->
        <radialGradient id="disc" gradientUnits="userSpaceOnUse" cx="240" cy="304" r="98">
          <stop offset="0" stop-color="#ffd0a0"/>
          <stop offset="0.4" stop-color="#f8802f"/>
          <stop offset="1" stop-color="#dd4f1e"/>
        </radialGradient>
        <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="240" cy="300" r="220">
          <stop offset="0" stop-color="#dd4f1e" stop-opacity="0.36"/>
          <stop offset="1" stop-color="#dd4f1e" stop-opacity="0"/>
        </radialGradient>
        <!-- The body of the light on the water. The bars below are the glitter on
             it; without something under them they are a stack of dashes. A glow
             squashed narrow rather than a drawn cone — a cone has two straight
             edges, and two straight edges on water is a searchlight. -->
        <radialGradient id="path" gradientUnits="userSpaceOnUse" cx="240" cy="300" r="340"
          gradientTransform="translate(240 300) scale(0.5 1) translate(-240 -300)">
          <stop offset="0" stop-color="#f8802f" stop-opacity="0.34"/>
          <stop offset="0.4" stop-color="#dd4f1e" stop-opacity="0.13"/>
          <stop offset="1" stop-color="#dd4f1e" stop-opacity="0"/>
        </radialGradient>
        <!-- Haze: the air the sun has to come up through, thickest on the water. -->
        <linearGradient id="haze" gradientUnits="userSpaceOnUse" x1="0" y1="232" x2="0" y2="300">
          <stop offset="0" stop-color="#f4762f" stop-opacity="0"/>
          <stop offset="1" stop-color="#f4762f" stop-opacity="0.32"/>
        </linearGradient>
        <!-- Nothing lying flat in this picture is allowed a visible end. Every
             band, glint and swell line is filled with one of these three, so it
             is full strength in the middle and gone before its edge: a shape
             that stops somewhere is a slat, and a field of slats is what makes
             water look like a barcode. Object-bounding-box units, so one
             gradient serves every length. -->
        <linearGradient id="glint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ffb787" stop-opacity="0"/>
          <stop offset="0.5" stop-color="#ffb787" stop-opacity="1"/>
          <stop offset="1" stop-color="#ffb787" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="foam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f7f7f4" stop-opacity="0"/>
          <stop offset="0.5" stop-color="#f7f7f4" stop-opacity="1"/>
          <stop offset="1" stop-color="#f7f7f4" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#171319" stop-opacity="0"/>
          <stop offset="0.42" stop-color="#171319" stop-opacity="1"/>
          <stop offset="0.62" stop-color="#171319" stop-opacity="1"/>
          <stop offset="1" stop-color="#171319" stop-opacity="0"/>
        </linearGradient>
        <!-- Everything above the water. The sun is cut by this and by nothing else. -->
        <clipPath id="sky-only"><rect width="480" height="300"/></clipPath>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>

      <rect width="480" height="300" fill="url(#sky)"/>
      <g fill="#f7f7f4">
        <circle cx="150" cy="64" r="2.2" fill-opacity="0.45"/>
        <circle cx="322" cy="42" r="1.8" fill-opacity="0.3"/>
        <circle cx="212" cy="108" r="1.5" fill-opacity="0.22"/>
        <circle cx="298" cy="146" r="1.4" fill-opacity="0.14"/>
      </g>

      <rect class="halo" width="480" height="900" fill="url(#halo)"/>

      <g clip-path="url(#sky-only)">
        <circle class="sun" cx="240" cy="300" r="90" fill="url(#disc)"/>
        <!-- Cloud bands, not slats: filled with the fading band, so each one is
             solid in the middle and dissolves before either end.
             The sun is the picture, so nothing dense is allowed on its face —
             every band's solid middle sits off the disc and only a faded tail
             passes in front of it. That still layers the sky, and the sun stays
             a whole disc rather than a stack of slices. They flank it: two
             high, two at its shoulders, one low on the water. The two at its
             shoulders carry a lit edge on the side facing the sun, which is
             what says a cloud has light behind it. -->
        <g fill="url(#band)">
          <ellipse cx="140" cy="166" rx="108" ry="3.5" fill-opacity="0.5"/>
          <ellipse cx="362" cy="198" rx="94" ry="4" fill-opacity="0.55"/>
          <ellipse cx="66" cy="243" rx="120" ry="6" fill-opacity="0.74"/>
          <ellipse cx="412" cy="262" rx="112" ry="5.5" fill-opacity="0.68"/>
          <ellipse cx="86" cy="288" rx="102" ry="4.5" fill-opacity="0.58"/>
        </g>
        <g fill="url(#glint)">
          <ellipse cx="66" cy="250" rx="112" ry="1.6" fill-opacity="0.32"/>
          <ellipse cx="412" cy="268.5" rx="104" ry="1.6" fill-opacity="0.28"/>
        </g>
        <rect y="232" width="480" height="68" fill="url(#haze)"/>
      </g>

      <rect y="300" width="480" height="600" fill="url(#sea)"/>
      <rect y="300" width="480" height="600" fill="url(#path)"/>
      <!-- The line the whole picture hangs on. Brightest where the sun stands in
           it and gone by either edge: a hairline carried the full width is a
           ruled line, and the sky and sea meet on their own without one. -->
      <rect y="299" width="480" height="1.6" fill="url(#glint)" fill-opacity="0.5"/>

      <!-- The sun on the water. Each glint is an ellipse filled with the fading
           streak, so it has no ends and no edges — the thing the eye reads is a
           patch of light, not a mark. They spread and dim as they come toward
           you, and none is centred or the length of its neighbour: a stack of
           centred bars is a ladder, and water has none. Near the horizon they
           are tight and bright; by the bottom of the frame there is little left
           but the glow behind them, which is where the light should end. -->
      <g class="reflection" fill="url(#glint)">
        <ellipse cx="240" cy="307" rx="24" ry="2" fill-opacity="0.72"/>
        <ellipse cx="225" cy="319" rx="37" ry="2.4" fill-opacity="0.55"/>
        <ellipse cx="288" cy="321" rx="13" ry="2" fill-opacity="0.3"/>
        <ellipse cx="213" cy="335" rx="50" ry="2.8" fill-opacity="0.44"/>
        <ellipse cx="234" cy="354" rx="61" ry="3.2" fill-opacity="0.34"/>
        <ellipse cx="308" cy="357" rx="17" ry="2.6" fill-opacity="0.22"/>
        <ellipse cx="237" cy="378" rx="78" ry="3.6" fill-opacity="0.26"/>
        <ellipse cx="203" cy="405" rx="64" ry="4" fill-opacity="0.19"/>
        <ellipse cx="311" cy="411" rx="33" ry="3.2" fill-opacity="0.15"/>
        <ellipse cx="240" cy="441" rx="98" ry="4.4" fill-opacity="0.14"/>
        <ellipse cx="191" cy="482" rx="76" ry="4.6" fill-opacity="0.1"/>
        <ellipse cx="322" cy="489" rx="50" ry="4" fill-opacity="0.085"/>
        <ellipse cx="240" cy="531" rx="128" ry="5" fill-opacity="0.075"/>
        <ellipse cx="177" cy="583" rx="88" ry="5.2" fill-opacity="0.045"/>
        <ellipse cx="344" cy="591" rx="58" ry="4.6" fill-opacity="0.036"/>
        <ellipse cx="240" cy="651" rx="120" ry="5.6" fill-opacity="0.026"/>
      </g>
      <!-- Swell: the gaps open up as the water comes toward you, which is the
           other half of the perspective the glints above are drawing. Held clear
           of both edges — a line that runs off the side of the frame is a rule
           laid over the picture rather than something floating in it. -->
      <g class="swell" fill="url(#foam)">
        <ellipse cx="352" cy="323" rx="66" ry="1.1" fill-opacity="0.09"/>
        <ellipse cx="114" cy="347" rx="62" ry="1.1" fill-opacity="0.075"/>
        <ellipse cx="384" cy="393" rx="82" ry="1.4" fill-opacity="0.062"/>
        <ellipse cx="68" cy="449" rx="74" ry="1.4" fill-opacity="0.05"/>
        <ellipse cx="386" cy="521" rx="94" ry="1.7" fill-opacity="0.038"/>
        <ellipse cx="82" cy="607" rx="86" ry="1.7" fill-opacity="0.028"/>
      </g>

      <!-- One green light out on the water, and its own thread of it underneath:
           the colour the board finishes in. -->
      <g class="beacon">
        <circle cx="344" cy="313" r="2.8" fill="#7fca9c" fill-opacity="0.9"/>
        <ellipse cx="344" cy="322" rx="1.6" ry="6" fill="#7fca9c" fill-opacity="0.2"/>
      </g>

      <!-- Print grain, so it reads as something pressed rather than plotted. -->
      <rect width="480" height="900" filter="url(#grain)" opacity="0.09" style="mix-blend-mode:overlay"/>
    </svg>`;

// The page's own behaviour. Every path out of here is the app's — picking a
// folder and opening a project both load a board over this page, so nothing
// here has to undraw itself. Rows are built as nodes rather than as markup: a
// folder is named by whoever made it, and a path is not something to paste into
// HTML.
function script(c: DesktopCopy["launcher"]): string {
  return `
  const app = window.ai4kanban;
  const FILLS_IN = ${JSON.stringify(FILLS_IN)};
  const PATH_GONE = ${JSON.stringify(c.pathGone(FILLS_IN))};
  document.getElementById("open").addEventListener("click", () => app?.pickRepo());

  // The switcher saves through the app rather than through a board server, which this
  // page has none of. The app draws this page again in whatever was saved, so a click
  // that lands shows the new language and one that could not save shows the old.
  const langs = document.getElementById("langs");
  for (const row of document.querySelectorAll(".lang[data-lang]")) {
    row.addEventListener("click", () => {
      if (langs) langs.open = false;
      if (row.getAttribute("aria-checked") !== "true") app?.setLanguage(row.dataset.lang);
    });
  }
  // A menu left open over the page is chrome nobody asked for: anywhere else, or
  // Escape, puts it away.
  if (langs) {
    document.addEventListener("click", (e) => {
      if (!langs.contains(e.target)) langs.open = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") langs.open = false;
    });
  }

  const recent = document.getElementById("recent");
  const rows = document.getElementById("rows");

  function draw(projects) {
    rows.replaceChildren();
    recent.hidden = !projects.length;
    for (const p of projects) rows.append(row(p));
  }

  function row(p) {
    const li = document.createElement("li");
    li.className = p.missing ? "item gone" : "item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "row";
    // Through a function, so a dollar sign in a folder's name is a character and not a
    // replacement pattern.
    button.title = p.missing ? PATH_GONE.replace(FILLS_IN, () => p.path) : p.path;
    if (p.missing) button.dataset.missing = "true";
    else button.addEventListener("click", () => app?.openProject(p.path));

    const name = document.createElement("span");
    name.className = "name";
    if (p.running && !p.missing) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.title = ${JSON.stringify(c.runningHere)};
      name.append(dot);
    }
    name.append(p.name);

    const path = document.createElement("span");
    path.className = "path";
    // Right-to-left so a long path keeps its end — the folder, not the root it
    // is under. The mark is what makes it read left-to-right again.
    path.textContent = "\\u202A" + p.path;

    const forget = document.createElement("button");
    forget.type = "button";
    forget.className = "forget";
    forget.title = p.missing ? ${JSON.stringify(c.forgetGone)} : ${JSON.stringify(c.forget)};
    forget.innerHTML = ${JSON.stringify(CLOSE_ICON)};
    forget.addEventListener("click", () => {
      app?.forgetProject(p.path).then(draw).catch(() => {});
    });

    button.append(name, path);
    li.append(button, forget);
    return li;
  }

  app?.projects().then(draw).catch(() => {});
`;
}
