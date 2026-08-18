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
    note: "Starting agent runs still needs Claude Code, Codex, Cursor, or OpenCode on the machine.",
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
};

export default en;
