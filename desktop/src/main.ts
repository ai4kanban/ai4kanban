// AI4Kanban, as an app you open.
//
// What it does, in order: read the user's shell environment so runs can find
// their coding agent, open the project it had open last (or, the first time,
// show the launcher and wait for one to be picked), start that board's own
// server on a private port, and show it in a window. Quitting ends every server
// it started and every run under them.
//
// One project is on screen at a time, and the app is how you move between them
// (#178): Open Folder picks a new one, and the projects you have opened are a
// list you switch from. Each project keeps its own server, so a run you started
// in one is still going — and still writing to that board alone — after you have
// gone and looked at another.
//
// It is a window onto the board UI, not a second implementation of it. Nothing
// about cards, runs or memory lives here.

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type MessageBoxOptions,
  type OpenDialogOptions,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { makeBoard } from "./lib/board-init";
import { commandAnswers, commandState, installCommand, refreshSkillNote } from "./lib/command";
import { launcherUrl } from "./lib/launcher";
import { buildMenu } from "./lib/menu";
import { attachNavigation, type Navigation } from "./lib/navigation";
import * as projects from "./lib/projects";
import { DEFAULT_LANGUAGE, knownLanguage, machineLanguage } from "./lib/rules";
import { BoardServers } from "./lib/server";
import { loginShellEnv, type Env } from "./lib/shell-env";
import * as store from "./lib/store";
import { newerRelease, DOWNLOADS_URL } from "./lib/update";
import {
  CHANNELS,
  type AppInfo,
  type CommandInstall,
  type CommandInstallResult,
  type CreateBoardResult,
  type ProjectInfo,
  type UpdateInfo,
} from "./shared/bridge";

let servers: BoardServers | null = null;
let win: BrowserWindow | null = null;
// The environment a terminal would have given us, read once at start. Every run inherits
// it, and it is also the PATH the `akb` question is asked against — what a terminal would
// find, not what this process was launched with.
let shellEnv: Env = process.env as Env;
// Back and forward through the views the window opened. Set with the window.
let nav: Navigation | null = null;
// Set the first time the window is asked, so switching project or reloading
// doesn't hit GitHub again in the same sitting.
let updatePromise: Promise<UpdateInfo | null> | null = null;
// The language the menu is drawn in (#334). Read from the machine's own settings before
// the first menu, and set again whenever the page says the user changed it.
let language: string = DEFAULT_LANGUAGE;

// --- the app's own URL scheme (#326) -----------------------------------------
// `ai4kanban://…` opens this app. It is what a finished Cloud sign-in comes back to: the
// board UI server's loopback port is whatever the OS handed out at launch, so there is no
// fixed address of its own to register with the Supabase project, and the window is where
// the user started the sign-in anyway. #320 reuses the scheme to open a card from Slack.
//
// Claimed here as well as in the packaged app's manifest (electron-builder.yml), which is
// what makes a build from a checkout work.
const URL_SCHEME = "ai4kanban";

// One caught before the window can show it. Held rather than dropped: on macOS a launch
// through the scheme fires `open-url` before `whenReady`.
let pendingUrl: string | null = null;

// One window, one board. A second launch raises the window that is already
// there rather than starting a second app over the same projects.
//
// The folder the second launch stood in rides along as the lock's data, read from that
// process's own untouched argv. The `argv` the event hands over is Chromium's retelling —
// switches are reordered and split from their values, so `--cwd <dir>` arrives in pieces
// and must not be parsed there.
if (
  !app.requestSingleInstanceLock({
    dir: namedCwd(process.argv) ?? process.cwd(),
    url: schemeUrl(process.argv),
  })
) {
  app.exit(0);
}
app.on("second-instance", (_e, _argv, workingDirectory, data) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  const carried = data as { dir?: string; url?: string | null } | undefined;
  // Windows and Linux hand a scheme URL to a fresh process as an argument, and a
  // single-instance app meets it here. macOS uses `open-url` below instead.
  if (carried?.url) return handleSchemeUrl(carried.url);
  // `akb` typed on its own in a project opens that project. The launcher inside the app
  // (resources/bin/akb) starts the app again with the folder it was standing in, and a
  // second launch of a single-instance app arrives right here.
  const dir = carried?.dir ?? workingDirectory;
  const near = boardNear(dir);
  if (near && near !== servers?.boardDir) void open(near);
});

/** The scheme URL a launch carries, when one does. */
function schemeUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${URL_SCHEME}://`)) ?? null;
}

