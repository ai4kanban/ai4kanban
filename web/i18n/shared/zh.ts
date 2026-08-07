// 简体中文 — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const zh: SharedCopy = {
  nav: {
    install: "安装",
    usage: "怎么用",
    boardUi: "看板界面",
    features: "功能",
    recipes: "任务模板",
    compare: "对比",
    compareMore: "更多对比即将上线…",
    github: "GitHub ↗",
  },
  footer: {
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    comparisons: "Comparisons",
    license: "Apache License 2.0",
    credit: "created by Tao Wu",
    x: "Tao Wu 的 X 主页",
    origin: "最初是为以下项目打造的技能：",
  },
  code: {
    copy: "复制",
    copied: "已复制",
    copyAria: "复制到剪贴板",
    copiedAria: "已复制",
  },
  language: { label: "语言" },
  vs: "vs",
  bottomLine: "结论",
  cta: { install: "安装 AI4Kanban", github: "在 GitHub 上查看 ↗" },
};

export default zh;
