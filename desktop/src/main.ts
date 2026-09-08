// AI4Kanban, as an app you open.
//
// What it does, in order: read the user's shell environment so runs can find
// their coding agent, open the project it had open last (or, the first time,
// show the launcher and wait for one to be picked), start that board's own
// server on a private port, and show it in a window. Quitting ends every server
// it started and every run under them.
//
// The app is how you move between projects (#178): Open Folder picks a new one,
// and the projects you have opened are a list you switch from. Each project
// keeps its own server, so a run you started in one is still going — and still
// writing to that board alone — after you have gone and looked at another.
//
// A project can hold more than one board (#407), and each open board gets a
// window of its own (#495): the header's switcher opens the picked board beside
// the one you were on rather than over it. The windows share the board's files
// and its runs; only the view — the page, its history, the card you have open —
// is each window's own.
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
  type IpcMainInvokeEvent,
  type MessageBoxOptions,
  type OpenDialogOptions,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { makeBoard, unmakeBoard, type NewBoard } from "./lib/board-init";
import { boardWord } from "./lib/boards";
import * as cloud from "./lib/cloud";
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
  reportAppOpen,
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
  type CloudAccountView,
  type CloudFolder,
  type CloudGoRequest,
  type CommandInstall,
  type CommandInstallResult,
  type CreateBoardResult,
  type NotificationAlert,
  type ProjectInfo,
  type UpdateStatus,
} from "./shared/bridge";

let servers: BoardServers | null = null;
// The environment a terminal would have given us, read once at start. Every run inherits
// it, and it is also the PATH the `akb` question is asked against — what a terminal would
// find, not what this process was launched with.
let shellEnv: Env = process.env as Env;
// The language everything outside the page is drawn in (#334) — the menu, the launcher,
// the dialogs, and the sentences the app hands the page to print. Read from the machine's
// own settings before the first menu, and set again whenever the page says the user
// changed it. Held by the copy module, since `lib/command.ts` and `lib/board-init.ts` are
// called from deep inside a move and have no language to be handed one.
holdLanguage(DEFAULT_LANGUAGE);

// --- the windows (#495) -------------------------------------------------------
//
// One window, one board. They are held in a list and never in a map keyed by board:
// picking a board opens a window every time, so two windows on one board is an ordinary
// state and a key would quietly collapse them into one.
//
// Everything a page can ask for is answered for the window that asked — `event.sender`
// says which — so a call made in one window can never move another.

interface Win {
  win: BrowserWindow;
  nav: Navigation;
  /** What this window is showing: a project folder when the board is that project's own
   *  `docs/kanban`, the board folder itself for any other board (#407), and null on the
   *  launcher. It is the path the board's server was started on. */
  board: string | null;
  /** The project the board belongs to — what the title and the projects list are drawn
   *  from. */
  project: string | null;
  /** The board this window made for itself. Opening a folder with no board makes one
   *  rather than asking, so this is what makes that undoable: while it is set, the setup
   *  screen offers to put the folder back and open another. Dropped the moment the window
   *  shows any other project. */
  made: NewBoard | null;
  /** What this window's bell is counting (#483), on its way to the Dock badge. */
  badge: number;
}

/** webContents id → the window it belongs to. */
const windows = new Map<number, Win>();

const everyWindow = (): Win[] => [...windows.values()];

/** The window the user is in. The last one made stands in when the app itself is not in
 *  front — a dialog raised from a Dock click, a scheme URL that arrived while the browser
 *  had focus — since something has to answer and that is the newest thing they opened. */
function focusedWindow(): Win | null {
  const front = BrowserWindow.getFocusedWindow();
  const held = front ? windows.get(front.webContents.id) : null;
  return held ?? everyWindow().at(-1) ?? null;
}

/** The window a page's call came from. Falls back to the focused one, which is what a
 *  message from a page that has already been closed should land on. */
const asking = (e: IpcMainInvokeEvent): Win | null =>
  windows.get(e.sender.id) ?? focusedWindow();

/** The board folder a window is showing, spelled the way the board switcher spells it. A
 *  window opened on a PROJECT is showing that project's own `docs/kanban`; every other
 *  board was opened on its own folder and is already spelled that way (#407). */
function boardFolder(w: Win): string | null {
  if (!w.board) return null;
  return w.board === w.project ? path.join(w.board, "docs", "kanban") : w.board;
}

/** Whether `w` is the window `board` names, under either spelling. */
const showing = (w: Win, board: string): boolean => w.board === board || boardFolder(w) === board;

/** A window already showing `board`, when there is one. The first of them: two windows on
 *  one board are equally right and the older one is where the user put it. */
const windowOn = (board: string): Win | null => everyWindow().find((w) => showing(w, board)) ?? null;

