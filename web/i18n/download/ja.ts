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
    title: "ボードをアプリとして開く。",
    lead: "同じボードを、ひとつのウィンドウで。事前に入れるものはありません — Node も npx も、開いたままにしておくターミナルも不要です。初回にどのプロジェクトフォルダを開くかを尋ね、以後はそれを覚えています。",
    cta: "お使いのシステム向けをダウンロード",
    note: "エージェントの実行には、これまでどおりマシン上のコーディングエージェント（Claude Code または Codex）が必要です。アプリは起動時にあなた自身のシェル環境を読むので、通常どおり入れたエージェントはそのまま見つかります。",
  },

  builds: {
    title: "どのビルドを選ぶか",
    lead: "ひとつのリリースに三つのシステム。毎回テストしているのは macOS だけで、Windows と Linux はビルドして公開していますが、報告があるまでは未テストです。",
    columns: { system: "システム", file: "ファイル", signed: "署名あり", tested: "テスト済み" },
    yes: "はい",
    no: "いいえ",
    systems: ["macOS（Apple シリコン、Intel）", "Windows", "Linux"],
  },

  unsigned: {
    title: "署名なしビルドを開く",
    lead: "Mac 版は署名済みなので、ダブルクリックで開きます。Windows と Linux はこのリリースでは署名なしのため、初回に警告が出ます。それを越える手順はひとつだけです。",
    windows: {
      title: "Windows",
      body: "SmartScreen が *WindowsによってPCが保護されました* と表示します。**詳細情報**、続けて**実行**をクリックしてください。",
    },
    linux: {
      title: "Linux",
      body: "実行権限を付けてから起動します。`chmod +x AI4Kanban-*.AppImage` のあと `./AI4Kanban-*.AppImage`。",
    },
  },

  using: {
    title: "開いたあと",
    items: [
      {
        title: "一度にひとつのプロジェクト",
        body: "初回にどのフォルダを開くかを尋ね、以後はそれを覚えています。ヘッダーのパスから別のフォルダに切り替えられます。ボードのないフォルダでも構いません — その場に作ることを提案します。",
      },
      {
        title: "更新するかはあなたが決める",
        body: "アプリが自分で更新することはありません。新しいバージョンが出たときは、このページへのリンクとともにその旨を伝えます。ウィンドウを閉じると、ボードとその配下の実行はすべて終了します。",
      },
    ],
  },

  deprecated: {
    title: "以前のやり方：自分で起動する",
    body: "`npx ai4kanban-ui` は今もブラウザでボードを表示できますが、この方法は非推奨です。動作は続き、パッケージは削除ではなく凍結なので、すでに使っている環境はそのまま立ち上がります — ただし新しいリリースはそこには来ません。ページ自体がなくなるわけではありません。アプリはその同じページをウィンドウに入れたものですし、別の端末からボードを開くにはサーバーが必要です。非推奨なのは、あなたにサーバーを立ててブラウザを開かせること自体です。",
  },
};

export default ja;
