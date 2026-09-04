// The first thing you see when no project is open (#289).
//
// Before this, a launch with nothing remembered opened a native folder dialog
// over an empty screen — a file picker with no app behind it, which says
// nothing about what it is for. This is the app instead, in two columns: a
// full-height piece of artwork on the left, and on the right the ways in, over
// the projects opened before.
//
// There are four of them (#317), and Local leads: Create Local board and Open Local board
// on the framed card, Create Cloud board and Open Cloud board beside it, labelled a hosted
// service and an invite-only preview. Nothing on the Cloud side is preselected — pricing
// and the open-source support policy do not exist yet, so a default install must not land
// on a service we pay to run. All four pick a project folder, because a Cloud board is
// still a folder on this machine; Cloud decides where the board is authoritative, not
// whether there is a folder.
//
// Taking the Cloud choice opens a panel over this same column: the GitHub sign-in, the
// preview being closed to an account with no invite, the workspace and the folder, and what
// going Cloud left in the repository. It is here rather than in Configuration because that
// dialog needs a board open before it draws, and a machine with no session has no board.
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

/** The count a plural sentence is asked for with, so the page can put the real number in
 *  afterwards. Nothing else in one of these sentences can be this — a translation is free to
 *  say "2" for its own reasons, and `.ai4kanban.json` says "4" in every language. */
const SENTINEL = 987654321;

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

/** The two ways in (#317). Local leads — its card is the framed one, and Create Local
 *  board is the button the eye lands on. Cloud sits beside it, said plainly for what it is:
 *  a hosted service, and an invite-only preview in this release. Neither side is
 *  preselected and neither button is pressed for anybody.
 *
 *  All four moves pick a project folder, because a Cloud board is still a folder on this
 *  machine — the checkout carries the committed pointer and the git-ignored copy the board's
 *  rules run over. */
function choices(c: DesktopCopy["launcher"]): string {
  return `<div class="choices">
      <section class="pick lead">
        <h3>${FOLDER_ICON}${escapeHtml(c.local.title)}</h3>
        <p>${escapeHtml(c.local.blurb)}</p>
        <div class="stack">
          <button type="button" class="btn lead" id="local-create">${escapeHtml(c.local.create)}</button>
          <button type="button" class="btn" id="local-open">${escapeHtml(c.local.open)}</button>
        </div>
      </section>
      <section class="pick aside">
        <h3>${CLOUD_ICON}${escapeHtml(c.cloud.title)}<span class="pill">${escapeHtml(c.cloud.preview)}</span></h3>
        <p>${escapeHtml(c.cloud.blurb)}</p>
        <div class="stack">
          <button type="button" class="btn quiet" id="cloud-create">${escapeHtml(c.cloud.create)}</button>
          <button type="button" class="btn quiet" id="cloud-open">${escapeHtml(c.cloud.open)}</button>
        </div>
        <p class="pages">${link("privacy", c.cloud.privacy)} · ${link("terms", c.cloud.terms)}</p>
      </section>
    </div>
    <p class="status" id="status" hidden></p>`;
}

/** An inline link the page answers itself. Every link here opens the user's own browser or
 *  moves this page, so none of them is an anchor. */
const link = (act: string, label: string): string =>
  `<button type="button" class="linkish" data-act="${act}">${escapeHtml(label)}</button>`;

/**
 * The Cloud path, drawn in this same window with no board behind it.
 *
 * Four steps, in the order somebody meets them: sign in, the preview being closed to this
 * account, the workspace and the folder, and what going Cloud left in the repository. Every
 * one of them is on the page from the start and hidden; the script shows one.
 */