/** Every board a window is on — what the pool keeps alive and what the focus file says.
 *  Oldest window first, because the first one named is also the board that raises the
 *  account's system notifications (kanban-ui/lib/desktop.ts). */
const boardsOnScreen = (): string[] =>
  everyWindow()
    .map((w) => w.board)
    .filter((b): b is string => b !== null);

/** Say what is on screen now. Called after every window opens, closes or changes board:
 *  the pool keeps a server for each board named here and lets the rest go. */
function settle(): void {
  servers?.showing(boardsOnScreen());
  refreshMenu();
}

const raise = (w: Win): void => {
  if (w.win.isMinimized()) w.win.restore();
  w.win.show();
  w.win.focus();
};

// --- the app's own URL scheme (#326) -----------------------------------------
// `ai4kanban://…` opens this app. It is what a finished Cloud sign-in comes back to: the
// board UI server's loopback port is whatever the OS handed out at launch, so there is no
// fixed address of its own to register with the Supabase project, and the window is where
// the user started the sign-in anyway. #320 reuses the scheme to open a card from Slack.
//
// Claimed here as well as in the packaged app's manifest (electron-builder.yml), which is
// what makes a build from a checkout work.
const URL_SCHEME = "ai4kanban";

// One caught before a window can show it. Held rather than dropped: on macOS a launch
// through the scheme fires `open-url` before `whenReady`.
let pendingUrl: string | null = null;

