"use client";

// What the board does differently when it is running inside the desktop app —
// and what it says when it isn't.
//
// The pages are the same either way. The app (../../desktop) starts this very
// server and shows it in a window, so nothing here is a second version of
// anything: it is the few places where "there is a window around this" changes
// what we can offer.
//
//  - In the app, the folder badge in the header opens another project. In a
//    browser there is nobody to ask, so it stays a label.
//  - In the app, a newer release says so, with a link to the download. The app
//    never updates itself.
//  - In a browser, the board says that starting a server and opening a browser
//    is deprecated, and where to get the app instead.
//
// Everything the app can do reaches this file through `window.ai4kanban`, put
// there by the app's preload script. It is simply absent in a browser, so every
// call below checks first.

import { useEffect, useState } from "react";
import { FiDownload, FiFolder, FiX } from "react-icons/fi";
import { Button } from "./button";

/** Where a person gets the app. One place, named here, used by both notices. */
export const DOWNLOAD_URL = "https://ai4kanban.dev/download";

interface AppBridge {
  info(): Promise<{ version: string; platform: string; boardDir: string | null; downloadsUrl: string }>;
  pickRepo(): Promise<string | null>;
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

// --- the folder badge -------------------------------------------------------

/** Which repo this board is, in the header. In the app it is the button that
 *  opens another one — the app has no terminal to be restarted from, so this is
 *  how a window is pointed at a different folder. It shows the folder name on a
 *  narrow window and the whole path on a wide one, the same either way. */
export function ProjectPath({ projectRoot, desktop }: { projectRoot: string; desktop: boolean }) {
  const inner = (
    <>
      <FiFolder className="shrink-0 opacity-70" size={12} />
      <span className="truncate lg:hidden">{projectRoot.split("/").pop()}</span>
      <span className="hidden truncate lg:inline">{projectRoot}</span>
    </>
  );
  const className =
    "hidden min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-nb-ink-soft sm:flex";
  const style = {
    background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
    border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
  };

  if (!desktop) {
    return (
      <span title={`${projectRoot}/docs/kanban`} className={className} style={style}>
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={`${projectRoot}/docs/kanban — click to open another project`}
      onClick={() => void bridge()?.pickRepo()}
      className={`${className} cursor-pointer hover:text-nb-ink`}
      style={style}
    >
      {inner}
    </button>
  );
}

// --- the notice line --------------------------------------------------------

/** The one line above the board that says something about how it is being run:
 *  a newer app in the app, the deprecation notice in a browser. Nothing at all
 *  once there is nothing to say. Rendered on both the board and a card page,
 *  since either is where a person may be standing. */
export function RunningNotice({ desktop }: { desktop: boolean }) {
  return desktop ? <UpdateNotice /> : <BrowserDeprecated />;
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

const DISMISS_KEY = "kanban-ui.browser-deprecated-dismissed";

function BrowserDeprecated() {
  // Start hidden and reveal after mount: sessionStorage doesn't exist during
  // SSR, so reading it in the first render would mismatch the server markup.
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  if (hidden) return null;
  return (
    <Strip tone="peach">
      <span>
        <strong>Running the board in a browser is deprecated.</strong> The desktop app is how
        AI4Kanban is handed out now — nothing to install first, and no terminal to keep alive.
        This way keeps working, but nothing new is built for it.
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
    <Button className="mt-4" onClick={() => void bridge()?.pickRepo()}>
      <FiFolder size={14} /> Open another project…
    </Button>
  );
}
