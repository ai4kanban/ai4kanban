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
  Notification,
  shell,
  type MessageBoxOptions,
  type OpenDialogOptions,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { makeBoard, unmakeBoard, type NewBoard } from "./lib/board-init";
import { commandAnswers, commandState, installCommand, refreshSkillNote } from "./lib/command";
import { copy, holdLanguage, heldLanguage } from "./lib/copy";
import { launcherUrl } from "./lib/launcher";
import { buildMenu } from "./lib/menu";
import { attachNavigation, type Navigation } from "./lib/navigation";
import * as projects from "./lib/projects";
import {
  DEFAULT_LANGUAGE,
  guessLanguage,
  knownLanguage,
  languageChoices,
  machineLanguage,
  saveLanguage,
} from "./lib/rules";
import { BoardServers } from "./lib/server";
import { loginShellEnv, type Env } from "./lib/shell-env";
import * as store from "./lib/store";
import {
  canSkipUpdate,
  checkForUpdate,
  installUpdate,
  onUpdateChanged,
  recheckForUpdate,
  startUpdate,
  DOWNLOADS_URL,
} from "./lib/update";
import {
  CHANNELS,
  type AppInfo,
  type CommandInstall,
  type CommandInstallResult,
  type CreateBoardResult,
  type NotificationAlert,
  type ProjectInfo,
  type UpdateStatus,
} from "./shared/bridge";

let servers: BoardServers | null = null;
let win: BrowserWindow | null = null;
// The environment a terminal would have given us, read once at start. Every run inherits
// it, and it is also the PATH the `akb` question is asked against — what a terminal would
// find, not what this process was launched with.
let shellEnv: Env = process.env as Env;
// Back and forward through the views the window opened. Set with the window.
let nav: Navigation | null = null;
// The board the open on screen made for itself, and what it wrote over. Opening a
// folder with no board makes one rather than asking, so this is what makes that undoable:
// while it is set, the setup screen offers to put the folder back and open another. It is
// dropped the moment the window shows any other project.
let madeBoard: NewBoard | null = null;
// The language everything outside the page is drawn in (#334) — the menu, the launcher,
// the dialogs, and the sentences the app hands the page to print. Read from the machine's
// own settings before the first menu, and set again whenever the page says the user
// changed it. Held by the copy module, since `lib/command.ts` and `lib/board-init.ts` are
// called from deep inside a move and have no language to be handed one.
holdLanguage(DEFAULT_LANGUAGE);

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
 *  Cloud session, so the open Configuration dialog is what exchanges a sign-in answer.
 *
 *  Two channels, because the two are answered in different places: a card link (#320) is
 *  the window's, wherever the user is, and the sign-in answers are the Configuration
 *  dialog's and reach it only while that dialog is open. */
function handleSchemeUrl(url: string): void {
  if (!url.startsWith(`${URL_SCHEME}://`)) return;
  if (!win || win.webContents.isLoading()) {
    pendingUrl = url;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send(channelFor(url), url);
}

/** Which of the two a URL is for. One place, because a URL held until the page was ready
 *  goes out through `flushPendingUrl` rather than through the function above. */
const channelFor = (url: string): string =>
  url.startsWith(`${URL_SCHEME}://card/`) ? CHANNELS.cardLink : CHANNELS.cloudCallback;

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
  // menu bar up for as long as that takes, on every launch. On the launch that finds nothing
  // saved, this is also where the machine's own language is guessed and written down (#339),
  // so the menu and the board's first paint read one answer.
  await guessLanguage(app.getPreferredSystemLanguages());
  holdLanguage(await machineLanguage());

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

/** Whether `dir` itself holds a board the UI can read. Half a board — a `docs/kanban/`
 *  with no `todo/` in it — counts as none: that is what the UI turns away, and the
 *  installer is also the repair for it. */
function boardIn(dir: string): boolean {
  return fs.existsSync(path.join(dir, "docs", "kanban", "todo"));
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
 *  before — no card, no dialog, no half-typed note — is left on screen.
 *
 *  A folder with no board gets one here, without being asked. Picking a folder is
 *  the answer to "which project" and there is no second question worth stopping for: the
 *  screen that used to ask offered one useful button, and everyone who reached it pressed
 *  it. So the window opens on setup instead, and the way back out of a folder picked by
 *  mistake is the setup screen's own — one press, and the folder is as it was. */
async function open(repo: string): Promise<void> {
  let url: string;
  // The page on screen keeps it until the board's own page paints over it. Installing a
  // board and starting its server are seconds of work with the launcher still up, and a
  // front door that answers nothing reads as a hang.
  win?.webContents.send(CHANNELS.opening, path.basename(repo) || repo);
  if (madeBoard && madeBoard.dir !== repo) madeBoard = null;
  if (!boardIn(repo)) {
    // A failed install falls through to the board UI, which is the "no board here" screen
    // — the same two ways out it has always had, one of them the installer's own error.
    madeBoard = await makeBoard(repo).catch(() => null);
  }
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
      message: copy().dialog.folderGone.message(path.basename(repo)),
      detail: copy().dialog.folderGone.detail(repo),
    });
    return servers?.boardDir ?? null;
  }
  await open(repo);
  return servers?.boardDir ?? null;
}

