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
  update: "a4k:update",
  skipUpdate: "a4k:skip-update",
  openExternal: "a4k:open-external",
  /** The one channel that runs the other way: main tells the page whether the
   *  window is full screen, because the page holds a gutter for the traffic
   *  lights and full screen has none. Nothing is asked for and nothing comes
   *  back, so it isn't on the bridge below — preload puts the answer straight on
   *  <html> as a class. */
  fullscreen: "a4k:fullscreen",
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
  /** A newer app, when one is out and the user hasn't waved this one off. */
  update(): Promise<UpdateInfo | null>;
  /** Don't mention this version again. */
  skipUpdate(version: string): Promise<null>;
  /** Open a link in the user's own browser. */
  openExternal(url: string): Promise<null>;
}
