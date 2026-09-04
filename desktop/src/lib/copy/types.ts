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
   *  the recent list and runs the Cloud path (#317). */
  launcher: {
    recent: string;
    language: string;
    /** A language on the switcher that isn't written yet. */
    soon: string;
    runningHere: string;
    /** The badge on a project the board of which lives in a Cloud workspace. */
    cloudBadge: string;
    /** What the button says while a project is being opened. */
    opening: (name: string) => string;
    /** One row's tooltip, where the folder has gone. */
    pathGone: (path: string) => string;
    forget: string;
    forgetGone: string;
    /** The move onboarding leads with (#317). Both buttons open the same folder picker:
     *  what the folder turns out to hold is what happens, so the two labels are about what
     *  the user came to do. */
    local: {
      title: string;
      blurb: string;
      create: string;
      open: string;
    };
    /** The choice beside it — offered, labelled, and never preselected. */
    cloud: {
      title: string;
      /** What this release of Cloud is. Worn on the card and on every panel below. */
      preview: string;
      blurb: string;
      create: string;
      open: string;
      privacy: string;
      terms: string;
      /** Back to the two cards. */
      back: string;
      /** The one line under everything on this path. */
      busy: string;
      /** Signing in, with no board open. */
      signIn: {
        /** What Cloud holds and what it never receives — the same boundary #326 draws
         *  above the machine's sign-in, said of a workspace. */
        boundary: string;
        button: string;
        /** The two links are built by the page and handed in whole. */
        confirms: (privacyLink: string, termsLink: string) => string;
        /** The way out that costs nothing. */
        instead: (localLink: string) => string;
      };
      /** Signed in, and the preview is closed to this account (#327, #350). */
      closed: {
        title: string;
        blurb: string;
        ask: string;
        /** They have asked already, on this date. */
        asked: (date: string) => string;
        signOut: string;
        instead: (localLink: string) => string;
      };
      /** The workspace and the folder, on one panel. */
      pick: {
        workspace: string;
        newWorkspace: string;
        namedBelow: string;
        namePlaceholder: string;
        /** One existing workspace's second line. */
        opened: (date: string) => string;
        folder: string;
        choose: string;
        noFolder: string;
        /** Carry what is already in `docs/kanban/` into the workspace. */
        importCards: (count: number) => string;
        importBlurb: string;
        create: string;
        open: string;
      };
      /** The workspace is made and this checkout points at it. */
      done: {
        /** What landed, in one line. */
        ready: (name: string, cards: number) => string;
        /** The cards left in the folder are a stale copy now. */
        stale: string;
        offerTitle: string;
        /** What the one commit carries — files leaving git, the pointer, the ignore block. */
        offerBlurb: (cards: number) => string;
        /** Nothing is lost either way, and this is why. */
        offerSafe: string;
        /** There is no repository to commit to yet. */
        noGit: string;
        /** Nothing of this checkout was ever in git. */
        nothingTracked: string;
        commit: string;
        keep: string;
        committed: string;
        openBoard: string;
      };
    };
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
      /** This copy can install it — one click, then a restart. */
      detail: string;
      /** It cannot, and the reason says why. */
      detailManual: (reason: string) => string;
      install: string;
      download: string;
      later: string;
      /** Wave this version off for good. The board's chip is news and nothing else,
       *  so this dialog is where a version gets buried. */
      skip: string;
      /** Asked again while a download of this version is already going. */
      downloading: string;
      ready: (version: string) => string;
      readyDetail: string;
      restart: string;
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
  /** What the updater says for itself (#372) — why a copy cannot replace itself, and what
   *  went wrong when a download did not finish. The board UI prints these as they arrive. */
  update: {
    /** A checkout: there is no app bundle to replace yet. */
    blockedSource: string;
    /** A Linux copy that is not running as an AppImage — there is no one file to replace. */
    blockedNotAppImage: string;
    blockedReadOnly: (folder: string) => string;
    /** The release carries no build for this system and architecture. */
    noBuild: string;
    failedRead: string;
    /** The reason passes through as it arrived — a status code, a byte count. */
    failedDownload: (reason: string) => string;
    failedChecksum: string;
    failedUnpack: (reason: string) => string;
  };
  /** The failures `lib/board-init.ts` reports. A `stderr` from the installer passes through
   *  as it arrived. */
  board: {
    installerMissing: (path: string) => string;
    nothingMade: string;
  };
}
