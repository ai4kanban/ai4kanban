/** Every word the MAIN process renders (#336): the menu bar, the launcher page, the
 *  dialogs the app draws, and the finished sentences it hands the board UI to print.
 *
 *  The board UI has a copy module of its own (`kanban-ui/i18n/`) and this process cannot
 *  read it — a menu is not a page. Same rules, though: whole sentences, product names and
 *  paths left English, and a value carried by a function rather than a hole in a template. */
export interface DesktopCopy {
  /** The menu bar. Every standard item is named here rather than left to its role, so the
   *  whole bar reads in the picked language on every system. What the OS writes itself —
   *  the Services submenu, the items macOS adds to Window and Help, the About panel —
   *  stays in the machine's language. */
  menu: {
    /** The application menu, macOS only. Its own title is the app's name. */
    app: {
      about: string;
      checkUpdates: string;
      services: string;
      hide: string;
      hideOthers: string;
      unhide: string;
      quit: string;
    };
    file: {
      title: string;
      open: string;
      openRecent: string;
      close: string;
      /** Open Recent with nothing else on the list. */
      noRecent: string;
      /** One recent project, and the one word worth knowing before you click. */
      recent: (name: string) => string;
      recentGone: (name: string) => string;
      recentRunning: (name: string) => string;
      /** macOS puts Close Window here; every other system puts Quit. */
      closeWindow: string;
      quit: string;
      checkUpdates: string;
    };
    edit: {
      title: string;
      undo: string;
      redo: string;
      cut: string;
      copy: string;
      paste: string;
      pasteAndMatchStyle: string;
      delete: string;
      selectAll: string;
      /** macOS only. */
      speech: string;
      startSpeaking: string;
      stopSpeaking: string;
    };
    view: {
      title: string;
      back: string;
      forward: string;
      reload: string;
      forceReload: string;
      devTools: string;
      actualSize: string;
      zoomIn: string;
      zoomOut: string;
      fullScreen: string;
    };
    window: {
      title: string;
      minimize: string;
      zoom: string;
      /** macOS only. */
      front: string;
      close: string;
    };
    help: { title: string; guide: string; downloads: string };
  };
  /** The launcher page (`lib/launcher.ts`) — its markup, and the inline script that draws
   *  the recent list. */
  launcher: {
    openFolder: string;
    recent: string;
    language: string;
    /** A language on the switcher that isn't written yet. */
    soon: string;
    runningHere: string;
    /** One row's tooltip, where the folder has gone. */
    pathGone: (path: string) => string;
    forget: string;
    forgetGone: string;
  };
  /** The dialogs the app draws over the window. */
  dialog: {
    folderGone: { message: (name: string) => string; detail: (path: string) => string };
    pick: { titleFirst: string; titleAnother: string; message: string; button: string };
    /** The offer to put `akb` on the PATH, and both of its outcomes. */
    command: {
      ask: string;
      /** Windows puts a folder on the PATH; everywhere else writes one link, and macOS may
       *  want a password for it. One whole sentence each. */
      detailWindows: (folder: string) => string;
      detailLink: (path: string) => string;
      detailLinkPassword: (path: string) => string;
      install: string;
      notNow: string;
      failed: string;
      ready: string;
      readyWindows: string;
      readyLink: string;
    };
    update: {
      newest: (version: string) => string;
      out: (version: string) => string;
      detail: string;
      download: string;
      later: string;
    };
    /** The board server never came up — the app has no window to say it in. */
    startFailed: string;
  };
  /** The sentences `lib/command.ts` reports in its own words. The board UI prints them as
   *  they arrive, so they are finished sentences and not codes. */
  command: {
    /** Why this app must not be pointed at — it sits somewhere that won't last. */
    blockedSource: string;
    blockedLinux: string;
    blockedImage: string;
    blockedTranslocated: string;
    blockedDownloads: string;
    /** The macOS administrator prompt. */
    password: (folder: string) => string;
    cancelled: string;
    noWay: string;
    held: (path: string, holder: string) => string;
    /** What is holding that path, said in the `held` sentence above and in the board UI's
     *  own line about it. */
    holderUnknown: string;
    holderFile: string;
    holderUnreadable: string;
    holderLink: (target: string) => string;
    missing: (path: string) => string;
    missingScript: (path: string) => string;
  };
  /** The failures `lib/board-init.ts` reports. A `stderr` from the installer passes through
   *  as it arrived. */
  board: {
    installerMissing: (path: string) => string;
    nothingMade: string;
  };
}
