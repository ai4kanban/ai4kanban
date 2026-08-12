// The bridge between the board's pages and the app.
//
// Nothing here reads the disk or runs a command; each call is a message to the
// main process, which decides what to do with it. What the surface IS — the
// calls, their arguments, their answers — is written down in shared/bridge.ts,
// and typing the object against it here is what keeps this end and main.ts's
// end from drifting apart.
//
// It types against that file but must not REQUIRE it: this script runs in a
// sandboxed renderer (Electron's default since 20), where `require` is a
// polyfill that knows `electron` and a few builtins and nothing else. A
// relative require throws before `exposeInMainWorld` is ever reached, and the
// page then sees no `window.ai4kanban` at all — a whole app's worth of missing
// buttons, announced nowhere. So the imports below are type-only, erased at
// compile time, and the channel names are written out here as values.
//
// Writing them out is not a second copy that can drift: `Channels` below is the
// type of the real object, whose names are literal strings, so a name typed
// wrong here fails the typecheck rather than the app.

import { contextBridge, ipcRenderer } from "electron";
import type { Ai4kanbanBridge, CHANNELS as Channels } from "./shared/bridge";

const CHANNELS: typeof Channels = {
  info: "a4k:info",
  projects: "a4k:projects",
  openProject: "a4k:open-project",
  forgetProject: "a4k:forget-project",
  pickRepo: "a4k:pick-repo",
  createBoard: "a4k:create-board",
  update: "a4k:update",
  skipUpdate: "a4k:skip-update",
  openExternal: "a4k:open-external",
};

const bridge: Ai4kanbanBridge = {
  info: () => ipcRenderer.invoke(CHANNELS.info),
  projects: () => ipcRenderer.invoke(CHANNELS.projects),
  openProject: (dir) => ipcRenderer.invoke(CHANNELS.openProject, dir),
  forgetProject: (dir) => ipcRenderer.invoke(CHANNELS.forgetProject, dir),
  pickRepo: () => ipcRenderer.invoke(CHANNELS.pickRepo),
  createBoard: () => ipcRenderer.invoke(CHANNELS.createBoard),
  update: () => ipcRenderer.invoke(CHANNELS.update),
  skipUpdate: (version) => ipcRenderer.invoke(CHANNELS.skipUpdate, version),
  openExternal: (url) => ipcRenderer.invoke(CHANNELS.openExternal, url),
};

contextBridge.exposeInMainWorld("ai4kanban", bridge);
