// English — the source of truth for the download page. Writing rules:
// `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const en: DownloadCopy = {
  meta: {
    title: "Download WildCrane for macOS, Windows and Linux",
    description:
      "Download WildCrane, an agent workspace for indie hackers. Available for macOS, Windows and Linux.",
    socialTitle: "Download WildCrane",
    social: "WildCrane: an agent workspace for indie hackers. Download for macOS, Windows and Linux.",
  },

  hero: {
    title: "WildCrane Desktop",
    lead: "For macOS, Windows and Linux.",
    cta: "Download",
    ctaFor: "Download {system}",
  },

  builds: {
    title: "All downloads",
  },

  firstOpen: {
    title: "First open",
    platformLabel: "Choose your platform",
    mac: {
      steps: [
        "Open the `.dmg` and drag **WildCrane** into Applications.",
        "Double-click it. macOS says it cannot verify the app — click **Done**. It will not open yet, and that is expected.",
        "In **System Settings → Privacy & Security**, scroll to **Security** and click **Open Anyway**.",
        "Unlock, then click **Open Anyway** once more. Every launch after this one opens straight away.",
      ],
    },
    windows: {
      body: "SmartScreen: **More info**, then **Run anyway**.",
    },
    linux: {
      body: "`chmod +x AI4Kanban-*.AppImage`, then run it.",
    },
  },
  command: {
    title: "Use `akb` in a terminal",
    mac: "Open the app once and `akb` works in your terminal.",
    windows: "Open a new terminal and `akb` works.",
    linux: "Only Linux needs a step: `npm install -g ai4kanban`.",
  },
};

export default en;