function cloudPath(c: DesktopCopy["launcher"]): string {
  const cc = c.cloud;
  const head = `<div class="head">
        <button type="button" class="back" id="cloud-back" title="${escapeHtml(cc.back)}" aria-label="${escapeHtml(cc.back)}">${BACK_ICON}</button>
        ${MARK_SMALL}<h2>${escapeHtml(cc.title)}</h2><span class="pill">${escapeHtml(cc.preview)}</span>
      </div>`;
  return `<div class="inner panel" id="cloud" hidden>
      ${head}
      <p class="note bad" id="cloud-error" hidden></p>

      <section class="step" id="step-signin" hidden>
        <p class="lede">${escapeHtml(cc.signIn.boundary)}</p>
        <div class="stack" style="margin-top:20px;max-width:300px">
          <button type="button" class="btn lead" id="cloud-signin">${GITHUB_ICON}${escapeHtml(cc.signIn.button)}</button>
        </div>
        <p class="fine">${cc.signIn.confirms(link("privacy", cc.privacy), link("terms", cc.terms))}</p>
        <p class="rule">${cc.signIn.instead(link("local", c.local.create))}</p>
      </section>

      <section class="step" id="step-closed" hidden>
        <div class="note warn" style="margin-top:16px">
          <div>
            <strong>${escapeHtml(cc.closed.title)}</strong>
            <span>${escapeHtml(cc.closed.blurb)}</span>
          </div>
        </div>
        <p class="fine" id="cloud-asked" hidden></p>
        <div class="row" style="display:flex;gap:10px;margin-top:16px">
          <button type="button" class="btn lead small" id="cloud-invite">${escapeHtml(cc.closed.ask)}</button>
          <button type="button" class="btn quiet small" id="cloud-signout">${escapeHtml(cc.closed.signOut)}</button>
        </div>
        <p class="rule">${cc.closed.instead(link("local", c.local.create))}</p>
      </section>

      <section class="step" id="step-pick" hidden>
        <p class="caption">${escapeHtml(cc.pick.workspace)}</p>
        <div class="list" id="cloud-workspaces"></div>
        <div id="cloud-name-box" style="margin-top:10px;max-width:280px">
          <input type="text" class="field" id="cloud-name" placeholder="${escapeHtml(cc.pick.namePlaceholder)}" spellcheck="false">
        </div>
        <p class="caption">${escapeHtml(cc.pick.folder)}</p>
        <div class="card folder">
          ${FOLDER_ICON}
          <span class="where empty" id="cloud-folder">${escapeHtml(cc.pick.noFolder)}</span>
          <button type="button" class="btn quiet small" id="cloud-pick">${escapeHtml(cc.pick.choose)}</button>
        </div>
        <label class="check" id="cloud-import-box" hidden>
          <input type="checkbox" id="cloud-import" checked>
          <span id="cloud-import-label"><small>${escapeHtml(cc.pick.importBlurb)}</small></span>
        </label>
        <div class="stack" style="margin-top:16px;max-width:260px">
          <button type="button" class="btn lead" id="cloud-go" disabled></button>
        </div>
      </section>

      <section class="step" id="step-done" hidden>
        <p class="note good" id="cloud-ready" style="margin-top:16px"></p>
        <p class="lede" id="cloud-stale">${escapeHtml(cc.done.stale)}</p>
        <div class="card" id="cloud-offer" style="margin-top:12px">
          <h4>${escapeHtml(cc.done.offerTitle)}</h4>
          <p id="cloud-offer-blurb"></p>
          <p id="cloud-offer-safe">${escapeHtml(cc.done.offerSafe)}</p>
          <div class="row" id="cloud-offer-row">
            <button type="button" class="btn quiet small" id="cloud-commit">${escapeHtml(cc.done.commit)}</button>
            <button type="button" class="btn quiet small" id="cloud-keep">${escapeHtml(cc.done.keep)}</button>
          </div>
        </div>
        <div class="stack" style="margin-top:16px;max-width:220px">
          <button type="button" class="btn lead" id="cloud-open-board">${escapeHtml(cc.done.openBoard)}</button>
        </div>
      </section>
    </div>`;
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
    --mint-soft: #e4f3ea;
    --peach-ink: #8a4a28;
    --peach-soft: #fbe9dd;
    --sheet: #fbfaf7;
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
    max-width: 700px;
  }
  .inner[hidden] { display: none; }

  .lockup { display: flex; align-items: center; gap: 13px; }
  h1 { margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.015em; }

  /* Opening a project. Installing a board into a fresh folder and starting its
     server are seconds of work with this page still on screen, and a front door
     that answers nothing reads as a hang — so the page says what it is doing and
     stops taking clicks it would only queue up. */
  body.busy .inner { pointer-events: none; }
  body.busy .choices, body.busy .recent { opacity: 0.45; }
  .status {
    align-self: stretch;
    margin: 16px 0 0;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--accent-deep);
  }
  .status[hidden] { display: none; }

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

  /* --- the two ways in (#317) ----------------------------------------------
     Local leads and Cloud sits beside it: the framed card with the hard shadow
     is the one the eye lands on, and the Cloud card is a hairline on a paler
     sheet. Nothing on the Cloud side is preselected, and nothing is pressed for
     you. */
  .choices {
    -webkit-app-region: no-drag;
    display: flex;
    align-self: stretch;
    gap: 20px;
    margin-top: 30px;
    align-items: flex-start;
  }
  @media (max-width: 640px) { .choices { flex-direction: column; } }
  .pick {
    flex: 1;
    min-width: 0;
    padding: 18px;
    border-radius: 14px;
  }
  .pick.lead { border: 1.5px solid var(--ink); background: var(--paper); box-shadow: 3px 3px 0 0 var(--ink); }
  .pick.aside { border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); background: var(--sheet); }
  .pick h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0;
    font-size: 15px;
    font-weight: 800;
  }
  .pick p { margin: 7px 0 0; font-size: 12px; line-height: 1.5; color: var(--ink-soft); }
  .pick .stack { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
  .pill {
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
    background: var(--paper);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  /* One button family, three weights. */
  .btn {
    -webkit-app-region: no-drag;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px 16px;
    border-radius: 11px;
    border: 1.5px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn.lead { background: var(--accent); border-color: var(--ink); box-shadow: 3px 3px 0 0 var(--ink); color: var(--paper); }
  .btn.lead:hover { background: var(--accent-deep); }
  .btn.lead:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--ink); }
  .btn.quiet { border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent); }
  .btn.quiet:hover, .btn:not(.lead):hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
  .btn.small { width: auto; padding: 6px 12px; font-size: 12.5px; }
  .btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  .btn[disabled] { opacity: 0.5; cursor: default; }

  /* An inline link out of the page — the published pages, and the way back to
     the Local moves. Everything here is a button: this page has no navigation of
     its own, so a link either opens the browser or changes what is on screen. */
  .linkish {
    -webkit-app-region: no-drag;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-deep);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .pages { margin-top: 12px; font-size: 11px; color: var(--ink-soft); }

  /* --- the Cloud path, in this same window --------------------------------- */
  /* The panel is the column, not something centred in it: every row in it — the head, a
     caption, the workspace list — keeps the same left edge. */
  .panel { align-items: stretch; max-width: 590px; }
  .panel .head { display: flex; align-items: center; gap: 10px; }
  .panel .head h2 { margin: 0; font-size: 15px; font-weight: 800; }
  .back {
    -webkit-app-region: no-drag;
    display: inline-flex;
    padding: 4px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--ink-soft);
    line-height: 0;
    cursor: pointer;
  }
  .back:hover { color: var(--ink); }
  .panel .lede { margin: 16px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--ink-soft); }
  .panel .fine { margin: 14px 0 0; font-size: 11.5px; line-height: 1.6; color: var(--ink-soft); }
  .panel .rule { margin: 22px 0 0; padding-top: 16px; border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent); font-size: 12px; color: var(--ink-soft); }
  .step[hidden] { display: none; }
  .caption {
    margin: 16px 0 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .card {
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 10px;
    background: var(--paper);
  }
  .card h4 { margin: 0; font-size: 13px; font-weight: 700; }
  .card p { margin: 5px 0 0; font-size: 12px; line-height: 1.55; color: var(--ink-soft); }
  .card .row { display: flex; gap: 10px; margin-top: 11px; }
  .note { display: flex; gap: 9px; padding: 12px 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.6; }
  .note.warn { background: var(--peach-soft); color: var(--ink); }
  .note.warn strong { display: block; color: var(--peach-ink); }
  .note.good { background: var(--mint-soft); color: var(--mint-ink); font-weight: 700; }
  .note.bad { background: var(--peach-soft); color: var(--peach-ink); }
  .note[hidden] { display: none; }

  /* The workspace list: one row is one decision, and a new workspace is one of
     them rather than a second screen. */
  .list { border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); border-radius: 10px; background: var(--paper); padding: 0 12px; }
  .wsrow {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 0;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .wsrow:last-child { border-bottom: 0; }
  .wsrow .who { flex: 1; min-width: 0; font-size: 13px; font-weight: 700; }
  .wsrow .when { font-size: 11.5px; font-weight: 400; color: var(--ink-soft); }
  .dotmark {
    flex: none;
    width: 15px;
    height: 15px;
    border-radius: 999px;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
  }
  .wsrow[aria-checked="true"] .dotmark { border-color: var(--accent); box-shadow: inset 0 0 0 3.5px var(--paper), inset 0 0 0 8px var(--accent); }
  .field {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
    border-radius: 9px;
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
  }
  .field:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .folder { display: flex; align-items: center; gap: 10px; }
  .folder .where { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; }
  .folder .where.empty { font-family: inherit; color: var(--ink-soft); }
  .check { -webkit-app-region: no-drag; display: flex; align-items: flex-start; gap: 9px; margin-top: 10px; cursor: pointer; }
  .check input { margin: 2px 0 0; accent-color: var(--accent); }
  .check span { font-size: 12px; line-height: 1.55; }
  .check small { display: block; color: var(--ink-soft); }
</style>
</head>
<body>
<div class="titlebar"></div>
${switcher(language, languages, c)}
<aside class="art">${artwork()}</aside>
<main>
  <div class="inner" id="home">
    <div class="lockup">${MARK}<h1>AI4Kanban</h1></div>
    ${choices(c)}
    <section class="recent" id="recent" hidden>
      <h2><span>${escapeHtml(c.recent)}</span></h2>
      <ul class="rows" id="rows"></ul>
    </section>
  </div>
  ${cloudPath(c)}
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

const CLOUD_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 10.3 3.9 3.9 0 0 0 6.5 19z"/></svg>`;

const BACK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>`;

const GITHUB_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0"/></svg>`;

/** The app's mark again, small enough to sit in a panel heading. */
const MARK_SMALL = MARK.replace('width="34" height="34"', 'width="20" height="20"');

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
//
// The Cloud path (#317) is the one part that has states: it swaps the column for a panel
// and moves between four steps. Every move it makes is a bridge call — the app holds the
// sign-in, the workspace calls and the import, out of the rules it already carries — so
// nothing about Cloud is decided here.
function script(c: DesktopCopy["launcher"]): string {
  return `
  const app = window.ai4kanban;
  const FILLS_IN = ${JSON.stringify(FILLS_IN)};
  const PATH_GONE = ${JSON.stringify(c.pathGone(FILLS_IN))};
  const OPENING = ${JSON.stringify(c.opening(FILLS_IN))};
  const CLOUD_BADGE = ${JSON.stringify(c.cloudBadge)};
  const BUSY = ${JSON.stringify(c.cloud.busy)};
  const PICK = ${JSON.stringify({
    newWorkspace: c.cloud.pick.newWorkspace,
    namedBelow: c.cloud.pick.namedBelow,
    noFolder: c.cloud.pick.noFolder,
    create: c.cloud.pick.create,
    open: c.cloud.pick.open,
    importBlurb: c.cloud.pick.importBlurb,
  })};
  const OPENED = ${JSON.stringify(c.cloud.pick.opened(FILLS_IN))};
  // A number the page puts in afterwards. One and many are two whole sentences, so the
  // plural one is asked for with a count no sentence could hold for any other reason —
  // ".ai4kanban.json" and "docs/kanban/" are full of digits, and a translation is free to
  // add more.
  const MANY = ${JSON.stringify(String(SENTINEL))};
  const IMPORT_ONE = ${JSON.stringify(c.cloud.pick.importCards(1))};
  const IMPORT_MANY = ${JSON.stringify(c.cloud.pick.importCards(SENTINEL))};
  const ASKED = ${JSON.stringify(c.cloud.closed.asked(FILLS_IN))};
  const DONE = ${JSON.stringify({
    stale: c.cloud.done.stale,
    noGit: c.cloud.done.noGit,
    nothingTracked: c.cloud.done.nothingTracked,
    committed: c.cloud.done.committed,
    safe: c.cloud.done.offerSafe,
  })};
  const READY_NONE = ${JSON.stringify(c.cloud.done.ready(FILLS_IN, 0))};
  const READY_ONE = ${JSON.stringify(c.cloud.done.ready(FILLS_IN, 1))};
  const READY_MANY = ${JSON.stringify(c.cloud.done.ready(FILLS_IN, SENTINEL))};
  const OFFER_ONE = ${JSON.stringify(c.cloud.done.offerBlurb(1))};
  const OFFER_MANY = ${JSON.stringify(c.cloud.done.offerBlurb(SENTINEL))};
  const PRIVACY_URL = "https://ai4kanban.dev/privacy";
  const TERMS_URL = "https://ai4kanban.dev/terms";

  const $ = (id) => document.getElementById(id);
  // Through a function, so a dollar sign in a folder's name is a character and not a
  // replacement pattern.
  const fill = (sentence, value) => sentence.replace(FILLS_IN, () => String(value));
  // A count decides which sentence is drawn, and the number is put in afterwards: one and
  // many are two whole sentences, and neither is stitched together here.
  const counted = (one, many, n) => (n === 1 ? one : many.replace(MANY, () => String(n)));

  // --- the two Local moves ---------------------------------------------------
  // Both are the same folder picker under different intent, and a mismatch falls through to
  // what the folder actually holds: Open on a folder with no board offers to make one, and
  // Create on a folder that has one opens it. Nothing overwrites a board.
  $("local-create").addEventListener("click", () => app?.pickRepo());
  $("local-open").addEventListener("click", () => app?.pickRepo());

  // The app has started opening a project — the picker is already gone, and this page has
  // the wait. Nothing puts it back: the board's page loads over this one, and the only
  // other way out of an open ends the app.
  app?.onOpening((name) => {
    document.body.classList.add("busy");
    document.body.setAttribute("aria-busy", "true");
    const status = $("status");
    status.hidden = false;
    status.textContent = fill(OPENING, name);
  });

  // The switcher saves through the app rather than through a board server, which this
  // page has none of. The app draws this page again in whatever was saved, so a click
  // that lands shows the new language and one that could not save shows the old.
  const langs = $("langs");
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

  // The two published pages, and the way back to the Local moves. Every link on this page
  // is a button, because none of them is navigation: two open the user's own browser and
  // one changes what is on screen.
  for (const row of document.querySelectorAll(".linkish[data-act]")) {
    row.addEventListener("click", () => {
      if (row.dataset.act === "privacy") app?.openExternal(PRIVACY_URL);
      else if (row.dataset.act === "terms") app?.openExternal(TERMS_URL);
      else app?.pickRepo();
    });
  }

  // --- the projects opened before -------------------------------------------
  const recent = $("recent");
  const rows = $("rows");

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
    button.title = p.missing ? fill(PATH_GONE, p.path) : p.path;
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
    // Which of the two kinds of board this project is (#317). Said on the row, because the
    // two open the same way and behave differently once open.
    if (p.cloud) {
      const badge = document.createElement("span");
      badge.className = "pill";
      badge.style.marginLeft = "7px";
      badge.textContent = CLOUD_BADGE;
      name.append(badge);
    }

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

  // --- the Cloud path --------------------------------------------------------
  // One panel over the same column, four steps deep. What it holds between presses: the
  // account, the workspaces the account has, which one is picked, the folder, and what
  // going Cloud left in the repository.
  let account = null;
  let workspaces = [];
  let picked = "";        // a workspace id, or "" for a new one
  let folder = null;      // what the picked folder holds
  let intent = "create";  // which of the two Cloud buttons was pressed
  let gone = null;        // the answer from going Cloud

  const STEPS = ["signin", "closed", "pick", "done"];
  const home = $("home");
  const panel = $("cloud");
  const error = $("cloud-error");

  function show(which) {
    home.hidden = which !== "home";
    panel.hidden = which === "home";
  }

  function step(which) {
    for (const name of STEPS) $("step-" + name).hidden = name !== which;
  }

  function say(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  /** A press that is waiting on the network. The button says so and takes no second
   *  click — every move here is a call the app makes, and some of them are slow. */
  async function working(button, work) {
    // The nodes, not the text: a button that carries a mark would come back without it.
    const was = Array.from(button.childNodes);
    button.disabled = true;
    button.replaceChildren(BUSY);
    say("");
    try {
      return await work();
    } finally {
      button.disabled = false;
      button.replaceChildren(...was);
    }
  }

  /** Which step this account belongs on. Signing in happens here because Configuration is
   *  only reachable once a board is open, and a machine with no session has no board. */
  function route() {
    if (!account) return step("signin");
    if (account.error) say(account.error);
    if (account.state === "signed-in") return openPicker();
    if (account.state === "not-admitted") {
      const asked = $("cloud-asked");
      asked.hidden = !account.inviteRequestedAt;
      if (account.inviteRequestedAt) asked.textContent = fill(ASKED, account.inviteRequestedAt.slice(0, 10));
      return step("closed");
    }
    // Signed out, expired, or a build with no Cloud to talk to. The service's own sentence is
    // shown as it stands — including the one a build carrying no Cloud says for itself, which
    // is the whole reason the button in front of it will not finish.
    if (account.message && (!account.configured || account.state !== "signed-out")) say(account.message);
    step("signin");
  }

  async function openCloud(which) {
    intent = which;
    say("");
    show("cloud");
    step("signin");
    account = await app?.cloudAccount();
    route();
  }

  $("cloud-create").addEventListener("click", () => openCloud("create"));
  $("cloud-open").addEventListener("click", () => openCloud("open"));
  $("cloud-back").addEventListener("click", () => {
    say("");
    show("home");
  });

  $("cloud-signin").addEventListener("click", async (e) => {
    account = await working(e.currentTarget, () => app?.cloudSignIn());
    route();
  });

  $("cloud-invite").addEventListener("click", async (e) => {
    account = await working(e.currentTarget, () => app?.cloudRequestInvite());
    route();
  });

  $("cloud-signout").addEventListener("click", async (e) => {
    account = await working(e.currentTarget, () => app?.cloudSignOut());
    route();
  });

  // --- the workspace and the folder ------------------------------------------

  async function openPicker() {
    step("pick");
    $("cloud-go").textContent = intent === "open" ? PICK.open : PICK.create;
    drawFolder();
    const answer = await app?.cloudWorkspaces();
    if (!answer || !answer.ok) {
      workspaces = [];
      say(answer ? answer.error : "");
    } else {
      workspaces = answer.workspaces;
    }
    // Open lands on the first workspace the account has; Create lands on a new one. Neither
    // is a default the other cannot leave — the list is one control.
    picked = intent === "open" && workspaces.length ? workspaces[0].id : "";
    drawWorkspaces();
  }

  function drawWorkspaces() {
    const list = $("cloud-workspaces");
    list.replaceChildren();
    list.append(workspaceRow({ id: "", name: PICK.newWorkspace, when: PICK.namedBelow }));
    for (const w of workspaces) {
      list.append(workspaceRow({ id: w.id, name: w.name, when: fill(OPENED, (w.updatedAt || "").slice(0, 10)) }));
    }
    $("cloud-name-box").hidden = picked !== "";
    drawFolder();
    drawGo();
  }

  function workspaceRow(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wsrow";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(picked === entry.id));
    const mark = document.createElement("span");
    mark.className = "dotmark";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = entry.name;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = entry.when;
    button.append(mark, who, when);
    button.addEventListener("click", () => {
      picked = entry.id;
      drawWorkspaces();
    });
    return button;
  }

  $("cloud-pick").addEventListener("click", async () => {
    const answer = await app?.pickFolder();
    if (!answer) return;
    folder = answer;
    drawFolder();
    drawGo();
  });

  function drawFolder() {
    const where = $("cloud-folder");
    where.textContent = folder ? folder.path : PICK.noFolder;
    where.classList.toggle("empty", !folder);
    // Import is offered only where there is something to carry, and it says how much.
    const box = $("cloud-import-box");
    const has = !!folder && folder.cards > 0;
    box.hidden = !has;
    // On for a new workspace, off for one that is already a board: a workspace that holds a
    // board refuses a second, so importing into one by default would fail the move rather
    // than open it. The tick is still there to take either way.
    $("cloud-import").checked = !picked;
    if (has) {
      const label = $("cloud-import-label");
      label.replaceChildren();
      label.append(document.createTextNode(counted(IMPORT_ONE, IMPORT_MANY, folder.cards)));
      const small = document.createElement("small");
      small.textContent = PICK.importBlurb;
      label.append(small);
    }
  }

  function drawGo() {
    // A folder is the one thing that cannot be guessed: a Cloud board is still a folder on
    // this machine, and the pointer is written into it.
    $("cloud-go").disabled = !folder;
  }

  $("cloud-name").addEventListener("input", drawGo);

  $("cloud-go").addEventListener("click", async (e) => {
    if (!folder) return;
    const request = {
      dir: folder.path,
      importCards: !$("cloud-import-box").hidden && $("cloud-import").checked,
    };
    if (picked) request.workspaceId = picked;
    else request.name = $("cloud-name").value.trim() || folder.name;
    const answer = await working(e.currentTarget, () => app?.cloudGo(request));
    if (!answer || !answer.ok) return say(answer ? answer.error : "");
    gone = answer;
    drawDone();
    step("done");
  });

  // --- what going Cloud left in the repository -------------------------------

  function drawDone() {
    const name = gone.workspace.name || (folder ? folder.name : "");
    const ready = gone.imported === 0 ? READY_NONE : counted(READY_ONE, READY_MANY, gone.imported);
    $("cloud-ready").textContent = fill(ready, name);
    $("cloud-stale").textContent = DONE.stale;
    const change = gone.change;
    const blurb = $("cloud-offer-blurb");
    const safe = $("cloud-offer-safe");
    const row = $("cloud-offer-row");
    if (!change.git) {
      blurb.textContent = DONE.noGit;
      safe.hidden = true;
      row.hidden = true;
      return;
    }
    if (change.clean) {
      blurb.textContent = DONE.nothingTracked;
      safe.hidden = true;
      row.hidden = true;
      return;
    }
    blurb.textContent = counted(OFFER_ONE, OFFER_MANY, change.cards);
    safe.hidden = false;
    safe.textContent = DONE.safe;
    row.hidden = false;
  }

  $("cloud-commit").addEventListener("click", async (e) => {
    const done = await working(e.currentTarget, () => app?.cloudCommit(folder.path));
    if (!done || !done.ok) return say(done ? done.error : "");
    $("cloud-offer-blurb").textContent = DONE.committed;
    $("cloud-offer-safe").hidden = true;
    $("cloud-offer-row").hidden = true;
  });

  // Declining leaves a working checkout with a dirty git status, and the same offer waits
  // in the workspace controls until it is taken.
  $("cloud-keep").addEventListener("click", () => {
    $("cloud-offer-row").hidden = true;
  });

  $("cloud-open-board").addEventListener("click", () => {
    if (folder) app?.openProject(folder.path);
  });
`;
}
