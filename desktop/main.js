"use strict";

// AI4Kanban, as an app you open.
//
// What it does, in order: read the user's shell environment so runs can find
// their coding agent, ask which repo to open (only the first time — after that
// it remembers), start the board's own server on a private port, and show it in
// a window. Closing the window ends the server and every run under it.
//
// It is a window onto the board UI, not a second implementation of it. Nothing
// about cards, runs or memory lives here.

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const { buildMenu } = require("./lib/menu");
const { BoardServer } = require("./lib/server");
const store = require("./lib/store");
const { newerRelease, DOWNLOADS_URL } = require("./lib/update");

/** @type {BoardServer | null} */
let server = null;
/** @type {BrowserWindow | null} */
let win = null;
// Set the first time the window is asked, so switching repo or reloading
// doesn't hit GitHub again in the same sitting.
let updatePromise = null;

// One window, one board. A second launch raises the window that is already
// there rather than starting a second server on the same repo.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(start).catch(fatal);

async function start() {
  // Before anything else: the environment a terminal would have given us. Every
  // run the board starts inherits it, so an agent installed the normal way is
  // found even though nothing here came from a terminal.
  const { loginShellEnv } = require("./lib/shell-env");
  const env = await loginShellEnv();
  server = new BoardServer({ env, version: app.getVersion() });

  const repo = store.lastRepo() ?? (await askForRepo({ firstTime: true }));
  if (!repo) return app.quit(); // asked, and the user said no folder.
  store.rememberRepo(repo);

  buildMenu({ onOpenRepo: switchRepo, onCheckUpdates: checkUpdatesFromMenu });
  createWindow();
  await open(repo);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: "#faf6ef", // the board's own cream, so the first paint doesn't flash white
    title: "AI4Kanban",
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
  // A link out of the board — the download page, a doc — opens in the user's
  // browser. Nothing navigates this window away from the board.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

/** Point the app at `repo`: start its server and show it. */
async function open(repo) {
  try {
    await server.start(repo);
  } catch (e) {
    return fatal(e);
  }
  await win?.loadURL(server.url);
}

/** Ask which folder to open. Null when the user cancels. */
async function askForRepo({ firstTime } = {}) {
  const res = await dialog.showOpenDialog(win ?? undefined, {
    title: firstTime ? "Open a project" : "Open another project",
    // A folder with no board is a fine answer — the board UI offers to make one
    // there. So this asks for a project folder, not for a board.
    message: "Pick the project folder to open. It doesn't need a board yet.",
    buttonLabel: "Open",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: store.lastRepo() ?? app.getPath("home"),
  });
  return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
}

/** Switch to another repo, from the menu or from the board's own path button.
 *  The window stays; the server behind it is restarted on the new folder. */
async function switchRepo() {
  const repo = await askForRepo({ firstTime: false });
  if (!repo || repo === server?.boardDir) return;
  store.rememberRepo(repo);
  await open(repo);
}

/** Whether a newer app is out, asked once per launch. Null when there isn't
 *  one, or when the check couldn't be made. */
function pendingUpdate() {
  if (!updatePromise) updatePromise = newerRelease(app.getVersion());
  return updatePromise;
}

// The menu's own "Check for updates" is the one place this is said out loud
// either way: a user who asks deserves an answer even when the answer is "you
// are up to date". The notice in the board says nothing when there is nothing.
async function checkUpdatesFromMenu() {
  const found = await newerRelease(app.getVersion());
  updatePromise = Promise.resolve(found);
  if (!found) {
    await dialog.showMessageBox(win ?? undefined, {
      type: "info",
      message: `AI4Kanban ${app.getVersion()} is the newest version.`,
    });
    return;
  }
  const { response } = await dialog.showMessageBox(win ?? undefined, {
    type: "info",
    message: `AI4Kanban ${found.version} is out.`,
    detail: "The app never updates itself — download the new one when you want it.",
    buttons: ["Download", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) shell.openExternal(found.url);
}

// --- what the page can ask for ----------------------------------------------
// The board UI is the same pages a browser gets, so everything the app adds
// reaches them through this narrow bridge (see preload.js). Three things: which
// repo is open, switch it, and is there a newer app.

ipcMain.handle("a4k:info", () => ({
  version: app.getVersion(),
  platform: process.platform,
  boardDir: server?.boardDir ?? null,
  downloadsUrl: DOWNLOADS_URL,
}));

ipcMain.handle("a4k:pick-repo", async () => {
  await switchRepo();
  return server?.boardDir ?? null;
});

ipcMain.handle("a4k:update", async () => {
  const found = await pendingUpdate();
  if (!found || store.skippedVersion() === found.version) return null;
  return found;
});

ipcMain.handle("a4k:skip-update", (_e, version) => {
  if (typeof version === "string" && version) store.skipVersion(version);
  return null;
});

ipcMain.handle("a4k:open-external", (_e, url) => {
  if (typeof url === "string" && /^https?:/.test(url)) shell.openExternal(url);
  return null;
});

// --- ending cleanly ---------------------------------------------------------
// Closing the window ends the board. That is the promise the app makes, and it
// holds on macOS too, where an app would normally sit in the Dock with no
// window: a board server left running behind a closed window is exactly the
// thing this app exists to stop.

app.on("window-all-closed", () => app.quit());

// And the same when the app is ended from outside the window — Ctrl-C in the
// terminal it was started from, a `kill`, a logout. Without these, Node's own
// default handling would end the app without ever running `before-quit`, and the
// board server would be left behind precisely because it sits in its own process
// group. (A SIGKILL or a crash can still orphan it; nothing in the app can catch
// those.)
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => app.quit());
}

let quitting = false;
app.on("before-quit", (e) => {
  if (quitting || !server) return;
  quitting = true;
  // Stopping the server — and the agent runs in its process group — takes a
  // moment, so hold the quit until it is done rather than leaving them orphaned.
  e.preventDefault();
  server.stop().finally(() => app.exit(0));
});

function fatal(err) {
  const detail = err instanceof Error ? err.message : String(err);
  dialog.showErrorBox("AI4Kanban could not start the board", detail);
  app.exit(1);
}
