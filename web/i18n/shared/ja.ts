// 日本語 — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const ja: SharedCopy = {
  nav: {
    download: "ダウンロード",
    recipes: "レシピ",
    compare: "比較",
    github: "GitHub ↗",
    menu: "メニュー",
  },
  footer: {
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    comparisons: "Comparisons",
    license: "Apache License 2.0",
    credit: "Tao Wu が作成",
    x: "Tao Wu の X",
    origin: "もとは次のプロダクト向けに作ったスキルです：",
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