/** Close Project: leave the one on screen without opening another, and let the
 *  next launch start on the launcher too.
 *
 *  The gesture exists because the app has no other way to say "I am done with
 *  this one" — the window is the app here, so closing it is quitting, and a
 *  quit that quietly forgot your project would punish everyone who ends the app
 *  that way. Said out loud on the menu, it is one click to undo from Recent.
 *
 *  A run going in the project keeps going, the way it does when the window
 *  moves to another project; the launcher's list marks it. */
async function closeProject(): Promise<void> {
  if (!servers?.boardDir) return;
  store.clearRepo();
  // The project is let go before anything waits: stopping its server takes a
  // moment, and that moment belongs behind the launcher rather than in front of
  // a board the user has already closed.
  const stopped = servers.close();
  refreshMenu();
  await showLauncher();
  await stopped;
}

/** The window with no project in it (./lib/launcher.ts): the app's mark, Open
 *  Folder, and the projects opened before. Every way out of it — the button, a
 *  recent project, the menu — loads a board over this page, so it is drawn once
 *  and never has to undraw itself. */
async function showLauncher(): Promise<void> {
  win?.setTitle("AI4Kanban");
  await win?.loadURL(
    launcherUrl({ mac: MAC, language: heldLanguage(), languages: await languageChoices() }),
  );
  nav?.reset();
}

/** Ask which folder to open. Null when the user cancels — from the launcher
 *  that leaves the launcher up, which is where a cancel should land. */
