// 日本語 — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const ja: DownloadCopy = {
  meta: {
    title: "AI4Kanban をダウンロード — デスクトップアプリ版のボード",
    description:
      "macOS、Windows、Linux 向けの AI4Kanban ボードアプリ。事前に入れるものはありません。Node も npx もターミナルも不要です。",
    socialTitle: "AI4Kanban をダウンロード",
    social: "macOS、Windows、Linux 向けのボードアプリ。事前に入れるものはありません。",
  },

  hero: {
    title: "AI4Kanban をダウンロード",
    lead: "macOS、Windows、Linux 向けのボードアプリ。事前に入れるものはありません — Node も npx もターミナルも不要です。",
    cta: "{system} 版をダウンロード",
    ctaAny: "ダウンロード",
    note: "エージェントの実行には、マシン上の Claude Code、Codex、Cursor、OpenCode のいずれかが必要です。",
  },

  builds: {
    title: "すべてのダウンロード",
    note: "どれもまだ署名がなく、毎回テストしているのは macOS だけなので、どのシステムでも初回に警告が出ます。",
  },

  firstOpen: {
    title: "はじめて開くとき",
    mac: {
      title: "macOS",
      steps: [
        "`.dmg` を開き、**AI4Kanban** をアプリケーションにドラッグします。",
        "ダブルクリックします。macOS が確認できないと表示するので、**完了**をクリックします。ここではまだ開きませんが、それで正常です。",
        "**システム設定 → プライバシーとセキュリティ**を開き、**セキュリティ**まで下にスクロールして**このまま開く**をクリックします。",
        "認証してから、もう一度**このまま開く**をクリックします。次回からはそのまま起動します。",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen では**詳細情報**、続けて**実行**をクリックします。",
    },
    linux: {
      title: "Linux",
      body: "`chmod +x AI4Kanban-*.AppImage` のあと、実行します。",
    },
  },
};

export default ja;