/** Hand it to the page. The app carries it no further — the board server is what holds the
 *  Cloud session, so the open Configuration dialog is what exchanges the answer. */
function handleSchemeUrl(url: string): void {
  if (!url.startsWith(`${URL_SCHEME}://`)) return;
  if (!win || win.webContents.isLoading()) {
    pendingUrl = url;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send(CHANNELS.cloudCallback, url);
}

app.on("open-url", (e, url) => {
  e.preventDefault();
  handleSchemeUrl(url);
});

app.whenReady().then(start).catch(fatal);

async function start(): Promise<void> {
  // Tell the system this app answers `ai4kanban://`. A packaged build already says so in
  // its manifest; this is what makes a build run from a checkout answer too.
  app.setAsDefaultProtocolClient(URL_SCHEME);
  pendingUrl ??= schemeUrl(process.argv);

  // Before anything else: the environment a terminal would have given us. Every
  // run the board starts inherits it, so an agent installed the normal way is
  // found even though nothing here came from a terminal.
  shellEnv = await loginShellEnv();
  servers = new BoardServers({
    env: shellEnv,
    version: app.getVersion(),
    // Which project is on screen, in the app's own folder rather than in any
    // repo — it is a fact about this window, not about a board. Each board
    // server reads it before it starts work nobody asked for.
    focusFile: path.join(app.getPath("userData"), "open-project"),
  });

  // Started by the launcher from a project folder — that board is the one to show, ahead
  // of whatever was open last.
  const repo = boardNear(namedCwd(process.argv)) ?? store.lastRepo();

  // Before the first menu: waiting for the board to load and report would leave an English
  // menu bar up for as long as that takes, on every launch.
  language = await machineLanguage();

  createWindow();
  refreshMenu();
  // Nothing to open on the first launch, and nothing to open when the folder we
  // had is gone. Either way the window says what this app is and offers the one
  // move there is, rather than opening a file dialog over an empty screen.
  if (repo) await open(repo);
  else await showLauncher();
  // A sign-in caught before there was a page to hand it to.
  flushPendingUrl();
  // And then, on a machine with no `akb`, the one offer this app makes on its own.
  await offerCommand();
}

/** The folder a launch names with `--cwd`, when one does. */
function namedCwd(argv: string[]): string | null {
  const at = argv.indexOf("--cwd");
  const dir = at >= 0 ? argv[at + 1] : undefined;
  return dir ? path.resolve(dir) : null;
}

/** The project holding `dir`'s board — that folder or the nearest one above it with a
 *  `docs/kanban/`. Null when there is no board over it, which is when a launch falls back
 *  to the project the app had open last. */
function boardNear(dir: string | null | undefined): string | null {
  if (!dir) return null;
  let at = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(at, "docs", "kanban"))) return at;
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

// On macOS the window has no title bar of its own: the board's own top row is
// the title bar, the way an editor's is. The row is 43px and already holds the
// board's identity on the left, so a separate 28px bar above it would say the
// same thing twice and cost a line of the board. The traffic lights are put
// where that row's controls sit — vertically centred against the 28px boxes —
// and the page leaves them a gutter (`a4k-inset` in kanban-ui/app/globals.css),
// which is the one thing the two ends have to agree on.
//
// macOS only. `hidden` keeps the traffic lights there and takes the bar away;
// on Windows and Linux the same option takes the minimise/maximise/close
// buttons with it, and the board's top row is full of its own controls on the
// right with nowhere to put them back. Those systems keep the native frame.
const MAC = process.platform === "darwin";

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: "#faf6ef", // the board's own cream, so the first paint doesn't flash white
    title: "AI4Kanban",
    ...(MAC ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 14, y: 14 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win?.show());
  // A page that has just finished loading is a page that can be handed a sign-in.
  win.webContents.on("did-finish-load", flushPendingUrl);
  win.on("closed", () => {
    win = null;
    nav = null;
  });
  // A swipe, and the menu's Back and Forward, move between the pages the window
  // opened. The menu is redrawn on every move so the two grey out at the ends.
  nav = attachNavigation(win, refreshMenu);
  // Full screen takes the traffic lights away, and the gutter held for them
  // would be 78px of nothing. The page is told either way it changes, and again
  // on every load — loading another project's board is a whole new page, which
  // starts out knowing nothing about the window it landed in.
  if (MAC) {
    const w = win;
    const tell = () => w.webContents.send(CHANNELS.fullscreen, w.isFullScreen());
    w.on("enter-full-screen", tell);
    w.on("leave-full-screen", tell);
    w.webContents.on("did-finish-load", tell);
  }
  // A link out of the board — the download page, a doc — opens in the user's
  // browser. Nothing navigates this window away from the board.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

