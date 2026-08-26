// The shape of everything the app adds to a board page, written down once.
//
// Three places have to agree on it: main.ts, which answers; preload.ts, which
// hands the answers to the page; and the board UI on the far side
// (kanban-ui/components/desktop.tsx), which asks. Before this file they agreed
// by hand, and a channel name typed wrong in one of them failed as a promise
// that never resolved rather than as an error anybody could see.
//
// Nothing here imports Electron. It is types and channel names only, so the
// board UI can eventually read it too.

/** Which window this is, and what board it is showing. */
export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  boardDir: string | null;
  downloadsUrl: string;
}

/** One line of the projects list. `name` is the folder's own name, which is what
 *  a person calls the project; the whole path sits beside it, since two projects
 *  can share a name. */
export interface ProjectInfo {
  path: string;
  name: string;
  /** The folder was moved or deleted since it was opened. */
  missing: boolean;
  hasBoard: boolean;
  /** An agent run is going in this project right now. */
  running: boolean;
  /** This is the project on screen. */
  open: boolean;
}

/** A newer app than this one, and where to get it. */
export interface UpdateInfo {
  version: string;
  url: string;
}

export type CreateBoardResult = { ok: true } | { ok: false; error: string };

/** How this system puts `akb` on the PATH: one symlink (macOS), a PATH entry holding the
 *  app's own `bin` folder (Windows), or no way at all (Linux, where the AppImage unpacks
 *  itself somewhere new every run). */
export type CommandKind = "symlink" | "path" | "none";

/** What is at the path the button writes:
 *   - `absent`    — nothing installed.
 *   - `installed` — ours, pointing at an app that is there.
 *   - `dangling`  — ours, pointing at an app that is no longer there.
 *   - `foreign`   — held by an `akb` the app didn't put there. An npm install lands at the
 *                   same path, so this is the ordinary way it happens. */
export type CommandLinkState = "absent" | "installed" | "dangling" | "foreign";

/** Where the `akb` command stands on this machine (#226). */
export interface CommandInstall {
  kind: CommandKind;
  /** The path a press would write — named on screen before the press. A user-owned bin
   *  folder the PATH already reads when there is one, else `/usr/local/bin/akb`; an
   *  existing install keeps its own path. */
  writes: string;
  /** Whether writing there raises the administrator dialog — `/usr/local/bin` when it
   *  isn't the user's to write, never a folder of the user's own. */
  needsPassword: boolean;
  state: CommandLinkState;
  /** What the installed link points at. */
  points: string | null;
  /** What is holding that path, when it isn't ours. */
  holder: string | null;
  /** The `akb` a terminal runs right now, when it isn't the one at our path. */
  otherFirst: string | null;
  /** Why the button is off — this app sits somewhere that won't last. */
  blocked: string | null;
}

export interface CommandInstallResult {
  ok: boolean;
  error?: string;
  /** How the machine stands afterwards, so one answer redraws the pane. */
  state: CommandInstall;
}

/** Which way through the views the window opened. */
export type NavDirection = "back" | "forward";

/** The channel names main.ts answers on and preload.ts calls. main.ts reads
 *  these values; preload.ts, which cannot require a file in a sandboxed
 *  renderer, writes them out again and types that copy against this one — so
 *  neither can drift onto a channel nobody is listening to. */
export const CHANNELS = {
  info: "a4k:info",
  projects: "a4k:projects",
  openProject: "a4k:open-project",
  forgetProject: "a4k:forget-project",
  pickRepo: "a4k:pick-repo",
  createBoard: "a4k:create-board",
  /** Where `akb` stands on this machine, and the press that puts it there (#226). */
  command: "a4k:command",
  installCommand: "a4k:install-command",
  update: "a4k:update",
  skipUpdate: "a4k:skip-update",
  openExternal: "a4k:open-external",
  /** The one channel that runs the other way: main tells the page whether the
   *  window is full screen, because the page holds a gutter for the traffic
   *  lights and full screen has none. Nothing is asked for and nothing comes
   *  back, so it isn't on the bridge below — preload puts the answer straight on
   *  <html> as a class. */
  fullscreen: "a4k:fullscreen",
  /** The window has moved between views from outside the page — the menu's Back
   *  and Forward, or a mouse's own buttons — so the page can mark the edge it
   *  went out of. A swipe needs no message: the page reads that gesture itself
   *  and moves its own history. */
  navigated: "a4k:navigated",
  /** A finished Cloud sign-in, caught on the app's own URL scheme and handed to
   *  the page (#326). The app carries it no further: the board server is what
   *  holds the session, so the Configuration dialog is what exchanges it. */
  cloudCallback: "a4k:cloud-callback",
  /** The board is now drawing in another language (#334), so the menu — which lives
   *  outside the page — follows. The setting itself is already saved by the time this
   *  arrives; the app reads it for itself at startup. */
  languageChanged: "a4k:language-changed",
  /** Save the language this machine reads in (#339) — the launcher's own switcher, which
   *  has no board server behind it to save through. */
  setLanguage: "a4k:set-language",
} as const;

/**
 * The whole of what the board's pages can ask the app for — `window.ai4kanban`.
 *
 * The pages are the same ones a browser gets, so they can't assume any of this
 * exists: outside the app the object is simply absent, and the UI checks for it
 * before it offers anything.
 */
export interface Ai4kanbanBridge {
  /** What window this is. */
  info(): Promise<AppInfo>;
  /** The projects the user has opened, newest first. */
  projects(): Promise<ProjectInfo[]>;
  /** Show a project from that list. Returns the folder now open, which is the
   *  old one when the project's folder has gone. */
  openProject(dir: string): Promise<string | null>;
  /** Take a project off the list — nothing on disk is touched. Returns the list
   *  as it now is. */
  forgetProject(dir: string): Promise<ProjectInfo[]>;
  /** Ask the user for another project folder and open it. Returns the folder
   *  now open, which is the old one when they cancelled. */
  pickRepo(): Promise<string | null>;
  /** Make a board in the open project — the way out of "there is no board here"
   *  in a window with no terminal. */
  createBoard(): Promise<CreateBoardResult>;
  /** Where the `akb` command stands on this machine (#226). */
  command(): Promise<CommandInstall>;
  /** Put `akb` on the PATH. On macOS this is where the system asks for an
   *  administrator password, when the folder being written needs one. */
  installCommand(): Promise<CommandInstallResult>;
  /** A newer app, when one is out and the user hasn't waved this one off. */
  update(): Promise<UpdateInfo | null>;
  /** Don't mention this version again. */
  skipUpdate(version: string): Promise<null>;
  /** Open a link in the user's own browser. */
  openExternal(url: string): Promise<null>;
  /** Be told each time the window moves between views, so the page can mark the
   *  edge it went out of. Returns the way to stop being told. */
  onNavigated(fn: (direction: NavDirection) => void): () => void;
  /** Be handed a finished Cloud sign-in (#326) — the whole callback URL the app
   *  was opened with. One that arrived before anybody was listening is kept and
   *  handed to the first subscriber, so a slow-drawing pane doesn't lose it.
   *  Returns the way to stop being told. */
  onCloudCallback(fn: (url: string) => void): () => void;
  /** Say which language the board is now drawing in (#334), so the menu follows. The
   *  language is a string the command's own list decides — the app checks it against that
   *  list rather than keeping a copy of it. */
  languageChanged(language: string): Promise<null>;
  /** Save the language this machine reads in (#339), for a page with no board server behind
   *  it: the launcher. The app saves it, then draws that page and the menu again in whatever
   *  was saved, so a save that failed leaves the page where it was. */
  setLanguage(language: string): Promise<null>;
}
