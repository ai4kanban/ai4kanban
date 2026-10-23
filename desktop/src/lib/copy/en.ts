// English copy for the main process — the source of truth a second language mirrors
// key for key. Writing rules: `./index.ts`.
import type { DesktopCopy } from "./types";

const en: DesktopCopy = {
  menu: {
    app: {
      about: "About WildCrane",
      checkUpdates: "Check for Updates…",
      services: "Services",
      hide: "Hide WildCrane",
      hideOthers: "Hide Others",
      unhide: "Show All",
      quit: "Quit WildCrane",
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
    help: { title: "Help", tour: "Welcome Tour", guide: "WildCrane Guide", downloads: "Downloads" },
  },
  launcher: {
    openFolder: "Open folder",
    recent: "Opened before",
    language: "Language",
    soon: "Soon",
    runningHere: "A run is going here",
    create: "Create new project",
    projectName: "Project name",
    location: "Where it goes — click to change",
    createIt: "Create",
    cancel: "Cancel",
    cloudBadge: "Cloud",
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
      titleLocation: "Where the project goes",
      messageLocation: "Pick the folder the new project's own folder goes in.",
      buttonLocation: "Choose",
    },
    command: {
      ask: "Put the akb command on your PATH?",
      detailWindows: (folder) =>
        `WildCrane carries its own copy of akb — the command a coding agent drives this board with. This puts the app's own folder (${folder}) on your PATH. Updating the app updates the command.\n\nA new PATH entry only reaches terminals opened after it.\n\nYou can do this later from Configuration → General.`,
      detailLink: (path) =>
        `WildCrane carries its own copy of akb — the command a coding agent drives this board with. This points ${path} at the copy inside the app, so updating the app updates the command.\n\nYou can do this later from Configuration → General.`,
      detailLinkPassword: (path) =>
        `WildCrane carries its own copy of akb — the command a coding agent drives this board with. This points ${path} at the copy inside the app, so updating the app updates the command. macOS asks for your administrator password to write there.\n\nYou can do this later from Configuration → General.`,
      install: "Install",
      notNow: "Not now",
      failed: "akb was not installed.",
      ready: "akb is ready.",
      readyWindows: "Open a new terminal and run `akb --version`. Typing `akb` on its own opens this app.",
      readyLink:
        "Run `akb --version` in a terminal. Typing `akb` on its own opens this app on the project you are standing in.",
    },
    update: {
      newest: (version) => `WildCrane ${version} is the newest version.`,
      out: (version) => `WildCrane ${version} is out.`,
      downloading: "WildCrane is downloading it in the background. You will be asked to restart when it is ready.",
      ready: (version) => `WildCrane ${version} is downloaded.`,
      readyDetail: "Restarting closes WildCrane and opens the new version.",
      restart: "Restart to update",
      later: "Later",
      close: "Close",
      failed: (reason) => `${reason}\n\nWildCrane will try again the next time it starts.`,
    },
    startFailed: "WildCrane could not start the board",
  },
  command: {
    blockedSource:
      "This is a build from source, not an installed app — there is no app bundle to point at yet.",
    blockedLinux:
      "The Linux build unpacks itself somewhere new every time it runs, so there is no lasting path to point at.",
    blockedImage:
      "WildCrane is running from a disk image. Move it into Applications first, then open it from there.",
    blockedTranslocated:
      "macOS is running WildCrane from a temporary copy of itself. Move it into Applications first, then open it from there.",
    blockedDownloads:
      "WildCrane is running from Downloads. Move it into Applications first, then open it from there.",
    password: (folder) => `WildCrane needs your password to put the akb command in ${folder}.`,
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
    reason: {
      network: "The connection was interrupted while downloading the update.",
      timeout: "The connection timed out while downloading the update.",
      server: "The update service is unavailable right now.",
      disk: "There is not enough disk space for the update.",
      permission: "WildCrane does not have permission to write the update.",
      checksum: "The downloaded update failed its integrity check, so it was thrown away.",
      readOnly: "WildCrane is in a read-only location, so it cannot update itself.",
      noBuild: "This release has no build for this computer.",
      notInstallable: "This copy of WildCrane cannot update itself.",
      unknown: "The update could not be installed.",
    },
  },
  project: {
    nameNeeded: "Type a name for the project.",
    nameNotOneFolder:
      "A project name is one folder name — it cannot hold a path. The folder button is where you say where it goes.",
    nameNotAllowed: "This system will not take that as a folder name.",
    locationNeeded: "Pick the folder the project goes in.",
    exists: (path) =>
      `${path} is already there, and nothing is ever written into a folder that exists. Pick another name, or another place for it.`,
    failed: (reason) => `The project folder could not be made: ${reason}.`,
    noGit: {
      message: "The project was made, but it is not a Git repository.",
      detail: (reason) =>
        `${reason}\n\nThe folder and its board are yours all the same. Run \`git init\` in it whenever you want the repository.`,
    },
  },
  board: {
    installerMissing: (path) =>
      `the board installer is missing from this build (looked in ${path}).\nBuilt from source? Run \`npm run bundle\` in desktop/ first.`,
    nothingMade: "the installer left no board behind",
  },
};

export default en;
