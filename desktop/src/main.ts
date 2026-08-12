// AI4Kanban, as an app you open.
//
// What it does, in order: read the user's shell environment so runs can find
// their coding agent, open the project it had open last (asking for one the
// first time), start that board's own server on a private port, and show it in
// a window. Quitting ends every server it started and every run under them.
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
import path from "node:path";
import { makeBoard } from "./lib/board-init";
import { buildMenu } from "./lib/menu";
import * as projects from "./lib/projects";
import { BoardServers } from "./lib/server";
import { loginShellEnv } from "./lib/shell-env";
import * as store from "./lib/store";
import { newerRelease, DOWNLOADS_URL } from "./lib/update";
import {
  CHANNELS,
  type AppInfo,
  type CreateBoardResult,
  type ProjectInfo,
  type UpdateInfo,
} from "./shared/bridge";

let servers: BoardServers | null = null;
let win: BrowserWindow | null = null;
// Set the first time the window is asked, so switching project or reloading
// doesn't hit GitHub again in the same sitting.
let updatePromise: Promise<UpdateInfo | null> | null = null;

// One window, one board. A second launch raises the window that is already
// there rather than starting a second app over the same projects.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(start).catch(fatal);

async function start(): Promise<void> {
  // Before anything else: the environment a terminal would have given us. Every
  // run the board starts inherits it, so an agent installed the normal way is
  // found even though nothing here came from a terminal.
  const env = await loginShellEnv();
  servers = new BoardServers({
    env,
    version: app.getVersion(),
    // Which project is on screen, in the app's own folder rather than in any
    // repo — it is a fact about this window, not about a board. Each board
    // server reads it before it starts work nobody asked for.
    focusFile: path.join(app.getPath("userData"), "open-project"),
  });

  const repo = store.lastRepo() ?? (await askForRepo({ firstTime: true }));
  if (!repo) return app.quit(); // asked, and the user said no folder.

  refreshMenu();
  createWindow();
  await open(repo);
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
  win.on("closed", () => {
    win = null;
  });
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

// Dialogs hang off the window when there is one. The first folder pick happens
// before the window exists, and Electron wants to be asked differently then.
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

/** Ask which folder to open. Null when the user cancels. */
async function askForRepo({ firstTime = false }: { firstTime?: boolean } = {}): Promise<
  string | null
> {
  const res = await openDialog({
    title: firstTime ? "Open a project" : "Open another project",
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
  const repo = await askForRepo({ firstTime: false });
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

function refreshMenu(): void {
  buildMenu({
    onOpenRepo: pickRepo,
    onOpenProject: openProject,
    onCheckUpdates: checkUpdatesFromMenu,
    projects: listProjects(),
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
