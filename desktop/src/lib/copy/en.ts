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
    recent: "Opened before",
    language: "Language",
    soon: "Soon",
    runningHere: "A run is going here",
    cloudBadge: "Cloud",
    opening: (name) => `Opening ${name}…`,
    pathGone: (path) => `${path} — the folder is gone`,
    forget: "Take this project off the list — nothing on disk is touched",
    forgetGone: "The folder is gone — take it off the list",
    local: {
      title: "Local board",
      blurb: "A folder on this machine. Your cards are files in your repository.",
      create: "Create Local board",
      open: "Open Local board",
    },
    cloud: {
      title: "Cloud board",
      preview: "Invite-only preview",
      blurb:
        "We host the board so it opens anywhere. Still a folder here — your code and agents never leave this machine.",
      create: "Create Cloud board",
      open: "Open Cloud board",
      privacy: "Privacy",
      terms: "Terms",
      back: "Back",
      busy: "Working…",
      signIn: {
        boundary:
          "Cloud stores this board — its cards, memory, releases and history — so every machine you sign in from opens the same one. It never receives your repository, never runs an agent, and never reads a card you have not published.",
        button: "Continue with GitHub",
        confirms: (privacyLink, termsLink) =>
          `Signing in confirms you have read the ${privacyLink} and the ${termsLink}.`,
        instead: (localLink) => `Not now? ${localLink} — nothing here is decided yet.`,
      },
      closed: {
        title: "The preview is closed to this account.",
        blurb:
          "We read every request by hand. Once we approve it your account is in and we email you. No date is promised.",
        ask: "Request an invite",
        asked: (date) => `You asked on ${date}. We answer by email.`,
        signOut: "Sign out",
        instead: (localLink) =>
          `Nothing is waiting on the invite: ${localLink} and move it to Cloud when you are in.`,
      },
      pick: {
        workspace: "Workspace",
        newWorkspace: "New workspace",
        namedBelow: "Named below",
        namePlaceholder: "Name this board",
        opened: (date) => `Last written ${date}`,
        folder: "Folder on this machine",
        choose: "Choose…",
        noFolder: "Pick the project folder this board belongs to",
        importCards: (count) =>
          count === 1
            ? "Import the 1 card already in docs/kanban/"
            : `Import the ${count} cards already in docs/kanban/`,
        importBlurb: "Nothing in the folder is changed — the workspace gets a copy.",
        create: "Create Cloud board",
        open: "Open Cloud board",
      },
      done: {
        ready: (name, cards) =>
          cards === 0
            ? `${name} is on Cloud, and this checkout now points at it.`
            : cards === 1
              ? `${name} is on Cloud — 1 card, and this checkout now points at it.`
              : `${name} is on Cloud — ${cards} cards, and this checkout now points at it.`,
        stale:
          "The cards in docs/kanban/ are a copy from here on: the workspace is where the board is read and written now.",
        offerTitle: "Take the copy out of the repository",
        offerBlurb: (cards) =>
          cards === 1
            ? "One commit: 1 board file leaves git, .ai4kanban.json is added, and docs/kanban/ joins the root .gitignore. Nothing else in your working tree goes with it."
            : `One commit: ${cards} board files leave git, .ai4kanban.json is added, and docs/kanban/ joins the root .gitignore. Nothing else in your working tree goes with it.`,
        offerSafe:
          "Nothing is lost either way — the cards are in git history, and what you decide here is whether git records the move.",
        noGit:
          "There is no git repository here yet, so there is nothing to commit the pointer to. The board works; run git init when you want one.",
        nothingTracked: "Nothing here was in git, so there is nothing to commit.",
        commit: "Commit this change",
        keep: "Keep the files as they are",
        committed: "Committed. The board is the workspace from here on.",
        openBoard: "Open the board",
      },
    },
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
