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
    title: "把看板作为应用打开。",
    lead: "同一块看板，装进一个窗口。无需预先安装任何东西 —— 不需要 Node，不需要 npx，也不需要一直开着终端。首次打开时它会让你选择项目文件夹，之后记住这个选择。",
    cta: "下载对应系统的版本",
    note: "发起 Agent 运行仍然需要机器上装有你的编码 Agent —— Claude Code 或 Codex。应用启动时会读取你自己的 shell 环境，因此按常规方式安装的 Agent 都能找到。",
  },

  builds: {
    title: "该下载哪个版本",
    lead: "同一个版本，三个系统，目前都还没有签名。每个版本我们只测试 macOS；Windows 和 Linux 会一并构建发布，但在收到反馈之前都属于未经测试。",
    columns: { system: "系统", file: "文件", signed: "已签名", tested: "已测试" },
    yes: "是",
    no: "否",
    systems: ["macOS（Apple 芯片、Intel）", "Windows", "Linux"],
  },

  unsigned: {
    title: "第一次打开",
    lead: "这个版本三个系统的安装包都未签名，所以首次打开时每个系统都会警告。给 Mac 版签名是我们接下来要做的事。在那之前，按下面点一次就好，之后每次打开都不会再问：",
    mac: {
      title: "macOS",
      steps: [
        "打开 `.dmg`，把 **AI4Kanban** 拖进“应用程序”文件夹。",
        "双击打开。macOS 会提示 *Apple 无法验证“AI4Kanban”是否含有恶意软件*，点**完成**。这一次打不开是正常的。",
        "打开**系统设置 → 隐私与安全性**，向下找到**安全性**，在 *已阻止“AI4Kanban”以保护你的 Mac* 旁边点**仍要打开**。",
        "用触控 ID 或密码解锁，再点一次**仍要打开**。应用就打开了，之后每次都会直接打开。",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen 会提示 *Windows 已保护你的电脑*。点击**更多信息**，再点**仍要运行**。",
    },
    linux: {
      title: "Linux",
      body: "给文件加上可执行权限再运行：先 `chmod +x AI4Kanban-*.AppImage`，然后 `./AI4Kanban-*.AppImage`。",
    },
  },

  using: {
    title: "打开之后",
    items: [
      {
        title: "一次只看一个项目",
        body: "首次打开时它会让你选择文件夹，之后记住这个选择。点击顶栏里的路径可以换成另一个文件夹；选中一个还没有看板的文件夹也没关系 —— 它会提出在那里建一块。",
      },
      {
        title: "是否升级由你决定",
        body: "应用不会自行升级。有新版本时它会提示一句，并链接回本页。关闭窗口会结束看板以及它启动的所有运行。",
      },
    ],
  },

  deprecated: {
    title: "旧方式：自己把它跑起来",
    body: "`npx ai4kanban-ui` 仍然能在浏览器里打开看板，但这条路已弃用。它仍然可用，npm 包只是冻结而非下架，已经在用的人不会被打断 —— 但不会再有新版本发到那里。页面本身不会消失：应用就是同样的页面装进了一个窗口，从别的设备访问看板也依然需要一个服务。被弃用的是“让你自己起一个服务再打开浏览器”这件事。",
  },
};

export default zh;
