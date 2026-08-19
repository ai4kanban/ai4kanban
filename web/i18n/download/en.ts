// English — the source of truth for the download page. Writing rules:
// `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const en: DownloadCopy = {
  meta: {
    title: "Download AI4Kanban — the board as a desktop app",
    description:
      "Get the AI4Kanban board as an app for macOS, Windows and Linux. Nothing to install first: no Node, no npx, no terminal.",
    socialTitle: "Download AI4Kanban",
    social: "The board as an app for macOS, Windows and Linux. Nothing to install first.",
  },

  hero: {
    title: "Download AI4Kanban",
    lead: "The board as an app for macOS, Windows and Linux. Nothing to install first — no Node, no npx, no terminal.",
    cta: "Download for {system}",
    ctaAny: "Download",
    note: "Starting agent runs still needs Claude Code, Codex, Cursor, OpenCode, or DeepSeek Harness on the machine.",
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
    body: "The app carries `akb` — the command a coding agent drives the board with — and offers to put it on your PATH the first time it opens. On macOS it writes one link at `/usr/local/bin/akb` and asks for your administrator password to do it. On Windows the installer puts the app's own folder on your PATH, which only reaches terminals opened after it. Nothing is copied out of the app, so updating the app updates the command.",
    later: "Saying no costs nothing — the button waits in **Configuration → Skill**. Linux is not offered it: the AppImage unpacks itself somewhere new every run, so `npm install -g ai4kanban` stays the way.",
  },
};

export default en;
