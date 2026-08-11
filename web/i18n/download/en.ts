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
    title: "Open the board as an app.",
    lead: "The same board, in a window. Nothing to install first — no Node, no npx, and no terminal to keep alive. It asks which project folder to open the first time and remembers it.",
    cta: "Download for your system",
    note: "Starting agent runs still needs your coding agent on the machine — Claude Code or Codex. The app reads your own shell environment when it starts, so an agent installed the normal way is found.",
  },

  builds: {
    title: "Which build to take",
    lead: "One release, three systems, none of them signed yet. macOS is the one we test each release; Windows and Linux are built and published untested until someone tells us otherwise.",
    columns: { system: "System", file: "File", signed: "Signed", tested: "Tested" },
    yes: "Yes",
    no: "No",
    systems: ["macOS (Apple Silicon, Intel)", "Windows", "Linux"],
  },

  unsigned: {
    title: "Opening it the first time",
    lead: "Every build ships unsigned this release, so every system warns the first time you open it. Signing the Mac build is next on the list. Here is what to click until then — once per system, never again after that:",
    mac: {
      title: "macOS",
      steps: [
        "Open the `.dmg` and drag **AI4Kanban** into your Applications folder.",
        "Double-click it. macOS says *Apple could not verify AI4Kanban is free of malware* — click **Done**. It will not open yet, and that is expected.",
        "Open **System Settings → Privacy & Security**, scroll down to **Security**, and next to *AI4Kanban was blocked to protect your Mac* click **Open Anyway**.",
        "Unlock with Touch ID or your password, then click **Open Anyway** once more. The app opens, and every launch after this one opens straight away.",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen says *Windows protected your PC*. Click **More info**, then **Run anyway**.",
    },
    linux: {
      title: "Linux",
      body: "Make the file executable and run it: `chmod +x AI4Kanban-*.AppImage`, then `./AI4Kanban-*.AppImage`.",
    },
  },

  using: {
    title: "After it opens",
    items: [
      {
        title: "One project at a time",
        body: "It asks which folder to open the first time and remembers it. The folder path in the header opens another one, and a folder with no board is fine — it offers to make one there.",
      },
      {
        title: "Updates stay your call",
        body: "The app never updates itself. When a newer version is out it says so, with a link back to this page. Closing the window ends the board and every run under it.",
      },
    ],
  },

  deprecated: {
    title: "The old way: run it yourself",
    body: "`npx ai4kanban-ui` still serves the board in a browser, but that way is deprecated. It keeps working and the package is frozen rather than pulled, so an existing setup still comes up — no new release lands there. The pages themselves are not going anywhere: the app is those same pages in a window, and reaching the board from another device still needs a server. What is deprecated is asking you to start one and open a browser.",
  },
};

export default en;
