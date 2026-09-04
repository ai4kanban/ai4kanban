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
  /** The board on screen was made when this folder was opened, and nothing has been done
   *  to it since. It is what lets the setup screen offer to take a wrong folder
   *  back — the only place `discardBoard` may be called from. */
  boardJustMade: boolean;
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
  /** Its board lives in a Cloud workspace — the checkout carries `.ai4kanban.json` (#317). */
  cloud: boolean;
  /** An agent run is going in this project right now. */
  running: boolean;
  /** This is the project on screen. */
  open: boolean;
}

/** Where installing a newer app stands (#372). `idle` is a version offered and
 *  nothing started; `downloading` is the bytes coming in; `ready` has them on
 *  disk, checked, waiting for the restart the user picks. A failure goes back to
 *  `idle` carrying `error`. */
export type UpdateStage = "idle" | "downloading" | "ready";

/** A newer app than this one, where to get it, and how far along installing it
 *  is. Held by the app, not by a page, so moving between the board and a card
 *  neither restarts a download nor loses one. */
export interface UpdateStatus {
  version: string;
  /** The downloads page — the fallback whenever this copy cannot install. */
  url: string;
  stage: UpdateStage;
  received: number;
  total: number;
  /** Why this copy cannot install it itself — a checkout, a disk image, a
   *  folder it cannot write. Null when it can. */
  blocked: string | null;
  /** What went wrong last time, said plainly. */
  error: string | null;
}

export type CreateBoardResult = { ok: true } | { ok: false; error: string };

// --- the Cloud path through onboarding (#317) --------------------------------
// Onboarding offers a Cloud board before any board is open, so there is no board server to
// ask for any of this: the app answers it itself, from the rules it already carries
// (lib/cloud.ts). Configuration → Workspace runs the same moves through the board server,
// on a board that IS open.

/** Which account this machine acts as — the four answers a sign-in comes back with, and
 *  what the service said about the last of them. */
export interface CloudAccountView {
  /** `signed-out`, `signed-in`, `not-admitted` or `expired`. */
  state: string;
  handle: string | null;
  name: string | null;
  /** The service's own sentence, shown as it stands. */
  message: string | null;
  inviteRequestedAt: string | null;
  /** This build carries a Cloud to talk to at all. */
  configured: boolean;
  /** Cloud could not be reached. */
  error: string | null;
}

export type CloudMoveResult = { ok: true } | { ok: false; error: string };

/** One of the account's workspaces, as the picker lists them. */
export interface CloudWorkspaceView {
  id: string;
  name: string;
  updatedAt: string;
}

/** What a picked folder already holds. All four onboarding moves pick a project folder,
 *  and what the folder turns out to be is what happens next. */
export interface CloudFolder {
  path: string;
  name: string;
  board: boolean;
  cards: number;
  git: boolean;
  /** It already points at a workspace. */
  workspace: string;
}

/** What the one offered commit would carry. */
export interface CloudChangeView {
  git: boolean;
  cards: number;
  pointer: "add" | "remove" | "none";
  ignore: boolean;
  clean: boolean;
}

export interface CloudGoRequest {
  dir: string;
  /** The workspace to open, or empty to make a new one under `name`. */
  workspaceId?: string;
  name?: string;
  importCards?: boolean;
}

export type CloudGoResult =
  | {
      ok: true;
      workspace: { id: string; name: string };
      imported: number;
      change: CloudChangeView;
    }
  | { ok: false; error: string };

/**
 * One interruption the board is asking the app to raise (#319).
 *
 * The page decides WHAT it says — one wording per event, because a second is a second thing
 * to keep true — and the app decides WHETHER it interrupts:
 *
 *   • `actionable` is not raised at all while the window is focused, and nothing is raised
 *     later to make up for it. The bell moved, and the person is looking at it.
 *   • `outcome` is raised either way: a run the user approved and walked away from can
 *     still reach them, and the app cannot tell someone who walked away from someone who
 *     is watching.
 */
