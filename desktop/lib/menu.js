"use strict";

// The app menu. Small on purpose: the board's own buttons do the work, so this
// carries only what a window can do and a page can't — open another project,
// ask whether a newer app is out, and the standard window and edit items every
// desktop app is expected to have.

const { app, Menu, shell } = require("electron");
const { DOWNLOADS_URL } = require("./update");

const DOCS_URL = "https://ai4kanban.dev/";

function buildMenu({ onOpenRepo, onCheckUpdates }) {
  const isMac = process.platform === "darwin";
  const template = [
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
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Open Project…", accelerator: "CmdOrCtrl+O", click: onOpenRepo },
        { type: "separator" },
        ...(isMac ? [{ role: "close" }] : [{ label: "Check for Updates…", click: onCheckUpdates }, { role: "quit" }]),
      ],
    },
    // The board has text boxes — a card note, a goal, an API key — so copy,
    // paste and undo have to work, and on macOS they only do when the menu says
    // so.
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
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

module.exports = { buildMenu };