// Dialogs hang off the window when there is one — which is every dialog the app
// raises now that the launcher comes first. The windowless form is kept for the
// one that can still be raised before the window is up: a fatal start.
function messageBox(options: MessageBoxOptions) {
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

function openDialog(options: OpenDialogOptions) {
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
}

/** Point the app at `repo`: start (or come back to) its server and show it.
 *  Loading its URL replaces the page wholesale, so nothing of the project
 *  before — no card, no dialog, no half-typed note — is left on screen. */
async function open(repo: string): Promise<void> {
  let url: string;
  try {
    if (!servers) throw new Error("the app is not started yet");
    url = await servers.open(repo);
  } catch (e) {
    return fatal(e);
  }
  store.rememberRepo(repo);
  refreshMenu();
  // The window says which project it is showing. macOS shows this in the window
  // bar and in the app switcher's window list; every other system shows it too.
  win?.setTitle(`${path.basename(repo) || repo} — AI4Kanban`);
  await win?.loadURL(url);
  // ...so going back doesn't reach into the project you had open before. That
  // board is a whole other page, on a whole other port, and coming back to it
  // half-way is not what a swipe should mean.
  nav?.reset();
}

/** Open a project the user picked from the list. A folder that has since been
 *  moved or deleted is refused here rather than opened onto nothing — the list
 *  already says so and offers to remove the line. */
async function openProject(repo: unknown): Promise<string | null> {
  if (typeof repo !== "string" || !repo) return servers?.boardDir ?? null;
  if (repo === servers?.boardDir) return repo;
  if (projects.describe(repo).missing) {
    await messageBox({
      type: "warning",
      message: `${path.basename(repo)} isn't there any more.`,
      detail: `${repo}\n\nThe folder was moved or deleted. Take it off the list, or put it back.`,
    });
    return servers?.boardDir ?? null;
  }
  await open(repo);
  return servers?.boardDir ?? null;
}

/** The window with no project in it (./lib/launcher.ts): the app's mark, Open
 *  Folder, and the projects opened before. Every way out of it — the button, a
 *  recent project, the menu — loads a board over this page, so it is drawn once
 *  and never has to undraw itself. */
async function showLauncher(): Promise<void> {
  win?.setTitle("AI4Kanban");
  await win?.loadURL(launcherUrl({ mac: MAC }));
  nav?.reset();
}

/** Ask which folder to open. Null when the user cancels — from the launcher
 *  that leaves the launcher up, which is where a cancel should land. */
async function askForRepo(): Promise<string | null> {
  const res = await openDialog({
    title: servers?.boardDir ? "Open another project" : "Open a project",
    // A folder with no board is a fine answer — the board UI offers to make one
    // there. So this asks for a project folder, not for a board.
    message: "Pick the project folder to open. It doesn't need a board yet.",
    buttonLabel: "Open",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: store.lastRepo() ?? app.getPath("home"),
  });
  const picked = res.filePaths[0];
  return res.canceled || !picked ? null : picked;
}

/** Open Folder: pick any folder on the machine and show its board. This is the
 *  only way a project enters the app — everything on the projects list got
 *  there by being picked here once. */
async function pickRepo(): Promise<string | null> {
  const repo = await askForRepo();
  if (!repo || repo === servers?.boardDir) return servers?.boardDir ?? null;
  await open(repo);
  return servers?.boardDir ?? null;
}

/** The projects list: everything the user has opened, the open one marked, with
 *  what is true about each right now (gone from disk, a run going). */
function listProjects(): ProjectInfo[] {
  const open = servers?.boardDir ?? null;
  return store.projects().map((p) => projects.describe(p.path, { open: p.path === open }));
}

/** Take a project off the list. Nothing on disk is touched. Removing the one
 *  that is open would leave the window showing a project the list has forgotten,
 *  so that is refused — close it by opening another one first. */
function forgetProject(repo: unknown): ProjectInfo[] {
  if (typeof repo !== "string" || !repo || repo === servers?.boardDir) return listProjects();
  store.forgetProject(repo);
  refreshMenu();
  return listProjects();
}

/** Make a board in the open project, then show it. The way out of the "no board
 *  here" screen inside the app, where there is no terminal to run the installer
 *  from. */
async function createBoard(): Promise<CreateBoardResult> {
  const repo = servers?.boardDir;
  if (!repo) return { ok: false, error: "no project is open" };
  try {
    await makeBoard(repo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  // Reload rather than reopen: the server is already on this folder and finds
  // the board on its next look (it only caches a hit).
  win?.webContents.reload();
  return { ok: true };
}

// --- the `akb` command (#226) ------------------------------------------------
// The app carries the command already; installing only points the system at it. The offer
// is made once, on the first launch that finds no `akb` on the PATH — before the user has
// done anything, since a Mac app dragged out of a disk image has no installer to have asked
// during. Declining costs nothing: the button in Configuration → Skill stays, and the offer
// itself comes back only when a command that was installed stops working.

/** Offer to install, if this is the launch that should. */
async function offerCommand(): Promise<void> {
  const state = commandState(shellEnv);
  if (state.kind === "none" || state.blocked) return;
  // Our own link, pointing at an app that has been moved or deleted: the shell says "no
  // such file" and only this can put it right. It is the one thing that earns a second ask.
  const broken = state.state === "dangling";
  if (!broken && (state.state !== "absent" || state.otherFirst)) {
    // Something answers to `akb` already — ours, npm's, or one from somewhere else. Nothing
    // to offer, and a break that has since been mended is a break we would ask about again.
    store.clearCommandBreak();
    return;
  }
  // A write that needs no password isn't worth a dialog: the symlink goes into the user's
  // own bin folder on the spot, the way Cursor's command appears without a word. The Skill
  // pane still says where it went, and deleting it is one line. A failure stays quiet too —
  // the button in the pane remains, and the next launch simply tries again.
  if (state.kind === "symlink" && !state.needsPassword) {
    const result = await putCommandOnPath();
    if (result.ok) store.clearCommandBreak();
    return;
  }

  if (broken ? store.commandBreakAsked() : store.commandOffered()) return;
  // Written before the dialog, not after: a user who quits from the dialog has still been
  // asked, and being asked again every launch is what makes an offer a nag.
  if (broken) store.rememberCommandBreak();
  else store.rememberCommandOffer();

  const windows = state.kind === "path";
  const { response } = await messageBox({
    type: "question",
    message: "Put the akb command on your PATH?",
    detail: windows
      ? `AI4Kanban carries its own copy of akb — the command a coding agent drives this board with. This puts the app's own folder (${state.writes}) on your PATH. Updating the app updates the command.\n\nA new PATH entry only reaches terminals opened after it.\n\nYou can do this later from Configuration → Skill.`
      : `AI4Kanban carries its own copy of akb — the command a coding agent drives this board with. This points ${state.writes} at the copy inside the app, so updating the app updates the command.${state.needsPassword ? " macOS asks for your administrator password to write there." : ""}\n\nYou can do this later from Configuration → Skill.`,
    buttons: ["Install", "Not now"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;

  const result = await putCommandOnPath();
  if (!result.ok) {
    if (result.error) await messageBox({ type: "warning", message: "akb was not installed.", detail: result.error });
    return;
  }
  await messageBox({
    type: "info",
    message: "akb is ready.",
    detail: windows
      ? "Open a new terminal and run `akb version`. Typing `akb` on its own opens this app."
      : "Run `akb version` in a terminal. Typing `akb` on its own opens this app on the project you are standing in.",
  });
}

/** Install, and then let the open project's note learn the new spelling. The whole move,
 *  wherever it was asked for — the offer above, or the button in the Skill pane. */
async function putCommandOnPath(): Promise<CommandInstallResult> {
  const result = await installCommand(shellEnv);
  if (!result.ok) return result;
  const boardDir = servers?.boardDir;
  // Only the open project's note, and only once `akb` really answers on the PATH a run is
  // spawned on: a note naming a command that isn't there is worse than one naming the long
  // path that is.
  if (boardDir && (await commandAnswers(shellEnv))) await refreshSkillNote(shellEnv, boardDir);
  return result;
}

/** Hand over a scheme URL that arrived before the page could take it. */
function flushPendingUrl(): void {
  const url = pendingUrl;
  if (!url || !win) return;
  pendingUrl = null;
  win.webContents.send(CHANNELS.cloudCallback, url);
}

function refreshMenu(): void {
  buildMenu({
    onOpenRepo: pickRepo,
    onOpenProject: openProject,
    onCheckUpdates: checkUpdatesFromMenu,
    onBack: () => nav?.back(),
    onForward: () => nav?.forward(),
    canGoBack: nav?.canGoBack() ?? false,
    canGoForward: nav?.canGoForward() ?? false,
    projects: listProjects(),
    language,
  });
}

/** Whether a newer app is out, asked once per launch. Null when there isn't
 *  one, or when the check couldn't be made. */
function pendingUpdate(): Promise<UpdateInfo | null> {
  if (!updatePromise) updatePromise = newerRelease(app.getVersion());
  return updatePromise;
}

// The menu's own "Check for updates" is the one place this is said out loud
// either way: a user who asks deserves an answer even when the answer is "you
// are up to date". The notice in the board says nothing when there is nothing.
async function checkUpdatesFromMenu(): Promise<void> {
  const found = await newerRelease(app.getVersion());
  updatePromise = Promise.resolve(found);
  if (!found) {
    await messageBox({
      type: "info",
      message: `AI4Kanban ${app.getVersion()} is the newest version.`,
    });
    return;
  }
  const { response } = await messageBox({
    type: "info",
    message: `AI4Kanban ${found.version} is out.`,
    detail: "The app never updates itself — download the new one when you want it.",
    buttons: ["Download", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) void shell.openExternal(found.url);
}

// --- what the page can ask for ----------------------------------------------
// The board UI is the same pages a browser gets, so everything the app adds
// reaches them through this narrow bridge (see preload.ts): which project is
// open, which ones there are and how to move between them, making a board where
// there is none, and whether a newer app is out. Both ends read the channel
// names off shared/bridge.ts, so neither can call one the other isn't answering.

ipcMain.handle(
  CHANNELS.info,
  (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    boardDir: servers?.boardDir ?? null,
    downloadsUrl: DOWNLOADS_URL,
  }),
);

ipcMain.handle(CHANNELS.projects, () => listProjects());

ipcMain.handle(CHANNELS.openProject, (_e, repo: unknown) => openProject(repo));

ipcMain.handle(CHANNELS.forgetProject, (_e, repo: unknown) => forgetProject(repo));

ipcMain.handle(CHANNELS.pickRepo, () => pickRepo());

ipcMain.handle(CHANNELS.createBoard, () => createBoard());

ipcMain.handle(CHANNELS.command, (): CommandInstall => commandState(shellEnv));

ipcMain.handle(CHANNELS.installCommand, (): Promise<CommandInstallResult> => putCommandOnPath());

ipcMain.handle(CHANNELS.update, async () => {
  const found = await pendingUpdate();
  if (!found || store.skippedVersion() === found.version) return null;
  return found;
});

ipcMain.handle(CHANNELS.skipUpdate, (_e, version: unknown) => {
  if (typeof version === "string" && version) store.skipVersion(version);
  return null;
});

ipcMain.handle(CHANNELS.openExternal, (_e, url: unknown) => {
  if (typeof url === "string" && /^https?:/.test(url)) void shell.openExternal(url);
  return null;
});

// The board changed language (#334). The setting is already saved by the time this
// arrives — the page is only telling the menu, which lives outside it.
ipcMain.handle(CHANNELS.languageChanged, async (_e, next: unknown) => {
  if (next === language || !(await knownLanguage(next))) return null;
  language = next as string;
  refreshMenu();
  return null;
});

// --- ending cleanly ---------------------------------------------------------
// Closing the window ends every board the app started — the one on screen and
// any left running behind it for a run. That is the promise the app makes, and
// it holds on macOS too, where an app would normally sit in the Dock with no
// window: a board server left running behind a closed window is exactly the
// thing this app exists to stop.

app.on("window-all-closed", () => app.quit());

// And the same when the app is ended from outside the window — Ctrl-C in the
// terminal it was started from, a `kill`, a logout. Without these, Node's own
// default handling would end the app without ever running `before-quit`, and the
// board servers would be left behind precisely because they sit in their own
// process groups. (A SIGKILL or a crash can still orphan them; nothing in the
// app can catch those.)
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => app.quit());
}

let quitting = false;
app.on("before-quit", (e) => {
  if (quitting || !servers) return;
  quitting = true;
  // Stopping the servers — and the agent runs in their process groups — takes a
  // moment, so hold the quit until it is done rather than leaving them orphaned.
  e.preventDefault();
  servers.stopAll().finally(() => app.exit(0));
});

function fatal(err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  dialog.showErrorBox("AI4Kanban could not start the board", detail);
  app.exit(1);
}
