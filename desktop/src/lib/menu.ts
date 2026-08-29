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
//
// Every standard item is written out and named (#336) rather than left to
// `editMenu` and `windowMenu`, so the whole bar reads in the picked language on
// every system. Each one keeps its `role` — that is what gives it its behaviour
// and its platform shortcut — and `label` only overrides its wording. What the
// system still writes is the Services submenu's contents, the items macOS adds
// to Window and Help itself, and the About panel.

import { app, Menu, shell, type MenuItemConstructorOptions } from "electron";
import { getCopy } from "./copy";
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
  /** The language this machine reads in (#334) — which of the menu's two
   *  languages is drawn. */
  language?: string;
}

type MenuCopy = ReturnType<typeof getCopy>["menu"];

function recentSubmenu(
  projects: ProjectInfo[],
  onOpenProject: (dir: string) => unknown,
  c: MenuCopy["file"],
): MenuItemConstructorOptions[] {
  const entries = projects.slice(0, RECENT_IN_MENU).map<MenuItemConstructorOptions>((p) => ({
    // The folder's name, then a word for the two states worth knowing before
    // you click: its folder has gone, or an agent is working in it.
    label: p.missing ? c.recentGone(p.name) : p.running ? c.recentRunning(p.name) : c.recent(p.name),
    type: "checkbox",
    checked: p.open,
    enabled: !p.missing,
    toolTip: p.path,
    click: () => onOpenProject(p.path),
  }));
  return entries.length ? entries : [{ label: c.noRecent, enabled: false }];
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
  const c = getCopy(language).menu;
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: c.app.about },
              { label: c.app.checkUpdates, click: onCheckUpdates },
              { type: "separator" },
              { role: "services", label: c.app.services },
              { type: "separator" },
              { role: "hide", label: c.app.hide },
              { role: "hideOthers", label: c.app.hideOthers },
              { role: "unhide", label: c.app.unhide },
              { type: "separator" },
              { role: "quit", label: c.app.quit },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: c.file.title,
      submenu: [
        { label: c.file.open, accelerator: "CmdOrCtrl+O", click: onOpenRepo },
        { label: c.file.openRecent, submenu: recentSubmenu(projects, onOpenProject, c.file) },
        // Done with this project, without quitting: back to the launcher, and
        // the next launch starts there too. The one way to say that — closing
        // the window is quitting in a one-window app, so it can't also mean
        // this.
        {
          label: c.file.close,
          accelerator: "CmdOrCtrl+Shift+W",
          enabled: hasProject,
          click: onCloseProject,
        },
        { type: "separator" },
        ...(isMac
          ? [{ role: "close", label: c.file.closeWindow } satisfies MenuItemConstructorOptions]
          : [
              { label: c.file.checkUpdates, click: onCheckUpdates },
              { role: "quit", label: c.file.quit } satisfies MenuItemConstructorOptions,
            ]),
      ],
    },
    // The board has text boxes — a card note, a goal, an API key — so copy,
    // paste and undo have to work, and on macOS they only do when the menu says
    // so.
    {
      label: c.edit.title,
      submenu: [
        { role: "undo", label: c.edit.undo },
        { role: "redo", label: c.edit.redo },
        { type: "separator" },
        { role: "cut", label: c.edit.cut },
        { role: "copy", label: c.edit.copy },
        { role: "paste", label: c.edit.paste },
        ...(isMac
          ? [
              {
                role: "pasteAndMatchStyle",
                label: c.edit.pasteAndMatchStyle,
              } satisfies MenuItemConstructorOptions,
              { role: "delete", label: c.edit.delete } satisfies MenuItemConstructorOptions,
              { role: "selectAll", label: c.edit.selectAll } satisfies MenuItemConstructorOptions,
              { type: "separator" } satisfies MenuItemConstructorOptions,
              {
                label: c.edit.speech,
                submenu: [
                  { role: "startSpeaking", label: c.edit.startSpeaking },
                  { role: "stopSpeaking", label: c.edit.stopSpeaking },
                ],
              } satisfies MenuItemConstructorOptions,
            ]
          : [
              { role: "delete", label: c.edit.delete } satisfies MenuItemConstructorOptions,
              { type: "separator" } satisfies MenuItemConstructorOptions,
              { role: "selectAll", label: c.edit.selectAll } satisfies MenuItemConstructorOptions,
            ]),
      ],
    },
    {
      label: c.view.title,
      submenu: [
        // The way back for a mouse, and for a trackpad with the swipe turned
        // off. The shortcuts are the ones the system's own browser uses, so a
        // hand that knows one knows this.
        {
          label: c.view.back,
          accelerator: isMac ? "Cmd+[" : "Alt+Left",
          enabled: canGoBack,
          click: onBack,
        },
        {
          label: c.view.forward,
          accelerator: isMac ? "Cmd+]" : "Alt+Right",
          enabled: canGoForward,
          click: onForward,
        },
        { type: "separator" },
        { role: "reload", label: c.view.reload },
        { role: "forceReload", label: c.view.forceReload },
        { role: "toggleDevTools", label: c.view.devTools },
        { type: "separator" },
        { role: "resetZoom", label: c.view.actualSize },
        { role: "zoomIn", label: c.view.zoomIn },
        { role: "zoomOut", label: c.view.zoomOut },
        { type: "separator" },
        { role: "togglefullscreen", label: c.view.fullScreen },
      ],
    },
    // `role: "window"` is what lets macOS add its own window list underneath.
    {
      role: "window",
      label: c.window.title,
      submenu: [
        { role: "minimize", label: c.window.minimize },
        { role: "zoom", label: c.window.zoom },
        ...(isMac
          ? [
              { type: "separator" } satisfies MenuItemConstructorOptions,
              { role: "front", label: c.window.front } satisfies MenuItemConstructorOptions,
            ]
          : [{ role: "close", label: c.window.close } satisfies MenuItemConstructorOptions]),
      ],
    },
    {
      role: "help",
      label: c.help.title,
      submenu: [
        { label: c.help.guide, click: () => shell.openExternal(DOCS_URL) },
        { label: c.help.downloads, click: () => shell.openExternal(DOWNLOADS_URL) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
