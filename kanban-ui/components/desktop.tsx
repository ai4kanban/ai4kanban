"use client";

// What the board does differently when it is running inside the desktop app —
// and what it says when it isn't.
//
// The pages are the same either way. The app (../../desktop) starts this very
// server and shows it in a window, so nothing here is a second version of
// anything: it is the few places where "there is a window around this" changes
// what we can offer.
//
//  - In the app, the folder badge in the header opens the projects list — the
//    ones you have opened before, and Open Folder for a new one. In a browser
//    there is nobody to ask, so it stays a label.
//  - In the app, a folder with no board offers to make one. In a browser that is
//    a command to type, which the screen already gives.
//  - In the app, a newer release lights one chip in the header: a click downloads
//    it, the chip fills, and the restart puts it in place (#372). A copy that
//    cannot replace itself opens the downloads page instead.
//  - In a browser, the board mentions the app and where to get it. Only
//    mentions it: running here is a supported way to run the board, not a
//    deprecated one. It is the same server either way, so there is no second
//    path being wound down — what the app saves you is the setup, and that is
//    all the line claims.
//
// Everything the app can do reaches this file through `window.ai4kanban`, put
// there by the app's preload script. It is simply absent in a browser, so every
// call below checks first.

import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiDownload, FiFolder, FiFolderPlus, FiTerminal, FiX } from "react-icons/fi";
import type { ChromeCopy } from "@/i18n/chrome/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { getBoardsAction } from "@/app/actions";
import type { BoardEntry } from "@/lib/cli";
import type { NotificationAlert } from "@/lib/notifications";
import { Button } from "./button";
import { CHROME } from "./chrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** Where a person gets the app. One place, named here, used by both notices. */
export const DOWNLOAD_URL = "https://ai4kanban.dev/download";

// --- system notifications (#319) ---------------------------------------------
// The bell decides WHAT to say; the app decides whether it interrupts. Focus is the app's
// own answer and nothing in a page can give it, so the alert is handed over whole and the
// app drops the ones it should. In a browser there is nothing to raise, and the bell keeps
// filling exactly the same.

/** Hand the app the alerts the server just handed out. Safe everywhere: a browser has no
 *  bridge, and an app older than the bell has no `notify`. */
export function raiseNotifications(alerts: NotificationAlert[]): void {
  const app = bridge();
  if (!app?.notify || alerts.length === 0) return;
  void app.notify(alerts).catch(() => {
    // A notification the system refused is one the bell already shows. Nothing to say.
  });
}

/** Open the event a clicked notification names — the same thing clicking its row does, so
 *  a notification raised by another board switches the app to that board first. */
export function useOpenNotificationFromApp(open: (eventId: string) => void): void {
  useEffect(() => {
    const app = bridge();
    if (!app?.onOpenNotification) return;
    return app.onOpenNotification(open);
  }, [open]);
}

/** Open the card a Slack message linked to. The window listens for it wherever the user is,
 *  which is why it is not the Configuration dialog's channel: that one is only listened to
 *  while the dialog is open. */
export function useCardLinkFromApp(open: (url: string) => void): void {
  useEffect(() => {
    const app = bridge();
    if (!app?.onCardLink) return;
    return app.onCardLink(open);
  }, [open]);
}

/** Which way the window moved, and so which edge it went out of. */
export type NavSide = "back" | "forward";

/** One line of the projects list, as the app describes it. */
export interface ProjectEntry {
  path: string;
  /** The folder's own name — what a person calls the project. */
  name: string;
  /** The one on screen. */
  open: boolean;
  /** An agent run is going in it, here or behind the window. */
  running: boolean;
  /** Its folder was moved or deleted since it was last opened. */
  missing: boolean;
  hasBoard: boolean;
}

/** Where the `akb` command stands on this machine (#226) — see desktop/src/lib/command.ts,
 *  which answers this. `kind` is how this system installs it at all: one symlink on macOS,
 *  a PATH entry holding the app's own folder on Windows, and no way at all on Linux. */
export interface CommandInstall {
  kind: "symlink" | "path" | "none";
  /** The path a press writes — named on screen before the press. */
  writes: string;
  /** Whether writing there raises the administrator dialog — only `/usr/local/bin` can,
   *  never a bin folder of the user's own. */
  needsPassword: boolean;
  state: "absent" | "installed" | "dangling" | "foreign";
  points: string | null;
  holder: string | null;
  /** The `akb` a terminal runs right now, when it isn't the one at our path. */
  otherFirst: string | null;
  /** Why the button is off: this app sits somewhere that won't still be there next launch. */
  blocked: string | null;
}

