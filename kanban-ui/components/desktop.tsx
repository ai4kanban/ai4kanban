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
//  - In the app, a newer release says so, with a link to the download. The app
//    never updates itself.
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
import { FiAlertTriangle, FiCheck, FiDownload, FiFolder, FiFolderPlus, FiTerminal, FiX } from "react-icons/fi";
import { Button } from "./button";
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

interface AppBridge {
  info(): Promise<{ version: string; platform: string; boardDir: string | null; downloadsUrl: string }>;
  projects(): Promise<ProjectEntry[]>;
  openProject(dir: string): Promise<string | null>;
  forgetProject(dir: string): Promise<ProjectEntry[]>;
  pickRepo(): Promise<string | null>;
  createBoard(): Promise<{ ok: boolean; error?: string }>;
  command(): Promise<CommandInstall>;
  installCommand(): Promise<CommandInstallResult>;
  update(): Promise<{ version: string; url: string } | null>;
  skipUpdate(version: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** Told each time the window moves between views — a swipe, the menu, a
   *  mouse's own buttons. Returns the way to stop being told. */
  onNavigated(fn: (direction: NavSide) => void): () => void;
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
function openLink(url: string) {
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
const BADGE =
  "a4k-nodrag hidden h-[26px] min-w-0 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-nb-ink-soft sm:flex";
const BADGE_STYLE = {
  background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
};

/** Which repo this board is, in the header. In the app it is the button that
 *  opens the projects list — the app has no terminal to be restarted from, so
 *  this is how a window is pointed at a different folder. It shows the folder
 *  name on a narrow window and the whole path on a wide one, the same either
 *  way. */
export function ProjectPath({ projectRoot, desktop }: { projectRoot: string; desktop: boolean }) {
  const inner = (
    <>
      <FiFolder className="shrink-0 opacity-70" size={12} />
      <span className="truncate lg:hidden">{projectRoot.split("/").pop()}</span>
      <span className="hidden truncate lg:inline">{projectRoot}</span>
    </>
  );

  if (!desktop) {
    return (
      <span title={`${projectRoot}/docs/kanban`} className={BADGE} style={BADGE_STYLE}>
        {inner}
      </span>
    );
  }
  return <ProjectsMenu projectRoot={projectRoot}>{inner}</ProjectsMenu>;
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
          title={`${projectRoot}/docs/kanban — click for your projects`}
          className={`${BADGE} max-w-full cursor-pointer hover:text-nb-ink`}
          style={BADGE_STYLE}
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      {/* No width of its own: the panel is as wide as its longest path, up to
          what the window can hold, and paths past that ellipsise. A fixed width
          was either too wide for `~/x` or too narrow for a real checkout. */}
      <DropdownMenuContent align="start" className="max-w-[min(28rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
          {projects === null && <Line muted>Reading your projects…</Line>}
          {projects?.length === 0 && <Line muted>Only this one so far.</Line>}
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
          <FiFolderPlus aria-hidden className="size-[1em] shrink-0" /> Open folder…
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
  const { name, path, open, running, missing } = project;
  // The board on screen and a folder that has gone are both rows with nothing to
  // open. They stay in the list, and keep their hover, because each still says
  // something — which one you are on, and which one to take off — but picking
  // them does nothing, so they don't offer a pointer.
  const inert = open || missing;
  return (
    <DropdownMenuItem
      className={`group flex-col items-stretch gap-0 pr-8 font-[400] ${inert ? "cursor-default" : ""}`}
      title={missing ? `${path} — the folder is gone` : path}
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
        {open && <Dot tone="var(--color-nb-accent)" title="Open in this window" />}
        {!open && running && <Dot tone="var(--color-nb-mint-ink)" title="A session is going here" pulse />}
        {missing && <FiAlertTriangle size={12} className="shrink-0 text-nb-ink-soft" />}
        <span className="truncate font-[700] text-nb-ink">{name}</span>
        {missing && <span className="shrink-0 text-[11px] text-nb-ink-soft">folder is gone</span>}
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
          title="Take this project off the list — nothing on disk is touched"
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

/** The one line above the board that says something about how it is being run:
 *  a newer app in the app, the app itself in a browser. Nothing at all once
 *  there is nothing to say. Rendered on both the board and a card page, since
 *  either is where a person may be standing. */
export function RunningNotice({ desktop }: { desktop: boolean }) {
  return desktop ? <UpdateNotice /> : <AppAvailable />;
}

function UpdateNotice() {
  const [found, setFound] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    // Asked once per window. The app answers from a check it made when it
    // started, so this costs nothing and never blocks the board.
    bridge()
      ?.update()
      .then(setFound)
      .catch(() => {});
  }, []);
  if (!found) return null;
  return (
    <Strip tone="sky">
      <span>
        <strong>AI4Kanban {found.version}</strong> is out. The app never updates itself — get the
        new one when you want it.
      </span>
      <Button size="sm" className="shrink-0" onClick={() => openLink(found.url)}>
        <FiDownload size={13} /> Download
      </Button>
      <Close
        title="Don't mention this version again"
        onClick={() => {
          void bridge()?.skipUpdate(found.version);
          setFound(null);
        }}
      />
    </Strip>
  );
}

const DISMISS_KEY = "kanban-ui.app-available-dismissed";

/** An offer, not a warning. The app is the easier way in for someone who would
 *  rather not keep a terminal open — but this way is the same board off the
 *  same server, and it is what a remote box, a container and anyone working on
 *  these pages actually uses. So the line points at the app and stops there. */
function AppAvailable() {
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
        <strong>There&rsquo;s a desktop app for this.</strong> The same board in a window, with
        nothing to install first — no Node, no npx, no terminal to keep alive. Running it here
        works and stays supported.
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0"
        onClick={() => openLink(DOWNLOAD_URL)}
      >
        <FiDownload size={13} /> Get the app
      </Button>
      <Close
        title="Hide until this tab is reopened"
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
  if (!desktop) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={() => void bridge()?.pickRepo()}
    >
      <FiFolder size={14} /> Open another project…
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
                setError(res.error ?? "the board could not be made");
                setBusy(false);
              }
            })
            .catch((e) => {
              setError(String(e));
              setBusy(false);
            });
        }}
      >
        <FiFolderPlus size={14} /> {busy ? "Making the board…" : "Make a board here"}
      </Button>
      {error && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border-[1.5px] border-nb-ink bg-nb-peach-soft px-2.5 py-1.5 text-[11.5px] leading-relaxed text-nb-ink">
          {error}
        </pre>
      )}
    </div>
  );
}

