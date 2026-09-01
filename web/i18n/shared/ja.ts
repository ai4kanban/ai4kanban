// 日本語 — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const ja: SharedCopy = {
  nav: {
    download: "ダウンロード",
    docs: "ドキュメント",
    blog: "ブログ",
    compare: "比較",
    github: "GitHub ↗",
    menu: "メニュー",
  },
  footer: {
    groups: {
      product: "製品",
      learn: "学ぶ",
      project: "プロジェクト",
      legal: "法務",
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
    credit: "Tao Wu が作成",
    x: "Tao Wu の X",
  },
  code: {
    copy: "コピー",
    copied: "コピーしました",
    copyAria: "クリップボードにコピー",
    copiedAria: "コピーしました",
  },
  language: { label: "言語" },
  vs: "vs",
  bottomLine: "結論",
  cta: { install: "AI4Kanban をインストール", github: "GitHub で見る ↗" },
};

export default ja;
