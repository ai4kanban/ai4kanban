// 简体中文 — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const zh: SharedCopy = {
  nav: {
    download: "下载",
    docs: "文档",
    blog: "博客",
    compare: "对比",
    github: "GitHub ↗",
    menu: "菜单",
  },
  footer: {
    groups: {
      product: "产品",
      learn: "学习",
      project: "项目",
      legal: "法律",
    },
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    blog: "Blog",
    cloud: "Cloud",
    changelog: "Changelog",
    builder: "Builder",
    privacy: "Privacy",
    terms: "Terms",
    credit: "created by Tao Wu",
    x: "Tao Wu 的 X 主页",
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