// One app, however many windows. A second launch raises the window that is already there
// rather than starting a second app over the same projects.
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
  const carried = data as { dir?: string; url?: string | null } | undefined;
  // Windows and Linux hand a scheme URL to a fresh process as an argument, and a
  // single-instance app meets it here. macOS uses `open-url` below instead.
  if (carried?.url) return handleSchemeUrl(carried.url);
  // `akb` typed on its own in a project opens that project. The launcher inside the app
  // (resources/bin/akb) starts the app again with the folder it was standing in, and a
  // second launch of a single-instance app arrives right here.
  const dir = carried?.dir ?? workingDirectory;
  const near = boardNear(dir);
  const already = near ? windowOn(near) : null;
  const w = already ?? focusedWindow();
  if (!w) return;
  raise(w);
  // The window already on it is the answer; otherwise the one in front takes it, the way
  // it always has.
  if (near && !already) void open(w, near);
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
 *  dialog's and reach it only while that dialog is open.
 *
 *  The window it lands in is the one in front: a link names a Cloud board rather than a
 *  folder on this machine, so nothing here can tell which window is already on it — the
 *  page resolves that and hands the board over from there.
 *
 *  The one exception is a sign-in the LAUNCHER started (#317): there is no board server
 *  behind that page, so this process is holding the call, and the answer is taken here
 *  rather than sent on. */
function handleSchemeUrl(url: string): void {
  if (!url.startsWith(`${URL_SCHEME}://`)) return;
  if (takeLauncherSignIn(url)) return;
  const w = focusedWindow();
  if (!w || w.win.webContents.isLoading()) {
    pendingUrl = url;
    return;
  }
  raise(w);
  w.win.webContents.send(channelFor(url), url);
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
    // Which boards are on screen, in the app's own folder rather than in any
    // repo — it is a fact about the windows, not about a board. Each board
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

  const first = createWindow();
  refreshMenu();
  // The app was opened (#295). After the language, so nothing about reporting can delay the
  // first paint, and never awaited: it appends a line to a file this machine owns and the
  // batch that carries it goes out at a time this install picked for itself.
  void reportAppOpen();
  // Nothing to open on the first launch, and nothing to open when the folder we
  // had is gone. Either way the window says what this app is and offers the one
  // move there is, rather than opening a file dialog over an empty screen.
  if (repo) await open(first, repo);
  else await showLauncher(first);
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
 *  `docs/kanban/` or a workspace pointer. Null when there is no board over it, which is
 *  when a launch falls back to the project the app had open last. */
function boardNear(dir: string | null | undefined): string | null {
  if (!dir) return null;
  let at = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(at, "docs", "kanban")) || projects.pointsAtWorkspace(at)) return at;
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

/** Whether `dir` itself holds a board the UI can read. Half a board — a `docs/kanban/`
 *  with no `todo/` in it — counts as none: that is what the UI turns away, and the
 *  installer is also the repair for it.
 *
 *  A checkout pointed at a Cloud workspace (#317) holds one whatever is on disk: the folder
 *  is a copy the first read writes, so installing a Local board over it would put a second
 *  board in front of the one the repository actually names. */
function boardIn(dir: string): boolean {
  return fs.existsSync(path.join(dir, "docs", "kanban", "todo")) || projects.pointsAtWorkspace(dir);
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

/** How far a window opened from another one is offset from it, so the new board lands
 *  beside the board it was picked in rather than hiding it. */
const CASCADE = 34;

/** A window, and everything the app wires onto one. `from` is the window it was opened
 *  out of, which is where it is placed and how big it comes up. */
function createWindow(from?: Win): Win {
  const at = from && !from.win.isDestroyed() ? from.win.getBounds() : null;
  const win = new BrowserWindow({
    width: at?.width ?? 1280,
    height: at?.height ?? 860,
    ...(at ? { x: at.x + CASCADE, y: at.y + CASCADE } : {}),
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
      // Chromium slows a hidden window's timers to a crawl, and the bell's poll is one of
      // them — a badge that only catches up when you come back is the one thing the badge
      // exists to stop (#483). The poll is one read every few seconds; it costs nothing to
      // keep it running.
      backgroundThrottling: false,
    },
  });
  // A swipe, and the menu's Back and Forward, move between the pages the window
  // opened. The menu is redrawn on every move so the two grey out at the ends.
  const w: Win = { win, nav: attachNavigation(win, refreshMenu), board: null, project: null, made: null, badge: 0 };
  // Read now and kept: by `closed` the window's webContents is gone, and asking it for its
  // own id there throws — which would leave this window in the list for the rest of the
  // session, its board never let go and its project never off the projects list.
  const id = win.webContents.id;
  windows.set(id, w);

  win.once("ready-to-show", () => win.show());
  // The title belongs to the app, not to the page (#495). Every board page calls itself
  // "AI4Kanban", and a window takes its title from the document unless it is stopped —
  // which would paint over the project and board this window is on the moment it loads,
  // leaving every window in the switcher named the same thing.
  win.on("page-title-updated", (e) => e.preventDefault());
  // A page that has just finished loading is a page that can be handed a sign-in.
  win.webContents.on("did-finish-load", flushPendingUrl);
  // Back and Forward, Close Project and the recent list are all the front window's, so
  // the bar is redrawn whenever a different window comes to the front.
  win.on("focus", refreshMenu);
  win.on("closed", () => {
    windows.delete(id);
    // The board it was on goes back to the pool's ordinary rule: kept while a run is
    // going in it, let go when there is none. Another window on the same board keeps it.
    settle();
    paintBadge();
  });
  // Full screen takes the traffic lights away, and the gutter held for them
  // would be 78px of nothing. The page is told either way it changes, and again
  // on every load — loading another board is a whole new page, which starts out
  // knowing nothing about the window it landed in.
  if (MAC) {
    const tell = () => win.webContents.send(CHANNELS.fullscreen, win.isFullScreen());
    win.on("enter-full-screen", tell);
    win.on("leave-full-screen", tell);
    win.webContents.on("did-finish-load", tell);
  }
  // A link out of the board — the download page, a doc — opens in the user's
  // browser. Nothing navigates this window away from the board.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  return w;
}

// Dialogs hang off the window that asked for them — which is every dialog the
// app raises now that the launcher comes first. The windowless form is kept for
// the one that can still be raised before a window is up: a fatal start.
function messageBox(w: Win | null, options: MessageBoxOptions) {
  return w && !w.win.isDestroyed() ? dialog.showMessageBox(w.win, options) : dialog.showMessageBox(options);
}

function openDialog(w: Win | null, options: OpenDialogOptions) {
  return w && !w.win.isDestroyed() ? dialog.showOpenDialog(w.win, options) : dialog.showOpenDialog(options);
}

/** What a window says it is showing: the project, and what its board's work is called
 *  (#495) — "Engineering", "Marketing" — never the board folder's name, which is `kanban`
 *  on every board there is. macOS shows this in the window bar and in the app switcher's
 *  window list; every other system shows it too.
 *
 *  The project is set on the spot and the board's word is added when the rules answer:
 *  reading it is a walk of the project folder, and a window with no title until that
 *  finishes is worse than one that gains a word. */
function paintTitle(w: Win): void {
  const project = w.project;
  if (!project) return void w.win.setTitle("AI4Kanban");
  const name = path.basename(project) || project;
  w.win.setTitle(`${name} — AI4Kanban`);
  const board = w.board;
  if (!board) return;
  void boardWord(project, board).then((word) => {
    // The window has been closed, or moved to another board, while the rules were read.
    if (!word || w.win.isDestroyed() || w.board !== board) return;
    w.win.setTitle(`${name} · ${word} — AI4Kanban`);
  });
}

/** Point `w` at `repo`: start (or come back to) its server and show it.
 *  Loading its URL replaces that window's page wholesale, so nothing of the
 *  project before — no card, no dialog, no half-typed note — is left on screen.
 *  Every other window is untouched.
 *
 *  A folder with no board gets one here, without being asked. Picking a folder is
 *  the answer to "which project" and there is no second question worth stopping for: the
 *  screen that used to ask offered one useful button, and everyone who reached it pressed
 *  it. So the window opens on setup instead, and the way back out of a folder picked by
 *  mistake is the setup screen's own — one press, and the folder is as it was. */
async function open(w: Win, repo: string): Promise<void> {
  let url: string;
  // The page on screen keeps it until the board's own page paints over it. Installing a
  // board and starting its server are seconds of work with the launcher still up, and a
  // front door that answers nothing reads as a hang.
  w.win.webContents.send(CHANNELS.opening, path.basename(repo) || repo);
  if (w.made && w.made.dir !== repo) w.made = null;
  if (!boardIn(repo)) {
    // A failed install falls through to the board UI, which is the "no board here" screen
    // — the same two ways out it has always had, one of them the installer's own error.
    w.made = await makeBoard(repo).catch(() => null);
  }
  try {
    if (!servers) throw new Error("the app is not started yet");
    url = await servers.open(repo);
  } catch (e) {
    return fatal(e);
  }
  store.rememberRepo(repo);
  w.board = repo;
  w.project = repo;
  settle();
  paintTitle(w);
  await w.win.loadURL(url);
  // ...so going back doesn't reach into the project you had open before. That
  // board is a whole other page, on a whole other port, and coming back to it
  // half-way is not what a swipe should mean.
  w.nav.reset();
}

/** Open a project the user picked from the list. A folder that has since been
 *  moved or deleted is refused here rather than opened onto nothing — the list
 *  already says so and offers to remove the line. */
async function openProject(w: Win | null, repo: unknown): Promise<string | null> {
  if (!w || typeof repo !== "string" || !repo) return w?.board ?? null;
  if (repo === w.board) return repo;
  if (projects.describe(repo).missing) {
    await messageBox(w, {
      type: "warning",
      message: copy().dialog.folderGone.message(path.basename(repo)),
      detail: copy().dialog.folderGone.detail(repo),
    });
    return w.board ?? null;
  }
  await open(w, repo);
  return w.board;
}

/** The path a board's server is started on. A project's own `docs/kanban` is opened as the
 *  PROJECT, which is the spelling every other way in uses: two spellings of one board would
 *  start it a second server, and a board's runs, locks and files are the board's — one
 *  window may not have a second copy of them (#495). */
const serverDir = (project: string | null, board: string): string =>
  project && board === path.join(project, "docs", "kanban") ? project : board;

/** Show `board` in `w` — the projects list's own handover, minus the two things that belong
 *  to a PROJECT and not to a board: nothing is installed (a board folder is one already,
 *  and `install` is what puts it on the list), and nothing is remembered (the list is of
 *  projects, and this is the same project). */
async function loadBoard(w: Win, board: string): Promise<void> {
  w.project ??= boardNear(board);
  const dir = serverDir(w.project, board);
  w.win.webContents.send(CHANNELS.opening, path.basename(board) || board);
  if (!servers) throw new Error("the app is not started yet");
  const url = await servers.open(dir);
  w.board = dir;
  settle();
  paintTitle(w);
  await w.win.loadURL(url);
  w.nav.reset();
}

/** A board folder someone deleted between the switcher being drawn and this click. */
async function boardGone(w: Win | null, dir: string): Promise<boolean> {
  if (fs.existsSync(path.join(dir, "todo"))) return false;
  await messageBox(w, {
    type: "warning",
    message: copy().dialog.folderGone.message(path.basename(dir)),
    detail: copy().dialog.folderGone.detail(dir),
  });
  return true;
}

/** Put another board of this project in front (#407): the window already on it, or this
 *  one when none is.
 *
 *  This is where a bell row, a clicked notification and a card link for another board land
 *  — the event belongs to that board, so it should reach the window that is already
 *  showing it rather than take the one the user is reading. */
async function showBoard(w: Win | null, dir: unknown): Promise<string | null> {
  if (!w || typeof dir !== "string" || !dir) return w?.board ?? null;
  if (showing(w, dir)) return dir;
  const already = windowOn(dir);
  if (already) {
    raise(already);
    return dir;
  }
  if (await boardGone(w, dir)) return w.board;
  try {
    await loadBoard(w, dir);
  } catch (e) {
    fatal(e);
  }
  return w.board;
}

/** Open another board of this project in a window of its own (#495) — the header's
 *  switcher.
 *
 *  A new window every time, in both directions and with no modifier, even when that board
 *  already has one: the switcher's whole job is putting two boards side by side, and a
 *  press that sometimes only raised a window somewhere else would be a different control
 *  on every press. Picking the window's own board stays the no-op it always was.
 *
 *  The window it was pressed in is left exactly as it was — its board, its history, its
 *  card, its chat. */
async function openBoardWindow(from: Win | null, dir: unknown): Promise<string | null> {
  if (!from || typeof dir !== "string" || !dir || showing(from, dir)) return null;
  if (await boardGone(from, dir)) return null;
  const w = createWindow(from);
  w.project = from.project;
  try {
    await loadBoard(w, dir);
  } catch (e) {
    fatal(e);
    return null;
  }
  return dir;
}

/** Close Project: leave the board in this window without opening another, and let the
 *  next launch start on the launcher too.
 *
 *  The gesture exists because the app has no other way to say "I am done with
 *  this one" — closing the last window is quitting, so it can't also mean this.
 *  Said out loud on the menu, it is one click to undo from Recent.
 *
 *  A run going in the project keeps going, the way it does when the window
 *  moves to another project; the launcher's list marks it. */
async function closeProject(w: Win | null): Promise<void> {
  if (!w?.board) return;
  const project = w.project;
  w.board = null;
  w.project = null;
  w.made = null;
  // The project is let go before anything waits: another window may still be on it, and
  // only the last one leaving means the next launch should start on the launcher.
  if (project && !everyWindow().some((other) => other.project === project)) store.clearRepo();
  settle();
  await showLauncher(w);
}

/** The window with no project in it (./lib/launcher.ts): the app's mark, Open
 *  Folder, and the projects opened before. Every way out of it — the button, a
 *  recent project, the menu — loads a board over this page, so it is drawn once
 *  and never has to undraw itself. */
async function showLauncher(w: Win): Promise<void> {
  paintTitle(w);
  // No board on screen is no bell to count, and a badge left standing over the launcher is
  // a number nothing can clear (#483).
  w.badge = 0;
  paintBadge();
  await w.win.loadURL(
    launcherUrl({ mac: MAC, language: heldLanguage(), languages: await languageChoices() }),
  );
  w.nav.reset();
}

/** Ask which folder to open. Null when the user cancels — from the launcher
 *  that leaves the launcher up, which is where a cancel should land. */
async function askForRepo(w: Win | null): Promise<string | null> {
  const res = await openDialog(w, {
    title: w?.board ? copy().dialog.pick.titleAnother : copy().dialog.pick.titleFirst,
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
async function pickRepo(w: Win | null): Promise<string | null> {
  if (!w) return null;
  const repo = await askForRepo(w);
  if (!repo || repo === w.board) return w.board;
  await open(w, repo);
  return w.board;
}

/** The projects list: everything the user has opened, the open ones marked, with
 *  what is true about each right now (gone from disk, a run going). */
function listProjects(): ProjectInfo[] {
  // A project is open when ANY window is on a board of it — the windows may be showing
  // its `docs/kanban` and its `marketing/kanban` side by side (#495).
  const open = new Set(everyWindow().map((w) => w.project).filter((p): p is string => p !== null));
  return store.projects().map((p) => projects.describe(p.path, { open: open.has(p.path) }));
}

/** Take a project off the list. Nothing on disk is touched. Removing one a window
 *  is showing would leave that window on a project the list has forgotten, so
 *  that is refused — close it by opening another one first. */
function forgetProject(repo: unknown): ProjectInfo[] {
  if (typeof repo !== "string" || !repo) return listProjects();
  if (everyWindow().some((w) => w.project === repo)) return listProjects();
  store.forgetProject(repo);
  refreshMenu();
  return listProjects();
}

/** Make a board in the project this window is on, then show it. Opening a boardless folder
 *  already does this, so what is left for this is the retry on the "no board here" screen —
 *  the folder where the install failed once, tried again with its error on screen. */
async function createBoard(w: Win | null): Promise<CreateBoardResult> {
  const repo = w?.board;
  if (!w || !repo) return { ok: false, error: "no project is open" };
  try {
    w.made = await makeBoard(repo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  // Reload rather than reopen: the server is already on this folder and finds
  // the board on its next look (it only caches a hit).
  w.win.webContents.reload();
  return { ok: true };
}

/** The wrong folder, taken back: the board this window made for itself is removed,
 *  the folder is put back as it was, the project comes off the list it was only on because
 *  it was opened, and the picker opens on the folder the user meant. Cancelling that leaves
 *  the launcher up, which is where the mistake started.
 *
 *  Refused once anything has been answered on the board — the page only offers it on an
 *  untouched one — and refused outright for a board this window didn't make. */
async function discardBoard(w: Win | null): Promise<CreateBoardResult> {
  const made = w?.made;
  if (!w || !made || made.dir !== w.board) return { ok: false, error: "no new board here" };
  if (made.boardExisted) return { ok: false, error: "this board was already here" };
  w.made = null;
  // The server reads that folder, so it goes first — and the launcher it leaves behind is
  // already the right screen if removing the board turns out to be impossible.
  await closeProject(w);
  try {
    unmakeBoard(made);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  store.forgetProject(made.dir);
  refreshMenu();
  await pickRepo(w);
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

  const onWindows = state.kind === "path";
  const c = copy().dialog.command;
  const { response } = await messageBox(focusedWindow(), {
    type: "question",
    message: c.ask,
    detail: onWindows
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
    if (result.error) {
      await messageBox(focusedWindow(), { type: "warning", message: c.failed, detail: result.error });
    }
    return;
  }
  await messageBox(focusedWindow(), {
    type: "info",
    message: c.ready,
    detail: onWindows ? c.readyWindows : c.readyLink,
  });
}

/** Install, and then let the open project's note learn the new spelling. The whole move,
 *  wherever it was asked for — the offer above, or the button in the Setup group. */
async function putCommandOnPath(): Promise<CommandInstallResult> {
  const result = await installCommand(shellEnv);
  if (!result.ok) return result;
  const boardDir = focusedWindow()?.board;
  // Only the open project's note, and only once `akb` really answers on the PATH a run is
  // spawned on: a note naming a command that isn't there is worse than one naming the long
  // path that is.
  if (boardDir && (await commandAnswers(shellEnv))) await refreshSkillNote(shellEnv, boardDir);
  return result;
}

/** Hand over a scheme URL that arrived before the page could take it. */
function flushPendingUrl(): void {
  const url = pendingUrl;
  const w = focusedWindow();
  if (!url || !w) return;
  pendingUrl = null;
  if (takeLauncherSignIn(url)) return;
  w.win.webContents.send(channelFor(url), url);
}

// --- the Cloud path through onboarding (#317) --------------------------------
// Onboarding offers a Cloud board before any board is open, so there is no board server to
// ask: this process answers, out of the rules it already carries (./lib/cloud.ts).
//
// The sign-in is one call rather than a start and a listener, because the launcher is a
// `data:` page with no session to hold: the app opens the consent screen, waits for its own
// URL scheme to answer, exchanges the code, and hands back the account as it now stands.

/** The launcher sign-in this process is holding, if one is out in the browser. */
let launcherSignIn: ((url: string) => void) | null = null;

/** Take a sign-in answer for the launcher's own call. False when nobody here is waiting,
 *  which is every sign-in the Configuration dialog started. */
function takeLauncherSignIn(url: string): boolean {
  if (!launcherSignIn || !url.startsWith(`${URL_SCHEME}://cloud/signed-in`)) return false;
  const waiting = launcherSignIn;
  launcherSignIn = null;
  const w = focusedWindow();
  if (w) raise(w);
  waiting(url);
  return true;
}

/** How long the app waits for a consent screen the user may simply have walked away from.
 *  Long enough to read one and sign in; short enough that a forgotten tab does not leave the
 *  button spinning for the rest of the session. */
const SIGN_IN_WAIT_MS = 5 * 60 * 1000;

async function cloudSignIn(): Promise<CloudAccountView> {
  const start = await cloud.startCloudSignIn();
  if (!start.ok) return { ...(await cloud.cloudAccount()), error: start.error };
  await shell.openExternal(start.url);

  const answer = await new Promise<string | null>((resolve) => {
    const giveUp = setTimeout(() => {
      if (launcherSignIn === take) launcherSignIn = null;
      resolve(null);
    }, SIGN_IN_WAIT_MS);
    const take = (url: string) => {
      clearTimeout(giveUp);
      resolve(url);
    };
    launcherSignIn = take;
  });
  if (!answer) return await cloud.cloudAccount();

  const done = await cloud.finishCloudSignIn(answer);
  const account = await cloud.cloudAccount();
  return done.ok ? account : { ...account, error: done.error };
}

/** Ask for a folder without opening it, and say what it already holds. Onboarding's four
 *  moves all start here — a Cloud board is still a folder on this machine. */
async function pickFolder(w: Win | null): Promise<CloudFolder | null> {
  const picked = await askForRepo(w);
  return picked ? await cloud.cloudFolder(picked) : null;
}

/** The menu bar is the app's, so it is drawn for the window in front: Back and Forward are
 *  that window's history, and Close Project is that window's board. */
function refreshMenu(): void {
  const w = focusedWindow();
  buildMenu({
    onOpenRepo: () => pickRepo(focusedWindow()),
    onOpenProject: (dir) => openProject(focusedWindow(), dir),
    onCloseProject: () => closeProject(focusedWindow()),
    hasProject: Boolean(w?.board),
    onCheckUpdates: checkUpdatesFromMenu,
    onBack: () => focusedWindow()?.nav.back(),
    onForward: () => focusedWindow()?.nav.forward(),
    canGoBack: w?.nav.canGoBack() ?? false,
    canGoForward: w?.nav.canGoForward() ?? false,
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
  const w = focusedWindow();
  const found = await recheckForUpdate(app.getVersion());
  const c = copy().dialog.update;
  if (!found) {
    await messageBox(w, { type: "info", message: c.newest(app.getVersion()) });
    return;
  }
  if (found.stage === "downloading") {
    await messageBox(w, { type: "info", message: c.out(found.version), detail: c.downloading });
    return;
  }
  if (found.stage === "ready") {
    const { response } = await messageBox(w, {
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
    const { response } = await messageBox(w, {
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
  const { response } = await messageBox(w, {
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
//
// Every one of them is answered for the WINDOW that asked (#495), which is what
// keeps a move made in one window out of the others.

ipcMain.handle(CHANNELS.info, (e): AppInfo => {
  const w = asking(e);
  return {
    version: app.getVersion(),
    platform: process.platform,
    boardDir: w?.board ?? null,
    downloadsUrl: DOWNLOADS_URL,
    boardJustMade: Boolean(w?.made && w.made.dir === w.board && !w.made.boardExisted),
  };
});

ipcMain.handle(CHANNELS.projects, () => listProjects());

ipcMain.handle(CHANNELS.openProject, (e, repo: unknown) => openProject(asking(e), repo));

ipcMain.handle(CHANNELS.openBoard, (e, dir: unknown) => showBoard(asking(e), dir));

ipcMain.handle(CHANNELS.openBoardWindow, (e, dir: unknown) => openBoardWindow(asking(e), dir));

ipcMain.handle(CHANNELS.forgetProject, (_e, repo: unknown) => forgetProject(repo));

ipcMain.handle(CHANNELS.pickRepo, (e) => pickRepo(asking(e)));

ipcMain.handle(CHANNELS.pickFolder, (e) => pickFolder(asking(e)));

ipcMain.handle(CHANNELS.closeProject, async (e) => {
  await closeProject(asking(e));
  return null;
});

// The Cloud path onboarding takes (#317). Every one of these is the CLI's own move, reached
// through the rules the app carries — nothing about a workspace is decided here.
ipcMain.handle(CHANNELS.cloudAccount, () => cloud.cloudAccount());

ipcMain.handle(CHANNELS.cloudSignIn, () => cloudSignIn());

ipcMain.handle(CHANNELS.cloudSignOut, async () => {
  await cloud.signOutOfCloud();
  return await cloud.cloudAccount();
});

ipcMain.handle(CHANNELS.cloudRequestInvite, async () => {
  const asked = await cloud.requestCloudInvite();
  const account = await cloud.cloudAccount();
  return asked.ok ? account : { ...account, error: asked.error };
});

ipcMain.handle(CHANNELS.cloudWorkspaces, () => cloud.cloudWorkspaces());

ipcMain.handle(CHANNELS.cloudGo, (_e, request: unknown) => {
  const asked = request as Partial<CloudGoRequest> | undefined;
  if (typeof asked?.dir !== "string" || !asked.dir) {
    return { ok: false, error: "no folder was picked" };
  }
  return cloud.goCloud(asked as CloudGoRequest);
});

ipcMain.handle(CHANNELS.cloudCommit, (_e, dir: unknown) =>
  typeof dir === "string" && dir
    ? cloud.commitCloudChange(dir)
    : Promise.resolve({ ok: false as const, error: "no folder was named" }),
);

ipcMain.handle(CHANNELS.createBoard, (e) => createBoard(asking(e)));

ipcMain.handle(CHANNELS.discardBoard, (e) => discardBoard(asking(e)));

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

// The download moved, so the notice redraws — in every window, wherever in the
// board each is. The page asked for it, so there is nothing to hold for a late
// listener.
onUpdateChanged((status) => {
  for (const w of everyWindow()) {
    if (!w.win.isDestroyed()) w.win.webContents.send(CHANNELS.updateStatus, waved(status));
  }
});

ipcMain.handle(CHANNELS.openExternal, (_e, url: unknown) => {
  if (typeof url === "string" && /^https?:/.test(url)) void shell.openExternal(url);
  return null;
});

// The launcher's switcher (#339). The launcher is a `data:` page with no board server
// behind it, so the app saves for it, and then draws the page and the menu again in what was
// saved — a click that changes nothing on screen reads as a control that does not work. A
// save that failed leaves both where they were, which is the only error this page can say.
ipcMain.handle(CHANNELS.setLanguage, async (e, next: unknown) => {
  if (typeof next !== "string" || next === heldLanguage() || !(await knownLanguage(next))) return null;
  await saveLanguage(next);
  const saved = await machineLanguage();
  if (saved === heldLanguage()) return null;
  holdLanguage(saved);
  refreshMenu();
  // Only ever the launcher: every way off that page loads a board over it, and a board saves
  // through its own server and comes back on the channel below.
  const w = asking(e);
  if (w && !w.board) void showLauncher(w);
  return null;
});

// --- system notifications (#319) --------------------------------------------
//
// The page decides what an alert SAYS — one wording per event, because a second is a second
// thing to keep true — and the app decides whether it interrupts, because focus is the
// app's own answer and nothing in a page can give it.
//
//   • `actionable` is dropped while the window that raised it is focused, and nothing is
//     raised later to make up for it: the bell moved, in front of the person watching it.
//   • `outcome` is raised either way. A run the user approved and walked away from can
//     still reach them, and the app cannot tell that person from one who is watching.
//
// Clicking one raises the window whose bell it came out of and hands that page the EVENT it
// was raised for, so it opens exactly what clicking that row opens — and a row belonging to
// another board hands that board to the window already on it (`showBoard` above). A machine
// that cannot show notifications at all — the permission refused, the platform without them
// — changes nothing else: the bell, the rail and every action keep working.

ipcMain.handle(CHANNELS.notify, (e, raw: unknown) => {
  const from = asking(e);
  if (!Array.isArray(raw) || !from || !Notification.isSupported()) return null;
  const focused = from.win.isFocused();
  for (const item of raw) {
    const alert = item as Partial<NotificationAlert>;
    if (typeof alert?.title !== "string" || typeof alert.body !== "string") continue;
    if (alert.kind === "actionable" && focused) continue;
    raiseNotification(from, alert.title, alert.body, alert.eventId);
  }
  return null;
});

// --- the Dock badge (#483) ---------------------------------------------------
//
// The bell already counts what is waiting for a person; the badge is that count where you
// can see it with the window buried or hidden, which is the whole point of leaving the app
// running. So the page owns the number — it is the bell's own, over every board Cloud is on
// for — and the app only paints it.
//
// One icon, however many windows: each window's bell counts the same waiting work, so the
// badge is the highest of them rather than their sum, which would count it twice.
//
// Unlike a notification, focus is not its question: a badge interrupts nobody, and blanking
// it while a window is in front would only make it wrong the moment the user looks away.
// Reading the rows empties the bell, and the next count sent is what clears the badge.
//
// A system with no badge — Windows, a Linux desktop without one — is left exactly as it
// was. `setBadgeCount` is the whole of the platform question; nothing else here branches.

let badge = 0;

function paintBadge(): void {
  const count = Math.max(0, ...everyWindow().map((w) => w.badge));
  if (count === badge) return;
  badge = count;
  try {
    app.setBadgeCount(count);
  } catch {
    // No badge on this system. The bell carries the same number, so there is nothing to say.
  }
}

ipcMain.handle(CHANNELS.badge, (e, raw: unknown) => {
  const w = asking(e);
  if (!w) return null;
  w.badge = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  paintBadge();
  return null;
});

// Clicking the Dock icon. On macOS an app whose window is hidden or minimized is raised
// here and nowhere else — without this the click does nothing at all. A click that came
// off a badge with a count lands on the work: the bell is opened in the window whose count
// the badge was showing, which is the one place that number resolves to.
app.on("activate", () => {
  const counting = everyWindow().find((w) => w.badge === badge && badge > 0);
  const w = counting ?? focusedWindow();
  if (!w) return;
  raise(w);
  if (badge > 0) w.win.webContents.send(CHANNELS.openBell);
});

function raiseNotification(from: Win, title: string, body: string, eventId: unknown): void {
  try {
    const note = new Notification({ title, body });
    note.on("click", () => {
      // The window whose bell raised it, when it is still there — that is the page holding
      // the row. One that has since been closed falls back to the window in front.
      const w = from.win.isDestroyed() ? focusedWindow() : from;
      if (!w) return;
      raise(w);
      // The event's own id, not a card number: the bell carries every board Cloud is on
      // for, and two boards can each hold a card #12. The page resolves it to the board it
      // belongs to and lands on that card's page — there is no second view of an event.
      if (typeof eventId === "string" && eventId) {
        w.win.webContents.send(CHANNELS.openNotification, eventId);
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
// Closing the last window ends every board the app started — the ones on screen
// and any left running behind them for a run. That is the promise the app makes,
// and it holds on macOS too, where an app would normally sit in the Dock with no
// window: a board server left running behind a closed window is exactly the
// thing this app exists to stop.
//
// Closing ONE of several windows stops nothing (#495): the board it was on is
// the same board the others read, and a run in it belongs to the board rather
// than to the window it was started from.

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
