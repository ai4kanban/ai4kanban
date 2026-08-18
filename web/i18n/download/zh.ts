// 简体中文 — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const zh: DownloadCopy = {
  meta: {
    title: "下载 AI4Kanban —— 桌面端看板",
    description:
      "获取 macOS、Windows 和 Linux 上的 AI4Kanban 看板应用。无需预先安装任何东西：不需要 Node，不需要 npx，也不需要终端。",
    socialTitle: "下载 AI4Kanban",
    social: "看板的桌面应用，支持 macOS、Windows 和 Linux，无需预先安装任何东西。",
  },

  hero: {
    title: "下载 AI4Kanban",
    lead: "看板的桌面应用，支持 macOS、Windows 和 Linux。无需预先安装任何东西 —— 不需要 Node，不需要 npx，也不需要终端。",
    cta: "下载 {system} 版",
    ctaAny: "下载",
    note: "发起 Agent 运行仍然需要机器上装有 Claude Code、Codex、Cursor 或 OpenCode。",
  },

  builds: {
    title: "全部下载",
    note: "目前都还没有签名，每个版本也只测试 macOS，因此首次打开时每个系统都会警告。",
  },

  firstOpen: {
    title: "第一次打开",
    mac: {
      title: "macOS",
      steps: [
        "打开 `.dmg`，把 **AI4Kanban** 拖进“应用程序”。",
        "双击打开。macOS 会提示无法验证这个应用，点**完成**。这一次打不开是正常的。",
        "打开**系统设置 → 隐私与安全性**，向下找到**安全性**，点**仍要打开**。",
        "解锁后再点一次**仍要打开**。之后每次都会直接打开。",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen：点**更多信息**，再点**仍要运行**。",
    },
    linux: {
      title: "Linux",
      body: "先 `chmod +x AI4Kanban-*.AppImage`，然后运行它。",
    },
  },
};

export default zh;
