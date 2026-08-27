// The app menu. Small on purpose: the board's own buttons do the work, so this
// carries only what a window can do and a page can't — open another project,
// go back to one you had open before, move back and forward through the views
// this window opened, ask whether a newer app is out, and the standard window
// and edit items every desktop app is expected to have.
//
// It is rebuilt whenever the projects list changes, since Open Recent is drawn
// from it, and again on every move between views, since Back and Forward grey
// out at the ends. The list in the board's header is the fuller one — it says
// which projects have a run going and lets a project be taken off — and this is
// the same list where a person's hand already is.

import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";
import { DEFAULT_LANGUAGE } from "./rules";
import { DOWNLOADS_URL } from "./update";
import type { ProjectInfo } from "../shared/bridge";

const DOCS_URL = "https://ai4kanban.dev/";

// How many projects Open Recent shows. The header's list has them all; a menu
// that runs down the screen helps nobody.
const RECENT_IN_MENU = 10;

export interface MenuOptions {
  onOpenRepo: () => unknown;
  onOpenProject: (dir: string) => unknown;
  onCloseProject: () => unknown;
  /** Whether a project is on screen. False on the launcher, where Close Project
   *  is greyed rather than hidden — the app should say it has the move even on
   *  the one screen where there is nothing to use it on. */
  hasProject?: boolean;
  onCheckUpdates: () => unknown;
  onBack: () => unknown;
  onForward: () => unknown;
  /** Whether there is a view to go back to, and one to go forward to, right
   *  now. Both false before there is a window. */
  canGoBack?: boolean;
  canGoForward?: boolean;
  projects?: ProjectInfo[];
  /** The language this machine reads in (#334). Every label below is still English —
   *  translating them is #336 — so what this carries is the answer, not yet its words. */
  language?: string;
}

function recentSubmenu(
  projects: ProjectInfo[],
  onOpenProject: (dir: string) => unknown,
): MenuItemConstructorOptions[] {
  const entries = projects.slice(0, RECENT_IN_MENU).map<MenuItemConstructorOptions>((p) => ({
    // The folder's name, then a word for the two states worth knowing before
    // you click: its folder has gone, or an agent is working in it.
    label: `${p.name}${p.missing ? "  (folder is gone)" : p.running ? "  (running)" : ""}`,
    type: "checkbox",
    checked: p.open,
    enabled: !p.missing,
    toolTip: p.path,
    click: () => onOpenProject(p.path),
  }));
  return entries.length ? entries : [{ label: "No other projects yet", enabled: false }];
}

export function buildMenu({
  onOpenRepo,
  onOpenProject,
  onCloseProject,
  hasProject = false,
  onCheckUpdates,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
  projects = [],
  language = DEFAULT_LANGUAGE,
}: MenuOptions): void {
  // Carried, not yet read: every label below is English until #336 translates them.
  void language;
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { label: "Check for Updates…", click: onCheckUpdates },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Open Project…", accelerator: "CmdOrCtrl+O", click: onOpenRepo },
        { label: "Open Recent", submenu: recentSubmenu(projects, onOpenProject) },
        // Done with this project, without quitting: back to the launcher, and
        // the next launch starts there too. The one way to say that — closing
        // the window is quitting in a one-window app, so it can't also mean
        // this.
        {
          label: "Close Project",
          accelerator: "CmdOrCtrl+Shift+W",
          enabled: hasProject,
          click: onCloseProject,
        },
        { type: "separator" },
        ...(isMac
          ? [{ role: "close" } satisfies MenuItemConstructorOptions]
          : [
              { label: "Check for Updates…", click: onCheckUpdates },
              { role: "quit" } satisfies MenuItemConstructorOptions,
            ]),
      ],
    },
    // The board has text boxes — a card note, a goal, an API key — so copy,
    // paste and undo have to work, and on macOS they only do when the menu says
    // so.
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        // The way back for a mouse, and for a trackpad with the swipe turned
        // off. The shortcuts are the ones the system's own browser uses, so a
        // hand that knows one knows this.
        {
          label: "Back",
          accelerator: isMac ? "Cmd+[" : "Alt+Left",
          enabled: canGoBack,
          click: onBack,
        },
        {
          label: "Forward",
          accelerator: isMac ? "Cmd+]" : "Alt+Right",
          enabled: canGoForward,
          click: onForward,
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "AI4Kanban Guide", click: () => shell.openExternal(DOCS_URL) },
        { label: "Downloads", click: () => shell.openExternal(DOWNLOADS_URL) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
