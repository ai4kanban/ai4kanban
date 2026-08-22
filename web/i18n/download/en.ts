// English — the source of truth for the download page. Writing rules:
// `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const en: DownloadCopy = {
  meta: {
    title: "Download AI4Kanban — the board as a desktop app",
    description:
      "Get AI4Kanban as a desktop app for macOS, Windows and Linux.",
    socialTitle: "Download AI4Kanban",
    social: "The board as a desktop app for macOS, Windows and Linux.",
  },

  hero: {
    title: "Download AI4Kanban",
    lead: "The board as a desktop app for macOS, Windows and Linux.",
    cta: "Download",
  },

  builds: {
    title: "All downloads",
    note: "Nothing is signed yet and only macOS is tested each release, so every system warns the first time you open it.",
  },

  firstOpen: {
    title: "First open",
    mac: {
      title: "macOS",
      steps: [
        "Open the `.dmg` and drag **AI4Kanban** into Applications.",
        "Double-click it. macOS says it cannot verify the app — click **Done**. It will not open yet, and that is expected.",
        "In **System Settings → Privacy & Security**, scroll to **Security** and click **Open Anyway**.",
        "Unlock, then click **Open Anyway** once more. Every launch after this one opens straight away.",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen: **More info**, then **Run anyway**.",
    },
    linux: {
      title: "Linux",
      body: "`chmod +x AI4Kanban-*.AppImage`, then run it.",
    },
  },
  command: {
    title: "The `akb` command",
    body: "The app carries `akb` — the command a coding agent drives the board with — and offers to put it on your PATH on first open. macOS writes one link at `/usr/local/bin/akb` and asks for your administrator password; Windows adds the app's folder to PATH, which only reaches terminals opened after it. Nothing is copied out, so updating the app updates the command.",
    later: "Skip it and the button waits in **Configuration → Setup**. Linux is not offered it: the AppImage unpacks somewhere new every run, so `npm install -g ai4kanban` stays the way.",
  },
};

export default en;