// --- putting `akb` on the PATH ----------------------------------------------

/** The button in Configuration → Setup that installs the board's command, and the four things it
 *  can find on this machine (#226).
 *
 *  The app carries `akb` already — installing only points the system at it, so nothing is
 *  copied out and updating the app updates the command. On macOS that is one symlink — in
 *  a user-owned bin folder the PATH already reads when there is one, else at
 *  `/usr/local/bin/akb` with the system's own password dialog; on Windows it is the app's
 *  own `bin` folder on the user's PATH.
 *
 *  Renders nothing in a browser and nothing on Linux, where an AppImage unpacks itself
 *  somewhere new every run and there is no lasting path to point at. Both keep the
 *  `npm install -g` line the pane already gives.
 *
 *  `onFixable` says whether a press would put a working `akb` on the PATH, so the paragraph
 *  under it can point at the button instead of handing over a line to type. */
export function InstallCommand({
  onInstalled,
  onFixable,
}: {
  onInstalled?: () => void;
  onFixable?: (fixable: boolean) => void;
}) {
  const [state, setState] = useState<CommandInstall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    state.state === "dangling" ? "Repair it" : state.state === "installed" ? "Write it again" : "Install the akb command";

  const install = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    bridge()
      ?.installCommand()
      .then((res) => {
        setState(res.state);
        if (res.ok) setDone(true);
        else setError(res.error ?? "the command was not installed");
        // The PATH has changed under the rest of the pane: the notice about a missing or
        // old `akb` is read from the command itself, and it has to be asked again.
        if (res.ok) onInstalled?.();
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="rounded-[10px] bg-nb-peach-soft p-3">
      <div className="flex items-center justify-between gap-4 max-sm:items-start max-sm:flex-col">
        <div>
          <p className="text-[12.5px] font-[700] text-nb-peach-ink">Connect the akb command</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-nb-ink-soft">{commandHeadline(state)}</p>
        </div>
        <Button size="sm" disabled={busy} onClick={install}>
          {busy ? "Writing…" : <>{<FiTerminal className="text-[13px]" aria-hidden />}{label}</>}
        </Button>
      </div>
      {done && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-nb-mint-ink">
          <FiCheck className="mt-[3px] shrink-0" aria-hidden />
          <span>
            {state.kind === "path"
              ? "Done. Open a new terminal and run `akb version`."
              : "Done. Run `akb version` in a terminal — typing `akb` on its own opens this app on the project you are standing in."}
          </span>
        </p>
      )}
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
          <FiAlertTriangle className="mt-[3px] shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Which of the four this machine is, in one line. */
function commandHeadline(state: CommandInstall): string {
  if (state.blocked) return state.blocked;
  switch (state.state) {
    case "installed":
      return `Installed at ${state.writes}.`;
    case "dangling":
      return `Installed at ${state.writes}, but it points at an app that is no longer there — ${state.points}.`;
    case "foreign":
      // The npm note only fits the system path — npm's global bin is /usr/local/bin, not
      // a bin folder of the user's own.
      return `${state.writes} is held by ${state.holder ?? "something the app didn't put there"}${state.writes === "/usr/local/bin/akb" ? " — an `akb` installed from npm lands at that same path, so this is yours to sort out" : " — this is yours to sort out"}.`;
    default:
      return "Not installed — your terminal has no `akb` from this app.";
  }
}
