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
    title: "AI4Kanban をダウンロード",
    lead: "macOS、Windows、Linux 向けのボードのデスクトップアプリ。",
    cta: "ダウンロード",
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
  command: {
    title: "`akb` コマンド",
    body: "アプリは `akb`——コーディングエージェントがボードを操作するためのコマンド——を同梱し、初回起動時に PATH へ通すかどうかを尋ねます。macOS は `/usr/local/bin/akb` にリンクを 1 つ書き込むため管理者パスワードを求め、Windows はアプリのフォルダーを PATH に追加します（効くのはその後に開いたターミナルだけです）。アプリの外へは何もコピーされないので、アプリを更新すればコマンドも更新されます。",
    later: "断った場合もボタンは **Configuration → Agent setup** に残ります。Linux では提供していません。AppImage は実行のたびに新しい場所へ展開されるため、`npm install -g ai4kanban` がそのまま方法です。",
  },
};

export default ja;
