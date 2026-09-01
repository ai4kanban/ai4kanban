// 日本語 — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const ja: DownloadCopy = {
  meta: {
    title: "AI4Kanban をダウンロード — デスクトップアプリ版のボード",
    description:
      "macOS、Windows、Linux 向けの AI4Kanban デスクトップアプリ。",
    socialTitle: "AI4Kanban をダウンロード",
    social: "macOS、Windows、Linux 向けのボードのデスクトップアプリ。",
  },

  hero: {
    title: "AI4Kanban デスクトップ版",
    lead: "macOS、Windows、Linux に対応。",
    cta: "ダウンロード",
    ctaFor: "{system} 版をダウンロード",
  },

  builds: {
    title: "すべてのダウンロード",
  },

  firstOpen: {
    title: "はじめて開くとき",
    platformLabel: "プラットフォームを選択",
    mac: {
      steps: [
        "`.dmg` を開き、**AI4Kanban** をアプリケーションにドラッグします。",
        "ダブルクリックします。macOS が確認できないと表示するので、**完了**をクリックします。ここではまだ開きませんが、それで正常です。",
        "**システム設定 → プライバシーとセキュリティ**を開き、**セキュリティ**まで下にスクロールして**このまま開く**をクリックします。",
        "認証してから、もう一度**このまま開く**をクリックします。次回からはそのまま起動します。",
      ],
    },
    windows: {
      body: "SmartScreen では**詳細情報**、続けて**実行**をクリックします。",
    },
    linux: {
      body: "`chmod +x AI4Kanban-*.AppImage` のあと、実行します。",
    },
  },
  command: {
    title: "ターミナルで `akb` を使う",
    mac: "アプリを一度開けば、ターミナルで `akb` が使えます。",
    windows: "ターミナルを開き直せば `akb` が使えます。",
    linux: "手動の作業が必要なのは Linux だけです: `npm install -g ai4kanban`。",
  },
};

export default ja;
