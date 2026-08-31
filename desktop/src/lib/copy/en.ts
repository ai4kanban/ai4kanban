// English copy for the main process — the source of truth a second language mirrors
// key for key. Writing rules: `./index.ts`.
import type { DesktopCopy } from "./types";

const en: DesktopCopy = {
  menu: {
    app: {
      about: "About AI4Kanban",
      checkUpdates: "Check for Updates…",
      services: "Services",
      hide: "Hide AI4Kanban",
      hideOthers: "Hide Others",
      unhide: "Show All",
      quit: "Quit AI4Kanban",
    },
    file: {
      title: "File",
      open: "Open Project…",
      openRecent: "Open Recent",
      close: "Close Project",
      noRecent: "No other projects yet",
      recent: (name) => name,
      recentGone: (name) => `${name}  (folder is gone)`,
      recentRunning: (name) => `${name}  (running)`,
      closeWindow: "Close Window",
      quit: "Quit",
      checkUpdates: "Check for Updates…",
    },
    edit: {
      title: "Edit",
      undo: "Undo",
      redo: "Redo",
      cut: "Cut",
      copy: "Copy",
      paste: "Paste",
      pasteAndMatchStyle: "Paste and Match Style",
      delete: "Delete",
      selectAll: "Select All",
      speech: "Speech",
      startSpeaking: "Start Speaking",
      stopSpeaking: "Stop Speaking",
    },
    view: {
      title: "View",
      back: "Back",
      forward: "Forward",
      reload: "Reload",
      forceReload: "Force Reload",
      devTools: "Toggle Developer Tools",
      actualSize: "Actual Size",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      fullScreen: "Toggle Full Screen",
    },
    window: {
      title: "Window",
      minimize: "Minimize",
      zoom: "Zoom",
      front: "Bring All to Front",
      close: "Close",
    },
    help: { title: "Help", guide: "AI4Kanban Guide", downloads: "Downloads" },
  },
  launcher: {
    openFolder: "Open Folder",
    recent: "Recent",
    language: "Language",
    soon: "Soon",
    runningHere: "A run is going here",
    opening: (name) => `Opening ${name}…`,
    pathGone: (path) => `${path} — the folder is gone`,
    forget: "Take this project off the list — nothing on disk is touched",
    forgetGone: "The folder is gone — take it off the list",
  },
  dialog: {
    folderGone: {
      message: (name) => `${name} isn't there any more.`,
      detail: (path) =>
        `${path}\n\nThe folder was moved or deleted. Take it off the list, or put it back.`,
    },
    pick: {
      titleFirst: "Open a project",
      titleAnother: "Open another project",
      message: "Pick the project folder to open. It doesn't need a board yet.",
      button: "Open",
    },
    command: {
      ask: "Put the akb command on your PATH?",
      detailWindows: (folder) =>
        `AI4Kanban carries its own copy of akb — the command a coding agent drives this board with. This puts the app's own folder (${folder}) on your PATH. Updating the app updates the command.\n\nA new PATH entry only reaches terminals opened after it.\n\nYou can do this later from Configuration → General.`,
      detailLink: (path) =>
        `AI4Kanban carries its own copy of akb — the command a coding agent drives this board with. This points ${path} at the copy inside the app, so updating the app updates the command.\n\nYou can do this later from Configuration → General.`,
      detailLinkPassword: (path) =>
        `AI4Kanban carries its own copy of akb — the command a coding agent drives this board with. This points ${path} at the copy inside the app, so updating the app updates the command. macOS asks for your administrator password to write there.\n\nYou can do this later from Configuration → General.`,
      install: "Install",
      notNow: "Not now",
      failed: "akb was not installed.",
      ready: "akb is ready.",
      readyWindows: "Open a new terminal and run `akb version`. Typing `akb` on its own opens this app.",
      readyLink:
        "Run `akb version` in a terminal. Typing `akb` on its own opens this app on the project you are standing in.",
    },
    update: {
      newest: (version) => `AI4Kanban ${version} is the newest version.`,
      out: (version) => `AI4Kanban ${version} is out.`,
      detail: "Install it here and the app restarts into the new version.",
      detailManual: (reason) => `${reason}\n\nGet the new version from the downloads page.`,
      install: "Install",
      download: "Download",
      later: "Later",
      skip: "Skip this version",
      downloading: "AI4Kanban is downloading it. The line above the board shows how far along it is.",
      ready: (version) => `AI4Kanban ${version} is downloaded.`,
      readyDetail: "It installs on the next restart.",
      restart: "Restart now",
    },
    startFailed: "AI4Kanban could not start the board",
  },
  command: {
    blockedSource:
      "This is a build from source, not an installed app — there is no app bundle to point at yet.",
    blockedLinux:
      "The Linux build unpacks itself somewhere new every time it runs, so there is no lasting path to point at.",
    blockedImage:
      "AI4Kanban is running from a disk image. Move it into Applications first, then open it from there.",
    blockedTranslocated:
      "macOS is running AI4Kanban from a temporary copy of itself. Move it into Applications first, then open it from there.",
    blockedDownloads:
      "AI4Kanban is running from Downloads. Move it into Applications first, then open it from there.",
    password: (folder) => `AI4Kanban needs your password to put the akb command in ${folder}.`,
    cancelled: "cancelled — nothing was written.",
    noWay: "this system has no way to install the command.",
    held: (path, holder) =>
      `${path} is held by ${holder} — the app only ever replaces a link it wrote.`,
    holderUnknown: "something else",
    holderFile: "a file of its own",
    holderUnreadable: "a symlink we cannot read",
    holderLink: (target) => `a symlink to ${target}`,
    missing: (path) => `the command is missing from this build (looked in ${path}).`,
    missingScript: (path) => `the PATH script is missing from this build (looked in ${path}).`,
  },
  update: {
    blockedSource: "This is a build from source, not an installed app — there is nothing here to replace.",
    blockedNotAppImage:
      "This copy is not running as an AppImage, so there is no single file to replace. Get the new version from the downloads page.",
    blockedReadOnly: (folder) =>
      `AI4Kanban cannot write ${folder}, so it cannot put a new version there. Get the new version from the downloads page.`,
    noBuild: "This release has no build for this computer, so it has to be downloaded by hand.",
    failedRead: "AI4Kanban could not read this release, so it cannot install it.",
    failedDownload: (reason) => `The download did not finish: ${reason}.`,
    failedChecksum:
      "The download does not match the checksum published with it, so it was thrown away. Nothing on this computer was changed.",
    failedUnpack: (reason) => `The download could not be unpacked: ${reason}.`,
  },
  board: {
    installerMissing: (path) =>
      `the board installer is missing from this build (looked in ${path}).\nBuilt from source? Run \`npm run bundle\` in desktop/ first.`,
    nothingMade: "the installer left no board behind",
  },
};

export default en;