export interface NotificationAlert {
  eventId: string;
  boardId: string;
  taskId: number;
  /** The row's words: `#319 Sync actionable events…`. */
  title: string;
  /** The event's name, or the outcome for the second notification. */
  body: string;
  kind: "actionable" | "outcome";
}

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
  /** Show another board of the project already open (#407). */
  openBoard: "a4k:open-board",
  forgetProject: "a4k:forget-project",
  pickRepo: "a4k:pick-repo",
  /** Ask for a folder and answer with what it holds — the picker onboarding's four moves
   *  share, and the one Export writes into. Nothing is opened (#317). */
  pickFolder: "a4k:pick-folder",
  /** Leave the board on screen and show the launcher — what a deleted workspace leaves the
   *  window on (#317). */
  closeProject: "a4k:close-project",
  createBoard: "a4k:create-board",
  /** The Cloud path through onboarding (#317), answered by the app itself because there is
   *  no board server before a board is open. */
  cloudAccount: "a4k:cloud-account",
  cloudSignIn: "a4k:cloud-sign-in",
  cloudSignOut: "a4k:cloud-sign-out",
  cloudRequestInvite: "a4k:cloud-request-invite",
  cloudWorkspaces: "a4k:cloud-workspaces",
  cloudGo: "a4k:cloud-go",
  cloudCommit: "a4k:cloud-commit",
  /** Take back a board the app made when this folder was opened. */
  discardBoard: "a4k:discard-board",
  /** Where `akb` stands on this machine, and the press that puts it there (#226). */
  command: "a4k:command",
  installCommand: "a4k:install-command",
  update: "a4k:update",
  /** Download the new version — nothing downloads before this (#372). */
  startUpdate: "a4k:start-update",
  /** Put it in place and restart into it. Nothing is written before this. */
  restartForUpdate: "a4k:restart-for-update",
  /** The other way: the download moved, so the notice redraws. */
  updateStatus: "a4k:update-status",
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
  /** The card link a Slack message carries (#320), on the same URL scheme. It is a channel
   *  of its own because it is answered somewhere else: the window opens the card, wherever
   *  the user is, while the sign-in answers above are the Configuration dialog's and reach
   *  it only while that dialog is open. One channel would let whichever listener happened to
   *  be there first eat the other's answer. */
  cardLink: "a4k:card-link",
  /** The board is now drawing in another language (#334), so the menu — which lives
   *  outside the page — follows. The setting itself is already saved by the time this
   *  arrives; the app reads it for itself at startup. */
  languageChanged: "a4k:language-changed",
  /** Save the language this machine reads in (#339) — the launcher's own switcher, which
   *  has no board server behind it to save through. */
  setLanguage: "a4k:set-language",
  /** Raise a system notification for each of these (#319). The page decides what to say;
   *  the app decides what actually interrupts, because focus is the app's own answer. */
  notify: "a4k:notify",
  /** A notification was clicked — the other way, like `cloudCallback`. The page opens the
   *  event it names, switching boards first when the event belongs to another one. */
  openNotification: "a4k:open-notification",
  /** The app has begun opening a project, named by its folder. Sent once the picker is
   *  out of the way, so the launcher can say what it is doing instead of sitting there:
   *  a folder with no board gets one installed here, and that is seconds of nothing.
   *  Nothing comes back and nothing clears it — every way out of an open replaces this
   *  page or ends the app. */
  opening: "a4k:opening",
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
  /** Show another of this project's boards (#407) — `marketing/kanban` beside
   *  `docs/kanban`. The same handover a project makes: the one on screen keeps
   *  running behind the window, the picked one gets its own server, and the page
   *  is replaced. Returns the folder now open. */
  openBoard(dir: string): Promise<string | null>;
  /** Take a project off the list — nothing on disk is touched. Returns the list
   *  as it now is. */
  forgetProject(dir: string): Promise<ProjectInfo[]>;
  /** Ask the user for another project folder and open it. Returns the folder
   *  now open, which is the old one when they cancelled. */
  pickRepo(): Promise<string | null>;
  /** Ask for a folder without opening it, and say what it already holds (#317). Null when
   *  the user cancelled. Onboarding's four moves all start here, and Export writes into
   *  whatever this answers with. */
  pickFolder(): Promise<CloudFolder | null>;
  /** Leave the project on screen and show the launcher — where a checkout lands when the
   *  workspace it pointed at has been deleted (#317). */
  closeProject(): Promise<null>;
  /** Which account this machine acts as (#317). Asked by onboarding, which has no board
   *  server behind it. */
  cloudAccount(): Promise<CloudAccountView>;
  /** Sign in: the app opens the consent screen and waits for its own URL scheme to answer,
   *  so one call covers the whole round trip. Answers with the account as it now stands. */
  cloudSignIn(): Promise<CloudAccountView>;
  cloudSignOut(): Promise<CloudAccountView>;
  /** Ask to be let into the preview (#327), and be handed the account again. */
  cloudRequestInvite(): Promise<CloudAccountView>;
  /** Every workspace this account has. */
  cloudWorkspaces(): Promise<{ ok: true; workspaces: CloudWorkspaceView[] } | { ok: false; error: string }>;
  /** Make or open a workspace on a folder, import its cards when asked, and point the
   *  checkout at it. The board is not opened — `openProject` is the press after. */
  cloudGo(request: CloudGoRequest): Promise<CloudGoResult>;
  /** Take the offered commit on that folder. */
  cloudCommit(dir: string): Promise<CloudMoveResult>;
  /** Make a board in the open project — the retry on "there is no board here"
   *  in a window with no terminal. */
  createBoard(): Promise<CreateBoardResult>;
  /** Wrong folder: remove the board opening it made, put the folder back as it
   *  was, and ask which project was meant. Only ever offered while `boardJustMade` — a
   *  board with an answered setup step is the user's, not the app's to remove. */
  discardBoard(): Promise<CreateBoardResult>;
  /** Where the `akb` command stands on this machine (#226). */
  command(): Promise<CommandInstall>;
  /** Put `akb` on the PATH. On macOS this is where the system asks for an
   *  administrator password, when the folder being written needs one. */
  installCommand(): Promise<CommandInstallResult>;
  /** A newer app, when one is out and the user hasn't waved this one off —
   *  including a download of it already going. */
  update(): Promise<UpdateStatus | null>;
  /** Download it. Nothing downloads until this is called. */
  startUpdate(): Promise<UpdateStatus | null>;
  /** Install it and restart into it — the app quits behind this call. */
  restartForUpdate(): Promise<null>;
  /** Be told each time the download moves, so the notice redraws. Returns the
   *  way to stop being told. */
  onUpdateStatus(fn: (status: UpdateStatus | null) => void): () => void;
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
  /** Raise a system notification for each of these (#319). The app drops the ones a focused
   *  window should not be interrupted by, and asks the operating system for permission the
   *  first time one is raised — refused, the bell and every action keep working. */
  notify(alerts: NotificationAlert[]): Promise<null>;
  /** Be told when a notification was clicked, by the id of the event it was raised for.
   *  The page opens that event exactly as clicking its row does — switching the app to that
   *  board first when the event belongs to another one. Returns the way to stop being told. */
  onOpenNotification(fn: (eventId: string) => void): () => void;
  /** Be told that a project is being opened, by the name of its folder — the launcher's,
   *  which is the page left on screen while the work happens. Returns the way to stop
   *  being told. */
  onOpening(fn: (name: string) => void): () => void;
  /** Be told when the app was opened with a card link (#320) — `ai4kanban://card/<board>/<task>`,
   *  which a Slack message carries. The window opens that board's card, switching project
   *  first when it is not the one on screen. Returns the way to stop being told. */
  onCardLink(fn: (url: string) => void): () => void;
}
