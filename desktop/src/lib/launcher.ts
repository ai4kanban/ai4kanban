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
import type { LanguageChoice } from "./rules";
import { bundledResource } from "./resources";

/** Everything the page can't ask for, because it is true before it loads. */
export interface LauncherOptions {
  /** macOS, where the window has no title bar of its own and the page has to
   *  leave a drag strip and room for the traffic lights. */
  mac: boolean;
  /** The language this machine reads in (#339) — what `<html lang>` carries and
   *  which entry the switcher marks. The page's own words stay English until
   *  #336 translates them. */
  language: string;
  /** What the switcher offers, each written in its own name. Empty draws no
   *  switcher: a build whose bundled rules predate the setting cannot save a
   *  pick, and a control that cannot save is worse than no control. */
  languages: LanguageChoice[];
}

export function launcherUrl(options: LauncherOptions): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(page(options))}`;
}

/** A folder name is whoever made it's, and so is nothing here — but the page is
 *  built as a string, so everything put into one goes through this. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The switcher, top right: one chip per language, each in its own name, the one
 *  in force filled. Nothing at all when there is nothing that could save a pick. */
function switcher(language: string, languages: LanguageChoice[]): string {
  if (languages.length < 2) return "";
  const chips = languages
    .map((l) => {
      const current = l.code === language;
      return `<button type="button" class="lang" lang="${escapeHtml(l.tag)}" data-lang="${escapeHtml(l.code)}"${current ? ' aria-current="true"' : ""}>${escapeHtml(l.name)}</button>`;
    })
    .join("");
  return `<div class="langs">${chips}</div>`;
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
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    border-radius: 10px;
    background: var(--paper);
  }
  .lang {
    padding: 4px 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--ink-soft);
    font: inherit;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .lang:hover { color: var(--ink); }
  .lang[aria-current="true"] { background: var(--accent-soft); color: var(--accent-deep); cursor: default; }
  .lang:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
</style>
</head>
<body>
<div class="titlebar"></div>
${switcher(language, languages)}
<aside class="art">${artwork()}</aside>
<main>
  <div class="inner">
    <div class="lockup">${MARK}<h1>AI4Kanban</h1></div>
    <button type="button" class="open" id="open" autofocus>${FOLDER_ICON} Open Folder</button>
    <section class="recent" id="recent" hidden>
      <h2><span>Recent</span></h2>
      <ul class="rows" id="rows"></ul>
    </section>
  </div>
</main>
<script>
${SCRIPT}
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

// The panel that stands in for the picture until there is one.
//
// A poster, not a diagram: an ember sun going down over dark water, cut into
// slats that widen as they fall, its reflection breaking up on the surface. The
// board is already named an inch to the right, so this says the other half —
// the end of a working day. Geometry only, so it costs a paint and nothing
// else: no font, no file, nothing to load.
//
// The slats are filled with the ground itself (`userSpaceOnUse`, so every shape
// samples the same vertical ramp) rather than with a flat colour — that is what
// lets them cut the disc without leaving a seam anywhere off it.
const DRAWN_ART = `<svg viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ground" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900">
          <stop offset="0" stop-color="#2b2620"/>
          <stop offset="0.55" stop-color="#191710"/>
          <stop offset="1" stop-color="#100f0a"/>
        </linearGradient>
        <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="240" cy="340" r="330">
          <stop offset="0" stop-color="#dd4f1e" stop-opacity="0.3"/>
          <stop offset="1" stop-color="#dd4f1e" stop-opacity="0"/>
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="480" height="900" fill="url(#ground)"/>
      <rect width="480" height="900" fill="url(#halo)"/>

      <!-- The sun, and the slats that take it apart on the way down. -->
      <circle cx="240" cy="340" r="152" fill="#dd4f1e"/>
      <g fill="url(#ground)">
        <rect x="-10" y="392" width="500" height="5"/>
        <rect x="-10" y="412" width="500" height="7"/>
        <rect x="-10" y="437" width="500" height="9"/>
        <rect x="-10" y="466" width="500" height="12"/>
        <rect x="-10" y="500" width="500" height="16"/>
        <rect x="-10" y="540" width="500" height="21"/>
      </g>

      <!-- The waterline, the sun coming apart on it, and the swell running out
           to the bottom of the frame so the water is water and not a floor. -->
      <rect x="-10" y="596" width="500" height="1.5" fill="#f7f7f4" fill-opacity="0.28"/>
      <g fill="#dd4f1e">
        <rect x="130" y="614" width="220" height="7" fill-opacity="0.55"/>
        <rect x="155" y="640" width="170" height="6" fill-opacity="0.4"/>
        <rect x="180" y="668" width="120" height="5" fill-opacity="0.28"/>
        <rect x="203" y="698" width="74" height="4" fill-opacity="0.18"/>
        <rect x="221" y="730" width="38" height="3.5" fill-opacity="0.11"/>
      </g>
      <g fill="#f7f7f4">
        <rect x="24" y="626" width="86" height="2" fill-opacity="0.09"/>
        <rect x="372" y="654" width="120" height="2" fill-opacity="0.075"/>
        <rect x="-10" y="690" width="150" height="2.5" fill-opacity="0.06"/>
        <rect x="300" y="722" width="190" height="2.5" fill-opacity="0.05"/>
        <rect x="60" y="762" width="250" height="3" fill-opacity="0.04"/>
        <rect x="330" y="806" width="160" height="3" fill-opacity="0.03"/>
        <rect x="-10" y="852" width="230" height="3.5" fill-opacity="0.025"/>
      </g>
      <!-- One green light out on the water: the colour the board finishes in. -->
      <circle cx="356" cy="176" r="4" fill="#7fca9c" fill-opacity="0.85"/>
      <circle cx="96" cy="118" r="2.5" fill="#f7f7f4" fill-opacity="0.4"/>
      <circle cx="404" cy="98" r="2" fill="#f7f7f4" fill-opacity="0.25"/>

      <!-- Print grain, so it reads as something pressed rather than plotted. -->
      <rect width="480" height="900" filter="url(#grain)" opacity="0.09" style="mix-blend-mode:overlay"/>
    </svg>`;

// The page's own behaviour. Every path out of here is the app's — picking a
// folder and opening a project both load a board over this page, so nothing
// here has to undraw itself. Rows are built as nodes rather than as markup: a
// folder is named by whoever made it, and a path is not something to paste into
// HTML.
const SCRIPT = `
  const app = window.ai4kanban;
  document.getElementById("open").addEventListener("click", () => app?.pickRepo());

  // The switcher saves through the app rather than through a board server, which this
  // page has none of. The app draws this page again in whatever was saved, so a click
  // that lands shows the new language and one that could not save shows the old.
  for (const chip of document.querySelectorAll(".lang")) {
    chip.addEventListener("click", () => {
      if (chip.getAttribute("aria-current") !== "true") app?.setLanguage(chip.dataset.lang);
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
    button.title = p.missing ? p.path + " — the folder is gone" : p.path;
    if (p.missing) button.dataset.missing = "true";
    else button.addEventListener("click", () => app?.openProject(p.path));

    const name = document.createElement("span");
    name.className = "name";
    if (p.running && !p.missing) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.title = "A run is going here";
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
    forget.title = p.missing
      ? "The folder is gone — take it off the list"
      : "Take this project off the list — nothing on disk is touched";
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