export interface CommandInstallResult {
  ok: boolean;
  error?: string;
  state: CommandInstall;
}

/** A newer app, and how far along installing it is (#372). Everything past the version
 *  and the link is optional: an app older than the install answers those two alone. */
export interface UpdateStatus {
  version: string;
  url: string;
  stage?: "idle" | "downloading" | "ready";
  received?: number;
  total?: number;
  /** Why this copy cannot install it itself — a checkout, a disk image, a folder it
   *  cannot write. Null when it can. */
  blocked?: string | null;
  /** What went wrong last time, said plainly. */
  error?: string | null;
}

interface AppBridge {
  info(): Promise<{
    version: string;
    platform: string;
    boardDir: string | null;
    downloadsUrl: string;
    /** This board was made when the folder was opened, and nothing has been done to it
     *  since — what `discardBoard` below is offered on. Absent in an app older
     *  than that, where the board was never made without being asked for. */
    boardJustMade?: boolean;
  }>;
  projects(): Promise<ProjectEntry[]>;
  openProject(dir: string): Promise<string | null>;
  /** Show another of this project's boards (#407) — the same handover the projects list
   *  makes: the board on screen keeps running behind the window, the picked one gets its
   *  own server, and the page is replaced. Optional — an app older than the second board
   *  knows only projects, and the badge stays a label there. */
  openBoard?(dir: string): Promise<string | null>;
  forgetProject(dir: string): Promise<ProjectEntry[]>;
  pickRepo(): Promise<string | null>;
  createBoard(): Promise<{ ok: boolean; error?: string }>;
  /** Wrong folder: remove the board opening it made, put the folder back as it was,
   *  and ask which project was meant. Optional — an older app makes no board unasked. */
  discardBoard?(): Promise<{ ok: boolean; error?: string }>;
  command(): Promise<CommandInstall>;
  installCommand(): Promise<CommandInstallResult>;
  /** A newer app, and how far along installing it is (#372). An app older than the
   *  install answers `{ version, url }` alone, which draws the link the notice always
   *  was. */
  update(): Promise<UpdateStatus | null>;
  /** Download it. Nothing downloads until this is called. Optional — an older app
   *  never installs anything itself. */
  startUpdate?(): Promise<UpdateStatus | null>;
  /** Install it and restart into it; the app quits behind this call. Optional for the
   *  same reason. */
  restartForUpdate?(): Promise<void>;
  /** Be told each time the download moves. Returns the way to stop being told.
   *  Optional for the same reason. */
  onUpdateStatus?(fn: (status: UpdateStatus | null) => void): () => void;
  openExternal(url: string): Promise<void>;
  /** Told each time the window moves between views — a swipe, the menu, a
   *  mouse's own buttons. Returns the way to stop being told. */
  onNavigated(fn: (direction: NavSide) => void): () => void;
  /** Say which language the board is now drawing in (#334), so the app's menu — which
   *  lives outside the page — follows. Optional: an app older than the setting has no ear
   *  for it, and its menu simply stays as it was. */
  languageChanged?(language: string): Promise<void>;
  /** Raise a system notification for each of these (#319). The app decides what actually
   *  interrupts: an `actionable` alert is dropped while this window is focused, an
   *  `outcome` one is raised either way. Optional — an app older than the bell raises
   *  nothing, and the bell still fills. */
  notify?(alerts: NotificationAlert[]): Promise<void>;
  /** Be told when a notification was clicked, by the id of the event it names, so the page
   *  opens it exactly as clicking its row does. Returns the way to stop being told.
   *  Optional for the same reason. */
  onOpenNotification?(fn: (eventId: string) => void): () => void;
  /** The app was opened with a card link (#320) — `ai4kanban://card/…`, which a Slack
   *  message carries. Its own channel rather than the sign-in's: the two are answered in
   *  different places, and one shared channel would let whichever listener happened to be
   *  there first take the other's answer. Optional — an app older than the link hands one
   *  to nobody, and the message's button still opens the app. */
  onCardLink?(fn: (url: string) => void): () => void;
}

declare global {
  interface Window {
    ai4kanban?: AppBridge;
  }
}

function bridge(): AppBridge | null {
  return typeof window === "undefined" ? null : (window.ai4kanban ?? null);
}

/** Open a link the way this window should: in the user's browser when we are in
 *  the app (a desktop window must never navigate away from the board), and
 *  normally otherwise. */