async function askForRepo(): Promise<string | null> {
  const res = await openDialog({
    title: servers?.boardDir ? copy().dialog.pick.titleAnother : copy().dialog.pick.titleFirst,
    // A folder with no board is a fine answer — the board UI offers to make one
    // there. So this asks for a project folder, not for a board.
    message: copy().dialog.pick.message,
    buttonLabel: copy().dialog.pick.button,
    properties: ["openDirectory", "createDirectory"],
    // Where the last pick was, even after Close Project forgot which one was
    // open: the newest project on the list is the same folder, and a dialog
    // that opens at home after every close is a dialog you navigate twice.
    defaultPath: store.lastRepo() ?? store.projects()[0]?.path ?? app.getPath("home"),
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

/** Make a board in the open project, then show it. Opening a boardless folder already does
 *  this, so what is left for this is the retry on the "no board here" screen — the folder
 *  where the install failed once, tried again with its error on screen. */
async function createBoard(): Promise<CreateBoardResult> {
  const repo = servers?.boardDir;
  if (!repo) return { ok: false, error: "no project is open" };
  try {
    madeBoard = await makeBoard(repo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  // Reload rather than reopen: the server is already on this folder and finds
  // the board on its next look (it only caches a hit).
  win?.webContents.reload();
  return { ok: true };
}

/** The wrong folder, taken back: the board this window made for itself is removed,
 *  the folder is put back as it was, the project comes off the list it was only on because
 *  it was opened, and the picker opens on the folder the user meant. Cancelling that leaves
 *  the launcher up, which is where the mistake started.
 *
 *  Refused once anything has been answered on the board — the page only offers it on an
 *  untouched one — and refused outright for a board this window didn't make. */
async function discardBoard(): Promise<CreateBoardResult> {
  const made = madeBoard;
  if (!made || made.dir !== servers?.boardDir) return { ok: false, error: "no new board here" };
  if (made.boardExisted) return { ok: false, error: "this board was already here" };
  madeBoard = null;
  // The server reads that folder, so it goes first — and the launcher it leaves behind is
  // already the right screen if removing the board turns out to be impossible.
  await closeProject();
  try {
    unmakeBoard(made);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  store.forgetProject(made.dir);
  refreshMenu();
  await pickRepo();
  return { ok: true };
}

// --- the `akb` command (#226) ------------------------------------------------
// The app carries the command already; installing only points the system at it. The offer
// is made once, on the first launch that finds no `akb` on the PATH — before the user has
// done anything, since a Mac app dragged out of a disk image has no installer to have asked
// during. Declining costs nothing: the button in Configuration → General stays, and the offer
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
  const c = copy().dialog.command;
  const { response } = await messageBox({
    type: "question",
    message: c.ask,
    detail: windows
      ? c.detailWindows(state.writes)
      : state.needsPassword
        ? c.detailLinkPassword(state.writes)
        : c.detailLink(state.writes),
    buttons: [c.install, c.notNow],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;

  const result = await putCommandOnPath();
  if (!result.ok) {
    if (result.error) await messageBox({ type: "warning", message: c.failed, detail: result.error });
    return;
  }
  await messageBox({
    type: "info",
    message: c.ready,
    detail: windows ? c.readyWindows : c.readyLink,
  });
}

/** Install, and then let the open project's note learn the new spelling. The whole move,
 *  wherever it was asked for — the offer above, or the button in the Setup group. */
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
  win.webContents.send(channelFor(url), url);
}

function refreshMenu(): void {
  buildMenu({
    onOpenRepo: pickRepo,
    onOpenProject: openProject,
    onCloseProject: closeProject,
    hasProject: Boolean(servers?.boardDir),
    onCheckUpdates: checkUpdatesFromMenu,
    onBack: () => nav?.back(),
    onForward: () => nav?.forward(),
    canGoBack: nav?.canGoBack() ?? false,
    canGoForward: nav?.canGoForward() ?? false,
    projects: listProjects(),
    language: heldLanguage(),
  });
}

// The menu's own "Check for updates" is the one place this is said out loud
// either way: a user who asks deserves an answer even when the answer is "you
// are up to date". The notice in the board says nothing when there is nothing.
//
// It offers the same install the notice does. A download already going is not
// thrown away by asking about it — the answer is how far along it is.
async function checkUpdatesFromMenu(): Promise<void> {
  const found = await recheckForUpdate(app.getVersion());
  const c = copy().dialog.update;
  if (!found) {
    await messageBox({ type: "info", message: c.newest(app.getVersion()) });
    return;
  }
  if (found.stage === "downloading") {
    await messageBox({ type: "info", message: c.out(found.version), detail: c.downloading });
    return;
  }
  if (found.stage === "ready") {
    const { response } = await messageBox({
      type: "info",
      message: c.ready(found.version),
      detail: c.readyDetail,
      buttons: [c.restart, c.later],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) restartForUpdate();
    return;
  }
  // Waving a version off lives here now (#372): the board's chip is one icon with
  // no room for a dismiss, and burying a version for good is a deliberate act
  // rather than something to put a click away from Install.
  const buries = canSkipUpdate();
  const bury = (version: string, response: number) => {
    if (buries && response === 2) store.skipVersion(version);
  };
  if (found.blocked) {
    const { response } = await messageBox({
      type: "info",
      message: c.out(found.version),
      detail: c.detailManual(found.blocked),
      buttons: buries ? [c.download, c.later, c.skip] : [c.download, c.later],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) void shell.openExternal(found.url);
    bury(found.version, response);
    return;
  }
  const { response } = await messageBox({
    type: "info",
    message: c.out(found.version),
    detail: c.detail,
    buttons: buries ? [c.install, c.later, c.skip] : [c.install, c.later],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) void beginUpdate();
  bury(found.version, response);
}

/** Start the download. Asking for it un-waves the version first: the menu offers
 *  the install even for one the user waved off, and the notice above the board is
 *  where the progress and the restart are. */
function beginUpdate(): Promise<UpdateStatus | null> {
  store.unskipVersion();
  return startUpdate();
}

/** Put the new version in place and go. Nothing is written until this process
 *  has exited, so the quit is the install — the helper waits for it. */
function restartForUpdate(): void {
  if (installUpdate()) app.quit();
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
    boardJustMade: Boolean(madeBoard && madeBoard.dir === servers?.boardDir && !madeBoard.boardExisted),
  }),
);

ipcMain.handle(CHANNELS.projects, () => listProjects());

ipcMain.handle(CHANNELS.openProject, (_e, repo: unknown) => openProject(repo));

ipcMain.handle(CHANNELS.forgetProject, (_e, repo: unknown) => forgetProject(repo));

ipcMain.handle(CHANNELS.pickRepo, () => pickRepo());

ipcMain.handle(CHANNELS.createBoard, () => createBoard());

ipcMain.handle(CHANNELS.discardBoard, () => discardBoard());

ipcMain.handle(CHANNELS.command, (): CommandInstall => commandState(shellEnv));

ipcMain.handle(CHANNELS.installCommand, (): Promise<CommandInstallResult> => putCommandOnPath());

ipcMain.handle(CHANNELS.update, async () => {
  const found = await checkForUpdate(app.getVersion());
  return waved(found);
});

ipcMain.handle(CHANNELS.startUpdate, async () => waved(await beginUpdate()));

ipcMain.handle(CHANNELS.restartForUpdate, () => {
  restartForUpdate();
  return null;
});

/** A version the user has already waved off is no notice at all. */
function waved(found: UpdateStatus | null): UpdateStatus | null {
  if (!found) return null;
  return store.skippedVersion() === found.version ? null : found;
}

// The download moved, so the notice redraws — wherever in the board it is being
// shown. The page asked for it, so there is nothing to hold for a late listener.
onUpdateChanged((status) => {
  if (win && !win.isDestroyed()) win.webContents.send(CHANNELS.updateStatus, waved(status));
});

ipcMain.handle(CHANNELS.openExternal, (_e, url: unknown) => {
  if (typeof url === "string" && /^https?:/.test(url)) void shell.openExternal(url);
  return null;
});

// The launcher's switcher (#339). The launcher is a `data:` page with no board server
// behind it, so the app saves for it, and then draws the page and the menu again in what was
// saved — a click that changes nothing on screen reads as a control that does not work. A
// save that failed leaves both where they were, which is the only error this page can say.
ipcMain.handle(CHANNELS.setLanguage, async (_e, next: unknown) => {
  if (typeof next !== "string" || next === heldLanguage() || !(await knownLanguage(next))) return null;
  await saveLanguage(next);
  const saved = await machineLanguage();
  if (saved === heldLanguage()) return null;
  holdLanguage(saved);
  refreshMenu();
  // Only ever the launcher: every way off that page loads a board over it, and a board saves
  // through its own server and comes back on the channel below.
  if (!servers?.boardDir) void showLauncher();
  return null;
});

// --- system notifications (#319) --------------------------------------------
//
// The page decides what an alert SAYS — one wording per event, because a second is a second
// thing to keep true — and the app decides whether it interrupts, because focus is the
// app's own answer and nothing in a page can give it.
//
//   • `actionable` is dropped while the window is focused, and nothing is raised later to
//     make up for it: the bell moved, in front of the person watching it.
//   • `outcome` is raised either way. A run the user approved and walked away from can
//     still reach them, and the app cannot tell that person from one who is watching.
//
// Clicking one raises the window and hands the page the EVENT it was raised for, so it
// opens exactly what clicking that row opens — switching the app to the event's own board
// when the bell is carrying more than one. A machine that cannot show notifications at all
// — the permission refused, the platform without them — changes nothing else: the bell, the
// rail and every action keep working.

ipcMain.handle(CHANNELS.notify, (_e, raw: unknown) => {
  if (!Array.isArray(raw) || !Notification.isSupported()) return null;
  const focused = win?.isFocused() ?? false;
  for (const item of raw) {
    const alert = item as Partial<NotificationAlert>;
    if (typeof alert?.title !== "string" || typeof alert.body !== "string") continue;
    if (alert.kind === "actionable" && focused) continue;
    raiseNotification(alert.title, alert.body, alert.eventId);
  }
  return null;
});

function raiseNotification(title: string, body: string, eventId: unknown): void {
  try {
    const note = new Notification({ title, body });
    note.on("click", () => {
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      // The event's own id, not a card number: the bell carries every board Cloud is on
      // for, and two boards can each hold a card #12. The page resolves it to the board it
      // belongs to and lands on that card's page — there is no second view of an event.
      if (typeof eventId === "string" && eventId) {
        win.webContents.send(CHANNELS.openNotification, eventId);
      }
    });
    note.show();
  } catch {
    // The system refused it. The bell already holds the row, so there is nothing to say.
  }
}

// The board changed language (#334). The setting is already saved by the time this
// arrives — the page is only telling the menu, which lives outside it.
ipcMain.handle(CHANNELS.languageChanged, async (_e, next: unknown) => {
  if (next === heldLanguage() || !(await knownLanguage(next))) return null;
  holdLanguage(next as string);
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
  dialog.showErrorBox(copy().dialog.startFailed, detail);
  app.exit(1);
}
