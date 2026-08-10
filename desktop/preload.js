"use strict";

// The whole of what the board's pages can ask the app for.
//
// The pages are the same ones a browser gets, so they can't assume any of this
// exists — `window.ai4kanban` is simply absent outside the app, and the UI
// checks for it before it offers anything (kanban-ui/components/desktop.tsx).
// Nothing here reads the disk or runs a command; each call is a message to the
// main process, which decides what to do with it.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ai4kanban", {
  /** `{ version, platform, boardDir, downloadsUrl }` — what window this is. */
  info: () => ipcRenderer.invoke("a4k:info"),
  /** Ask the user for another project folder and open it. Returns the folder
   *  now open, which is the old one when they cancelled. */
  pickRepo: () => ipcRenderer.invoke("a4k:pick-repo"),
  /** `{ version, url }` when a newer app is out and the user hasn't waved this
   *  one off, else null. */
  update: () => ipcRenderer.invoke("a4k:update"),
  /** Don't mention this version again. */
  skipUpdate: (version) => ipcRenderer.invoke("a4k:skip-update", version),
  /** Open a link in the user's own browser. */
  openExternal: (url) => ipcRenderer.invoke("a4k:open-external", url),
});