export function openLink(url: string) {
  const app = bridge();
  if (app) void app.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

// --- the mark a move between views leaves behind ----------------------------

/** How long the mark stays lit before it starts fading. Short: it is an answer
 *  to something the user just did, not a thing to be read. */
const NAV_EDGE_MS = 320;

/** The edge the window went out of, lit for a moment (#210).
 *
 *  In the app a two-finger swipe moves between the board and the cards, and a
 *  gesture that only ever changes the whole screen is hard to tell from a
 *  glitch. This is the answer: the side you left by lights up and fades. It
 *  also fires for the menu's Back and Forward and for a mouse's own buttons, so
 *  the same move always looks the same.
 *
 *  Both edges are always in the page and only their opacity changes — a mark
 *  that is added to the page when it is needed has nothing to fade in from.
 *  Renders nothing in a browser, which draws its own. */
export function NavEdge() {
  const [side, setSide] = useState<NavSide | null>(null);

  useEffect(() => {
    const app = bridge();
    if (!app) return;
    let dim: ReturnType<typeof setTimeout> | undefined;
    const stop = app.onNavigated((direction) => {
      setSide(direction);
      clearTimeout(dim);
      dim = setTimeout(() => setSide(null), NAV_EDGE_MS);
    });
    return () => {
      clearTimeout(dim);
      stop();
    };
  }, []);

  return (
    <>
      <div aria-hidden className="a4k-nav-edge" data-side="back" data-show={side === "back" || undefined} />
      <div
        aria-hidden
        className="a4k-nav-edge"
        data-side="forward"
        data-show={side === "forward" || undefined}
      />
    </>
  );
}

// --- the folder badge, and the projects behind it ---------------------------

// Two pixels shorter than the controls on the other side of the row: it is the
// one thing in the header that is read rather than pressed, and a step behind
// them is enough to say so without breaking the row.
// `a4k-nodrag`: in the app on macOS the header is the window's title bar, so a
// badge that is a button — the projects list — has to say it isn't the part you
// drag the window by (app/globals.css). Harmless on the plain label and in a
// browser.
// The one rounded frame, and the two controls inside it. They are side by side
// rather than nested: a button inside a button has no honest hit area, and each
// of these opens a different list — the path opens the projects, the badge opens
// this project's boards (#407).
const CHIP =
  "a4k-nodrag hidden h-[26px] min-w-0 items-center rounded-full font-mono text-[11px] text-nb-ink-soft sm:flex";
const PART = "flex h-full min-w-0 items-center gap-1.5 px-2.5";
const BADGE_STYLE = {
  background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
};
const DIVIDER = { borderLeft: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)" };

/** Which repo this board is, in the header, and which of its boards is open.
 *
 *  In the app the path is the button that opens the projects list — the app has
 *  no terminal to be restarted from, so this is how a window is pointed at a
 *  different folder. It shows the folder name on a narrow window and the whole
 *  path on a wide one, the same either way.
 *
 *  Beside it, the board's own word: "Engineering" on a product board, "Marketing"
 *  on a marketing one, cut to "Eng" on the same break the path takes. A project
 *  holding one board gets a label; one holding two gets a switcher, and picking
 *  the other hands the window over the way the projects list does. */
export function ProjectPath({ projectRoot, desktop }: { projectRoot: string; desktop: boolean }) {
  const path = (
    <>
      <FiFolder className="shrink-0 opacity-70" size={12} />
      <span className="truncate lg:hidden">{projectRoot.split("/").pop()}</span>
      <span className="hidden truncate lg:inline">{projectRoot}</span>
    </>
  );
  return (
    <span className={CHIP} style={BADGE_STYLE}>
      {desktop ? (
        <ProjectsMenu projectRoot={projectRoot}>{path}</ProjectsMenu>
      ) : (
        <span title={projectRoot} className={PART}>
          {path}
        </span>
      )}
      <BoardBadge desktop={desktop} />
    </span>
  );
}

// --- the board badge, and the boards behind it -------------------------------

/** Which board of this project is open, and — in the app, when the project holds
 *  more than one — the switcher onto the others (#407).
 *
 *  Read after the page paints rather than handed down as a prop: it is one word
 *  in the chrome, the same on every screen, and threading it through every page
 *  and every window would be a prop nine components pass on and one reads. A
 *  board whose rules are too old to know about boards answers with none, and the
 *  chip is exactly the chip it always was. */
function BoardBadge({ desktop }: { desktop: boolean }) {
  const c = useCopy().chrome.boards;
  const [here, setHere] = useState<{ board: string; boards: BoardEntry[] } | null>(null);

  useEffect(() => {
    let live = true;
    void getBoardsAction()
      .then((answer) => live && setHere(answer))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const open = here?.boards.find((b) => b.path === here.board);
  if (!open) return null;

  const word = (
    <>
      <span className="truncate lg:hidden">{open.short}</span>
      <span className="hidden truncate lg:inline">{open.work}</span>
    </>
  );
  // One board is a label with nothing to press, and so is a browser either way:
  // switching hands the whole window over, which only the app can do.
  const others = here!.boards.filter((b) => b.path !== here!.board);
  if (!desktop || others.length === 0 || !bridge()?.openBoard) {
    return (
      <span title={here!.board} className={PART} style={DIVIDER}>
        {word}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={c.badge(here!.board)}
          className={`${PART} max-w-full cursor-pointer hover:text-nb-ink`}
          style={DIVIDER}
        >
          {word}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(28rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel>{c.heading}</DropdownMenuLabel>
        {here!.boards.map((b) => (
          <DropdownMenuItem
            key={b.path}
            className={`flex-col items-stretch gap-0 font-[400] ${b.path === here!.board ? "cursor-default" : ""}`}
            title={b.path}
            onSelect={(e) => (b.path === here!.board ? e.preventDefault() : void bridge()?.openBoard?.(b.path))}
          >
            <span className="flex items-center gap-1.5">
              {b.path === here!.board && <Dot tone="var(--color-nb-accent)" title={c.openHere} />}
              <span className="truncate font-[700] text-nb-ink">{b.work}</span>
            </span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-nb-ink-soft">{b.path}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The projects list (#178): the ones already opened, and Open Folder for one
 *  that isn't. It hangs off the folder badge because that badge is already the
 *  header's answer to "which board is this" — the list is the same question with
 *  every answer showing.
 *
 *  Each line is the project's name over its path, since two folders can share a
 *  name. Two things get said on the line: a run is going in it — including one
 *  still working behind the window in a project you have switched away from —
 *  and its folder has gone, in which case the only thing offered is taking the
 *  line off the list.
 *
 *  Picking one hands the whole window to the app, which loads that project's own
 *  board. Nothing here re-renders into the new project; the page is replaced.
 *
 *  It is the board's own dropdown (ui/dropdown-menu) rather than a panel of its
 *  own, so it dismisses the way every other menu here does — outside click,
 *  Escape, focus returned to the badge — and reads as the same object. A
 *  hand-rolled version can't get the first of those right from inside the
 *  header: the header is backdrop-blurred, and a backdrop-filter makes its box
 *  the containing block for `fixed` children, so a full-screen click catcher
 *  covers only the header strip. This menu portals out to <body> instead. */
function ProjectsMenu({ projectRoot, children }: { projectRoot: string; children: React.ReactNode }) {
  const c = useCopy().chrome.projects;
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);

  // Every answer ends the "reading…" line, including no answer at all: the app
  // says it is the app (KANBAN_DESKTOP=1, read on the server), so a window with
  // no bridge on it is the app's own preload having failed, and the list would
  // otherwise sit there reading forever.
  const reload = useCallback(() => {
    const app = bridge();
    if (!app) return setProjects([]);
    app.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    // Read the list on opening, not on mount: it says what is true right now (a
    // run that has since finished, a folder since deleted), and nobody is
    // looking at it the rest of the time. The last answer stays on screen while
    // the new one is fetched, so reopening doesn't flash "reading…".
    <DropdownMenu onOpenChange={(o) => o && reload()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={c.badge(projectRoot)}
          className={`${PART} max-w-full cursor-pointer hover:text-nb-ink`}
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      {/* No width of its own: the panel is as wide as its longest path, up to
          what the window can hold, and paths past that ellipsise. A fixed width
          was either too wide for `~/x` or too narrow for a real checkout. */}
      <DropdownMenuContent align="start" className="max-w-[min(28rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel>{c.heading}</DropdownMenuLabel>
        <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
          {projects === null && <Line muted>{c.reading}</Line>}
          {projects?.length === 0 && <Line muted>{c.onlyThisOne}</Line>}
          {projects?.map((p) => (
            <ProjectRow
              key={p.path}
              project={p}
              onOpen={() => void bridge()?.openProject(p.path)}
              onForget={() => {
                bridge()
                  ?.forgetProject(p.path)
                  .then(setProjects)
                  .catch(reload);
              }}
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 py-2" onSelect={() => void bridge()?.pickRepo()}>
          <FiFolderPlus aria-hidden className="size-[1em] shrink-0" /> {c.openFolder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectRow({
  project,
  onOpen,
  onForget,
}: {
  project: ProjectEntry;
  onOpen: () => void;
  onForget: () => void;
}) {
  const c = useCopy().chrome.projects;
  const { name, path, open, running, missing } = project;
  // The board on screen and a folder that has gone are both rows with nothing to
  // open. They stay in the list, and keep their hover, because each still says
  // something — which one you are on, and which one to take off — but picking
  // them does nothing, so they don't offer a pointer.
  const inert = open || missing;
  return (
    <DropdownMenuItem
      className={`group flex-col items-stretch gap-0 pr-8 font-[400] ${inert ? "cursor-default" : ""}`}
      title={missing ? c.missing(path) : path}
      onSelect={(e) => (inert ? e.preventDefault() : onOpen())}
      // The ✕ is a pointer target inside a menu row, where the keyboard can't
      // reach it — Tab leaves the menu. Delete is the same verb for the hands
      // already on the arrow keys.
      onKeyDown={(e) => {
        if (open || (e.key !== "Delete" && e.key !== "Backspace")) return;
        e.preventDefault();
        onForget();
      }}
    >
      <span className="flex items-center gap-1.5">
        {open && <Dot tone="var(--color-nb-accent)" title={c.openHere} />}
        {!open && running && <Dot tone="var(--color-nb-mint-ink)" title={c.runningHere} pulse />}
        {missing && <FiAlertTriangle size={12} className="shrink-0 text-nb-ink-soft" />}
        <span className="truncate font-[700] text-nb-ink">{name}</span>
        {missing && <span className="shrink-0 text-[11px] text-nb-ink-soft">{c.missingLabel}</span>}
      </span>
      <span className="mt-0.5 block truncate font-mono text-[11px] text-nb-ink-soft">{path}</span>
      {/* The open project has no ✕: forgetting the board on screen would leave
          the window showing a project the list no longer has. */}
      {!open && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onForget();
          }}
          // Every pointer event the row would read as "picked" — the menu must
          // stay open, and the row underneath must not be opened.
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          title={c.forget}
          className="absolute right-1.5 top-1/2 shrink-0 -translate-y-1/2 cursor-pointer rounded-[6px] p-1.5 text-nb-ink-soft opacity-0 hover:text-nb-ink group-hover:opacity-100 group-data-[highlighted]:opacity-100"
        >
          <FiX size={13} />
        </button>
      )}
    </DropdownMenuItem>
  );
}

function Dot({ tone, title, pulse = false }: { tone: string; title: string; pulse?: boolean }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`h-[7px] w-[7px] shrink-0 rounded-full ${pulse ? "animate-pulse" : ""}`}
      style={{ background: tone }}
    />
  );
}

function Line({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <p className={`px-2.5 py-2 text-[13px] ${muted ? "text-nb-ink-soft" : "text-nb-ink"}`}>
      {children}
    </p>
  );
}

// --- the notice line --------------------------------------------------------

/** The one line above the board that says something about how it is being run.
 *  In a browser that is the app's existence; in the app it is nothing — a newer
 *  version is the header's chip, not a band across the board. */
export function RunningNotice({ desktop }: { desktop: boolean }) {
  return desktop ? null : <AppAvailable />;
}

// --- the update chip --------------------------------------------------------

/** A newer app, and the one click that installs it (#372) — a single 28px control
 *  in the header's row, never a band across the board. It is news, not a demand:
 *  the whole thing is one icon that lights, fills and turns green, and a user who
 *  ignores it forever loses nothing.
 *
 *  Four states, one control:
 *
 *      out          downloading        ready          cannot install
 *    ┌──────┐        ┌──────┐      ┌────────────┐      ┌──────┐
 *    │  ↓   │  ···>  │  ◔   │ ···> │ ✓ Install  │      │  ↓   │
 *    └──────┘        └──────┘      └────────────┘      └──────┘
 *     sky, lit        the ring       mint, named        plain — opens the page
 *
 *  The download is the app's, not this component's: it is asked for on mount and
 *  followed as it moves, so leaving the board for a card, coming back, or reloading
 *  either finds the same download exactly where it was. */
export function UpdateChip() {
  const c = useCopy().chrome.update;
  const [found, setFound] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    const app = bridge();
    if (!app) return;
    // Asked once per window. The app answers from a check it made when it
    // started, so this costs nothing and never blocks the board.
    app
      .update()
      .then(setFound)
      .catch(() => {});
    return app.onUpdateStatus?.(setFound);
  }, []);
  if (!found) return null;
  const stage = found.stage ?? "idle";
  const total = found.total ?? 0;
  const percent = total ? Math.min(100, Math.floor(((found.received ?? 0) / total) * 100)) : 0;

  if (stage === "downloading") {
    return (
      <Chip
        title={c.downloading(percent)}
        tint="var(--color-nb-sky-soft)"
        ink="var(--color-nb-sky-ink)"
        role="progressbar"
        percent={percent}
      >
        <Ring percent={percent} />
      </Chip>
    );
  }
  if (stage === "ready") {
    return (
      <Chip
        title={c.ready(found.version)}
        tint="var(--color-nb-mint-soft)"
        ink="var(--color-nb-mint-ink)"
        onClick={() => void bridge()?.restartForUpdate?.()}
        wide
      >
        <FiDownload size={13} aria-hidden />
        <span className="text-[11.5px] font-[800] leading-none">{c.install}</span>
      </Chip>
    );
  }

  // A copy that cannot replace itself keeps the one thing it can offer: the
  // downloads page. It is the same chip, unlit — nothing is being asked of the
  // user that this copy can actually do.
  const canInstall = !found.blocked && Boolean(bridge()?.startUpdate);
  if (!canInstall) {
    return (
      <Chip
        title={c.outManual(found.version, found.blocked ?? "")}
        onClick={() => openLink(found.url)}
      >
        <FiDownload size={14} aria-hidden />
      </Chip>
    );
  }
  const failed = Boolean(found.error);
  return (
    <Chip
      title={failed ? c.failed(found.error ?? "") : c.out(found.version)}
      tint={failed ? "var(--color-nb-peach-soft)" : "var(--color-nb-sky-soft)"}
      ink={failed ? "var(--color-nb-peach-ink)" : "var(--color-nb-sky-ink)"}
      lit={!failed}
      onClick={() => {
        // Draw the download the moment it is asked for; the app's own messages
        // carry it from here.
        setFound({ ...found, stage: "downloading", received: 0, error: null });
        void bridge()?.startUpdate?.();
      }}
    >
      {failed ? <FiAlertTriangle size={14} aria-hidden /> : <FiDownload size={14} aria-hidden />}
    </Chip>
  );
}

/** The chip itself: one framed 28px box in the header's row, in whatever tone the
 *  state calls for. `lit` adds the glow that says "this is new" — a slow one, since
 *  the point is to be noticed on the next glance, not this one. */
function Chip({
  title,
  tint,
  ink,
  lit = false,
  wide = false,
  percent,
  role,
  onClick,
  children,
}: {
  title: string;
  tint?: string;
  ink?: string;
  lit?: boolean;
  wide?: boolean;
  percent?: number;
  role?: "progressbar";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const still = !onClick;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={still}
      onClick={onClick}
      role={role}
      aria-valuenow={percent}
      aria-valuemin={role ? 0 : undefined}
      aria-valuemax={role ? 100 : undefined}
      className={`a4k-nodrag relative inline-flex h-7 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[8px] ${CHROME} ${
        wide ? "px-2" : "w-7"
      } ${still ? "cursor-default" : "cursor-pointer hover:brightness-[0.97] active:translate-y-[1px]"} ${
        lit ? "a4k-lit" : ""
      }`}
      style={{ background: tint ?? "var(--color-nb-paper)", color: ink ?? "var(--color-nb-ink)" }}
    >
      {children}
    </button>
  );
}

/** How far the download has got, drawn as the chip itself rather than beside it —
 *  the ring is the icon while it runs. */
function Ring({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 8;
  return (
    <svg viewBox="0 0 22 22" className="size-[17px] -rotate-90" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="8"
        fill="none"
        strokeWidth="2.5"
        stroke="color-mix(in srgb, currentColor 22%, transparent)"
      />
      <circle
        cx="11"
        cy="11"
        r="8"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

const DISMISS_KEY = "kanban-ui.app-available-dismissed";

/** An offer, not a warning. The app is the easier way in for someone who would
 *  rather not keep a terminal open — but this way is the same board off the
 *  same server, and it is what a remote box, a container and anyone working on
 *  these pages actually uses. So the line points at the app and stops there. */
function AppAvailable() {
  const c = useCopy().chrome.app;
  // Start hidden and reveal after mount: sessionStorage doesn't exist during
  // SSR, so reading it in the first render would mismatch the server markup.
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  if (hidden) return null;
  return (
    <Strip tone="sky">
      <span>
        <Rich>{c.notice}</Rich>
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0"
        onClick={() => openLink(DOWNLOAD_URL)}
      >
        <FiDownload size={13} /> {c.get}
      </Button>
      <Close
        title={c.hide}
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setHidden(true);
        }}
      />
    </Strip>
  );
}

// The same band the board already uses for an error, in the tone that fits:
// sky for news, peach for something the user should act on eventually.
function Strip({ tone, children }: { tone: "sky" | "peach"; children: React.ReactNode }) {
  return (
    <div
      className="mx-4 mt-4 flex items-center gap-3 nb-panel-sm p-3 text-[13px] leading-relaxed sm:mx-6"
      style={{ background: `var(--color-nb-${tone}-soft)` }}
    >
      {children}
    </div>
  );
}

function Close({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="shrink-0 cursor-pointer rounded-[6px] p-1 text-nb-ink-soft hover:text-nb-ink"
    >
      <FiX size={14} />
    </button>
  );
}

// --- the "no board here" screen ---------------------------------------------

/** In the app, the way out of the "no board here" screen is a button: pick
 *  another folder. In a browser it is a command to run, which is what the screen
 *  already says. Returns null outside the app so that screen keeps its own
 *  wording untouched.
 *
 *  Sized to fill its card on that screen (components/NoBoard.tsx), which is the
 *  only place either of these two is used. */
export function PickAnotherProject({ desktop }: { desktop: boolean }) {
  const c = useCopy().chrome.noBoard;
  if (!desktop) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={() => void bridge()?.pickRepo()}
    >
      <FiFolder size={14} /> {c.pickAnother}
    </Button>
  );
}

/** Make a board in the folder that is open (#178). In a browser this is `npx
 *  ai4kanban install`, typed in a terminal — which a window doesn't have, so the
 *  app carries the installer and runs it here. It scaffolds `docs/kanban/` and
 *  puts setup's own checklist in it; the page reloads onto the new board, which
 *  opens on the guided first run (#172).
 *
 *  Null outside the app: the browser screen keeps the command it already gives. */
export function MakeBoardHere({ desktop }: { desktop: boolean }) {
  const c = useCopy().chrome.noBoard;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!desktop) return null;
  return (
    <div>
      <Button
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          bridge()
            ?.createBoard()
            .then((res) => {
              // A board that was made reloads the window from the app's side,
              // so there is nothing to do here but keep the button quiet until
              // the new page arrives.
              if (!res.ok) {
                setError(res.error ?? c.makeFailed);
                setBusy(false);
              }
            })
            .catch((e) => {
              setError(String(e));
              setBusy(false);
            });
        }}
      >
        <FiFolderPlus size={14} /> {busy ? c.making : c.make}
      </Button>
      {error && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border-[1.5px] border-nb-ink bg-nb-peach-soft px-2.5 py-1.5 text-[11.5px] leading-relaxed text-nb-ink">
          {error}
        </pre>
      )}
    </div>
  );
}

/** The way back out of a folder opened by mistake.
 *
 *  Opening a folder with no board makes one there rather than asking — one step into the
 *  board instead of two — and this is what pays for that. While the board is still the
 *  app's own work and none of the user's, one press removes it, puts the folder back as it
 *  was, and asks which project was meant.
 *
 *  It draws nothing in a browser, nothing on a board this window didn't just make, and
 *  nothing once setup has an answer in it — the caller decides that last one, because the
 *  answers are on its screen. */
export function DiscardNewBoard({ shape = "button" }: { shape?: "button" | "link" }) {
  const c = useCopy().chrome.noBoard;
  const [offered, setOffered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = bridge();
    if (!app?.discardBoard) return;
    let alive = true;
    app
      .info()
      .then((info) => alive && setOffered(Boolean(info.boardJustMade)))
      // An app that can't say leaves the button off, which is the safe way round: the
      // board stays where it is and Open Folder is still on the folder badge.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const discard = () => {
    setBusy(true);
    setError(null);
    bridge()
      ?.discardBoard?.()
      // A board that went comes back as the launcher with the folder picker over it, so
      // there is nothing left to draw here but a failure.
      .then((res) => {
        if (!res.ok) {
          setError(res.error ?? c.discardFailed);
          setBusy(false);
        }
      })
      .catch((e) => {
        setError(String(e));
        setBusy(false);
      });
  };

  if (!offered) return null;
  // Two shapes for the two screens setup has: a button on the rail, where the way out to
  // the board is a button too, and a link in the conversation's row of ways out.
  return (
    <div className={shape === "link" ? "flex items-center gap-3" : undefined}>
      {shape === "link" ? (
        <button
          type="button"
          title={c.discardHint}
          disabled={busy}
          onClick={discard}
          className="cursor-pointer text-[13px] font-[700] text-nb-ink-soft underline-offset-2 hover:text-nb-ink hover:underline"
        >
          {busy ? c.discarding : c.discard}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          title={c.discardHint}
          disabled={busy}
          onClick={discard}
        >
          <FiFolder size={14} /> {busy ? c.discarding : c.discard}
        </Button>
      )}
      {error && <p className="mt-2 text-[11.5px] leading-relaxed text-nb-ink-soft">{error}</p>}
    </div>
  );
}

// --- putting `akb` on the PATH ----------------------------------------------

/** The button on the `akb` command row of Configuration → General that installs the board's
 *  command, and the four things it can find on this machine (#226).
 *
 *  The app carries `akb` already — installing only points the system at it, so nothing is
 *  copied out and updating the app updates the command. On macOS that is one symlink — in
 *  a user-owned bin folder the PATH already reads when there is one, else at
 *  `/usr/local/bin/akb` with the system's own password dialog; on Windows it is the app's
 *  own `bin` folder on the user's PATH.
 *
 *  Renders nothing in a browser and nothing on Linux, where an AppImage unpacks itself
 *  somewhere new every run and there is no lasting path to point at. Both keep the
 *  `npm install -g` line the group already gives.
 *
 *  `onFixable` says whether a press would put a working `akb` on the PATH, so the group can
 *  drop the line to type when there is a button instead. `onNote` hands out what a press
 *  found, because the button sits in a row too narrow to say it. */
export function InstallCommand({
  onInstalled,
  onFixable,
  onNote,
}: {
  onInstalled?: () => void;
  onFixable?: (fixable: boolean) => void;
  onNote?: (note: { ok: boolean; text: string } | null) => void;
}) {
  const c = useCopy().chrome.command;
  const [state, setState] = useState<CommandInstall | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const app = bridge();
    if (!app) return;
    app.command().then(setState).catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  // What the button can and can't put right, told to whoever draws the paragraph under it.
  // An `akb` that came from somewhere else stays that machine's business: writing our path
  // wouldn't change which one a terminal runs.
  const fixable =
    !!state &&
    state.kind !== "none" &&
    !state.blocked &&
    !state.otherFirst &&
    (state.state === "absent" || state.state === "dangling");
  useEffect(() => onFixable?.(fixable), [fixable, onFixable]);

  if (!fixable) return null;

  // Plain words on the button, like its neighbour that adds the skill — the backticks the
  // card spells it with are markdown, and a button is not prose.
  const label =
    state.state === "dangling" ? c.repair : state.state === "installed" ? c.writeAgain : c.install;

  const install = () => {
    if (busy) return;
    setBusy(true);
    onNote?.(null);
    bridge()
      ?.installCommand()
      .then((res) => {
        setState(res.state);
        if (res.ok) {
          onNote?.({ ok: true, text: res.state.kind === "path" ? c.donePath : c.doneSymlink });
          // The PATH has changed under the rest of the group: the notice about a missing or
          // old `akb` is read from the command itself, and it has to be asked again.
          onInstalled?.();
        } else {
          onNote?.({ ok: false, text: res.error ?? c.failed });
        }
      })
      .catch((e) => onNote?.({ ok: false, text: e instanceof Error ? e.message : String(e) }))
      .finally(() => setBusy(false));
  };

  return (
    // The button's own words are the whole message in the row; what this machine actually
    // has — the path, and the app a dangling link points at — is a hover away rather than a
    // paragraph nobody reads twice.
    <Button size="sm" disabled={busy} title={commandHeadline(state, c.state)} onClick={install}>
      {busy ? c.writing : <><FiTerminal className="text-[13px]" aria-hidden />{label}</>}
    </Button>
  );
}

/** Which of the four this machine is, in one line. `blocked` is the app's own words,
 *  which stay as they come. */
function commandHeadline(state: CommandInstall, c: ChromeCopy["command"]["state"]): string {
  if (state.blocked) return state.blocked;
  const holder = state.holder ?? c.holderUnknown;
  switch (state.state) {
    case "installed":
      return c.installed(state.writes);
    case "dangling":
      return c.dangling(state.writes, state.points ?? "");
    case "foreign":
      // The npm note only fits the system path — npm's global bin is /usr/local/bin, not
      // a bin folder of the user's own.
      return state.writes === "/usr/local/bin/akb"
        ? c.foreignNpm(state.writes, holder)
        : c.foreign(state.writes, holder);
    default:
      return c.absent;
  }
}
