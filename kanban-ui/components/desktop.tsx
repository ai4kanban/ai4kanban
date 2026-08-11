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
import { FiAlertTriangle, FiDownload, FiFolder, FiFolderPlus, FiX } from "react-icons/fi";
import { Button } from "./button";

/** Where a person gets the app. One place, named here, used by both notices. */
export const DOWNLOAD_URL = "https://ai4kanban.dev/download";

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

interface AppBridge {
  info(): Promise<{ version: string; platform: string; boardDir: string | null; downloadsUrl: string }>;
  projects(): Promise<ProjectEntry[]>;
  openProject(dir: string): Promise<string | null>;
  forgetProject(dir: string): Promise<ProjectEntry[]>;
  pickRepo(): Promise<string | null>;
  createBoard(): Promise<{ ok: boolean; error?: string }>;
  update(): Promise<{ version: string; url: string } | null>;
  skipUpdate(version: string): Promise<void>;
  openExternal(url: string): Promise<void>;
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

// --- the folder badge, and the projects behind it ---------------------------

const BADGE =
  "hidden min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-nb-ink-soft sm:flex";
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
 *  board. Nothing here re-renders into the new project; the page is replaced. */
function ProjectsMenu({ projectRoot, children }: { projectRoot: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);

  const reload = useCallback(() => {
    bridge()
      ?.projects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  // Read the list when the menu opens, not on mount: it says what is true right
  // now (a run that has since finished, a folder since deleted), and nobody is
  // looking at it the rest of the time.
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  // Escape closes it, and so does a click anywhere else — the same two ways out
  // every other panel on the board has.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative hidden min-w-0 sm:block">
      <button
        type="button"
        title={`${projectRoot}/docs/kanban — click for your projects`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${BADGE} max-w-full cursor-pointer hover:text-nb-ink`}
        style={BADGE_STYLE}
      >
        {children}
      </button>
      {open && (
        <>
          {/* Click anywhere else to close. Escape does it too (above), so this
              catcher carries no keyboard duty of its own. */}
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[340px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1 shadow-[3px_3px_0_0_var(--color-nb-ink)]">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-[700] uppercase tracking-wide text-nb-ink-soft">
              Projects
            </p>
            <div className="max-h-[50vh] overflow-y-auto">
              {projects === null && <Line muted>Reading your projects…</Line>}
              {projects?.length === 0 && <Line muted>Only this one so far.</Line>}
              {projects?.map((p) => (
                <ProjectRow
                  key={p.path}
                  project={p}
                  onOpen={() => {
                    setOpen(false);
                    void bridge()?.openProject(p.path);
                  }}
                  onForget={() => {
                    bridge()
                      ?.forgetProject(p.path)
                      .then(setProjects)
                      .catch(reload);
                  }}
                />
              ))}
            </div>
            <div className="-mx-1 my-1 h-px bg-nb-ink/12" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void bridge()?.pickRepo();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-[600] text-nb-ink hover:bg-nb-wash"
            >
              <FiFolderPlus size={14} /> Open folder…
            </button>
          </div>
        </>
      )}
    </div>
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
  return (
    <div className="group flex items-center gap-1 rounded-[7px] pr-1 hover:bg-nb-wash">
      <button
        type="button"
        disabled={missing || open}
        onClick={onOpen}
        title={missing ? `${path} — the folder is gone` : path}
        className="min-w-0 flex-1 cursor-pointer rounded-[7px] px-2.5 py-1.5 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-1.5">
          {open && <Dot tone="var(--color-nb-accent)" title="Open in this window" />}
          {!open && running && <Dot tone="var(--color-nb-mint-ink)" title="A run is going here" pulse />}
          {missing && <FiAlertTriangle size={12} className="shrink-0 text-nb-ink-soft" />}
          <span className="truncate text-[13px] font-[700] text-nb-ink">{name}</span>
          {missing && <span className="shrink-0 text-[11px] text-nb-ink-soft">folder is gone</span>}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-nb-ink-soft">{path}</span>
      </button>
      {/* The open project has no ✕: forgetting the board on screen would leave
          the window showing a project the list no longer has. */}
      {!open && (
        <button
          type="button"
          onClick={onForget}
          title="Take this project off the list — nothing on disk is touched"
          className="shrink-0 cursor-pointer rounded-[6px] p-1.5 text-nb-ink-soft opacity-0 hover:text-nb-ink focus:opacity-100 group-hover:opacity-100"
        >
          <FiX size={13} />
        </button>
      )}
    </div>
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
 *  wording untouched. */
export function PickAnotherProject({ desktop }: { desktop: boolean }) {
  if (!desktop) return null;
  return (
    <Button variant="ghost" className="mt-4" onClick={() => void bridge()?.pickRepo()}>
      <FiFolder size={14} /> Open another project…
    </Button>
  );
}

/** Make a board in the folder that is open (#178). In a browser this is `npx
 *  ai4kanban install`, typed in a terminal — which a window doesn't have, so the
 *  app carries the installer and runs it here. It scaffolds `docs/kanban/` and
 *  puts setup's own checklist in it; the page reloads onto the new board, where
 *  the setup bar picks up from the first step.
 *
 *  Null outside the app: the browser screen keeps the command it already gives. */
export function MakeBoardHere({ desktop }: { desktop: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!desktop) return null;
  return (
    <div className="mt-4">
      <Button
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
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border-[1.5px] border-nb-ink bg-nb-peach-soft px-3 py-2 text-[12px] leading-relaxed text-nb-ink">
          {error}
        </pre>
      )}
    </div>
  );
}
