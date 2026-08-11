// The bridge between the board's pages and the app.
//
// Nothing here reads the disk or runs a command; each call is a message to the
// main process, which decides what to do with it. What the surface IS — the
// calls, their arguments, their answers — is written down in shared/bridge.ts,
// and typing the object against it here is what keeps this end and main.ts's
// end from drifting apart.

import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type Ai4kanbanBridge } from "./shared/bridge";

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
